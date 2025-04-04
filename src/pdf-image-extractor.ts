
import { PDFDocument, PDFRawStream, PDFName, type PDFRef, type PDFObject } from "pdf-lib";
import { PNG, type ColorType } from "pngjs/browser";
import pako from "pako";

type ImageResult = {
    pdfRef: PDFRef;
    ref: number;
    smaskRef: PDFObject | undefined;
    colorSpace: PDFObject | undefined;
    name: PDFName;
    width: number;
    height: number;
    bitsPerComponent: number;
    data: Uint8Array;
    type: string;
    blob: Blob | undefined;
    isAlphaLayer: boolean | undefined;
    alphaLayer: ImageResult | undefined;
}

export async function getImageFromPdf(pdfBytes: ArrayBuffer) {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const imagesInDoc: ImageResult[] = [];
    const page = pdfDoc.getPage(0);
    // const resources = page.node.Resources();
    // const xObjects = resources?.get(PDFName.of("XObject"));
    // const images = xObjects?.get(PDFName.of("Image"));
    console.log(page);

    pdfDoc.context
        .enumerateIndirectObjects()
        .forEach(async ([pdfRef, pdfObject], ref) => {
            if (!(pdfObject instanceof PDFRawStream)) {
                return;
            }
            const { dict } = pdfObject;
            const smaskRef = dict.get(PDFName.of("SMask"));
            const colorSpace = dict.get(PDFName.of("ColorSpace"));
            const subtype = dict.get(PDFName.of("Subtype"));
            const width = dict.get(PDFName.of("Width")) as any;
            const height = dict.get(PDFName.of("Height")) as any;
            const name = dict.get(PDFName.of("Name")) as any;
            const bitsPerComponent = dict.get(PDFName.of("BitsPerComponent")) as any;
            const filter = dict.get(PDFName.of("Filter"));

            if (subtype == PDFName.of("Image")) {
                imagesInDoc.push({
                    pdfRef, // added, must use pdfRef to locate alpha layers
                    ref,
                    smaskRef,
                    colorSpace,
                    name: name ? name.key : `Object${ref}`,
                    width: width.numberValue,
                    height: height.numberValue,
                    bitsPerComponent: bitsPerComponent.numberValue,
                    data: pdfObject.contents,
                    type: filter === PDFName.of("DCTDecode") ? "jpg" : "png",
                    blob: undefined,
                    isAlphaLayer: undefined,
                    alphaLayer: undefined
                });
            }
        });

    // Log info about the images we found in the PDF
    console.log(`===== ${imagesInDoc.length} Images found in PDF =====`);
    for (const image of imagesInDoc) {
        // Find and mark SMasks as alpha layers
        if (image.type === "png" && image.smaskRef) {
            const smaskImg = imagesInDoc.find((sm) => {
                return image.smaskRef == sm.pdfRef; // ref cannot match to smaskRef, must use pdfRef
            });
            if (smaskImg) {
                smaskImg.isAlphaLayer = true;
                //image.alphaLayer = image; // change suggest by hafsa110, but creates a alpha layer pixel indexing problem (see savePNG)
                image.alphaLayer = smaskImg;
            }
            image.blob = await savePng(image);
        } else if (image.type === "jpg") {
            image.blob = new Blob([image.data], { type: "image/jpeg" });
        }
    }

    console.log(imagesInDoc);
    return imagesInDoc;
}

const PngColorTypes = {
    Grayscale: 0,
    Rgb: 2,
    GrayscaleAlpha: 4,
    RgbAlpha: 6,
};

const ComponentsPerPixelOfColorType = {
    [PngColorTypes.Rgb]: 3,
    [PngColorTypes.Grayscale]: 1,
    [PngColorTypes.RgbAlpha]: 4,
    [PngColorTypes.GrayscaleAlpha]: 2,
};

const readBitAtOffsetOfByte = (byte: number, bitOffset: number) => {
    const bit = (byte >> bitOffset) & 1;
    return bit;
};

const readBitAtOffsetOfArray = (uint8Array: Uint8Array, bitOffsetWithinArray: number) => {
    const byteOffset = Math.floor(bitOffsetWithinArray / 8);
    const byte = uint8Array[uint8Array.length - byteOffset];
    const bitOffsetWithinByte = Math.floor(bitOffsetWithinArray % 8);
    return readBitAtOffsetOfByte(byte, bitOffsetWithinByte);
};

function savePng(image: ImageResult): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const isGrayscale = image.colorSpace === PDFName.of("DeviceGray");
        const colorPixels = pako.inflate(image.data);
        const alphaPixels = image.alphaLayer
            ? pako.inflate(image.alphaLayer.data)
            : undefined;
        if (!alphaPixels) {
            throw new Error("Alpha pixels are undefined");
        }
        // prettier-ignore
        const colorType = isGrayscale && alphaPixels ? PngColorTypes.GrayscaleAlpha as ColorType
            : !isGrayscale && alphaPixels ? PngColorTypes.RgbAlpha as ColorType
                : isGrayscale ? PngColorTypes.Grayscale as ColorType
                    : PngColorTypes.Rgb as ColorType;

        const colorByteSize = 1;
        const width = image.width * colorByteSize;
        const height = image.height * colorByteSize;
        const inputHasAlpha = [
            PngColorTypes.RgbAlpha,
            PngColorTypes.GrayscaleAlpha,
        ].includes(colorType);

        const png = new PNG({
            width,
            height,
            colorType,
            inputColorType: colorType,
            inputHasAlpha,
        });

        const componentsPerPixel = ComponentsPerPixelOfColorType[colorType];
        png.data = new Uint8Array(width * height * componentsPerPixel) as Buffer;

        let colorPixelIdx = 0;
        let alphaPixelIdx = 0; // add nee index tracker for the alpha later
        let pixelIdx = 0;
        // prettier-ignore
        while (pixelIdx < png.data.length) {
            if (colorType === PngColorTypes.Rgb) {
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
            }
            else if (colorType === PngColorTypes.RgbAlpha) {
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
                png.data[pixelIdx++] = colorPixels[colorPixelIdx++];
                //png.data[pixelIdx++] = alphaPixels[colorPixelIdx - 1]; // must reference alpha layer pixel index here
                png.data[pixelIdx++] = alphaPixels[alphaPixelIdx++ - 1];

            }
            else if (colorType === PngColorTypes.Grayscale) {
                const bit = readBitAtOffsetOfArray(colorPixels, colorPixelIdx++) === 0
                    ? 0x00
                    : 0xff;
                png.data[png.data.length - (pixelIdx++)] = bit;
            }
            else if (colorType === PngColorTypes.GrayscaleAlpha) {
                const bit = readBitAtOffsetOfArray(colorPixels, colorPixelIdx++) === 0
                    ? 0x00
                    : 0xff;
                png.data[png.data.length - pixelIdx++] = bit;
                //png.data[png.data.length - pixelIdx++] = alphaPixels[colorPixelIdx - 1]; // must reference alpha layer pixel index here
                png.data[png.data.length - pixelIdx++] = alphaPixels[alphaPixelIdx++ - 1];
            }
            else {
                throw new Error(`Unknown colorType=${colorType}`);
            }
        }

        const buffer: any = [];
        png
            .pack()
            .on("data", (data) => buffer.push(...data))
            .on("end", () => resolve(new Blob([Buffer.from(buffer)], { type: "image/png" })))
            .on("error", (err) => reject(err));
    });
}
