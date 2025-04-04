/**
 * PDF Processor for ID Card PDF Merger
 * Handles PDF loading, image extraction, and PDF generation
 */

import { PDFDocument, PDFPage, Image } from "mupdf/mupdfjs"
import { Finally } from "./utils";

async function getImagesByMupdf(buffer: ArrayBuffer) {
    const pdfDoc = PDFDocument.openDocument(buffer);
    using _ = new Finally(() => pdfDoc.destroy());
    if (pdfDoc.countPages() !== 2) {
        throw new Error(`Expected a 2-page PDF, but got ${pdfDoc.countPages()} pages.`);
    }
    const frontPage = pdfDoc.loadPage(0);
    const backPage = pdfDoc.loadPage(1);
    using _frontPage = new Finally(() => frontPage.destroy());
    using _backPage = new Finally(() => backPage.destroy());
    let imagesInFrontPage = frontPage.getImages().map(async (image) => {
        var pixmap = image.image.toPixmap();
        using _pixmap = new Finally(() => pixmap.destroy());
        let raster = pixmap.asPNG();
        let imageResult: ImageWithDPI = {
            blob: new Blob([raster], { type: 'image/png' }), 
            dpi: image.image.getWidth() / (image.bbox[2] - image.bbox[0]) * 72,
            width: image.image.getWidth(),
            height: image.image.getHeight()
        };
        return imageResult;
    });
    let imagesInBackPage = backPage.getImages().map(async (image) => {
        var pixmap = image.image.toPixmap();
        let raster = pixmap.asPNG();
        let imageResult: ImageWithDPI = {
            blob: new Blob([raster], { type: 'image/png' }), 
            dpi: image.image.getWidth() / (image.bbox[2] - image.bbox[0]) * 72,
            width: image.image.getWidth(),
            height: image.image.getHeight()
        };
        return imageResult;
    });
    return {
        frontImage: await imagesInFrontPage[0],
        backImage: await imagesInBackPage[0]
    };
}

export class PDFProcessor {
    private frontImage: ImageWithDPI | null = null;
    private backImage: ImageWithDPI | null = null;
    private croppedFront: ImageWithDPI | null = null;
    private croppedBack: ImageWithDPI | null = null;
    private outputPdfUrl: string | null = null;
    
    
    /**
     * Process a PDF file
     * @param {File} file - The PDF file to process
     * @return {Promise<PDFImages>} Promise resolving to extracted images
     */
    async extractImagesFromPdf(file: File): Promise<PDFImages> {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Invalid file type. Please upload a PDF.');
        }
        const pdfBytes = await file.arrayBuffer();
        let result = await getImagesByMupdf(pdfBytes);
        this.frontImage = result.frontImage;
        this.backImage = result.backImage;
        return result;
    }

    /**
     * Check if images have been loaded
     * @return {boolean} True if images are loaded
     */
    hasImages(): boolean {
        return !!this.frontImage && !!this.backImage;
    }

    /**
     * Get the loaded images
     * @return {PDFImages} Object containing front and back images
     */
    getImages(): PDFImages {
        if (!this.frontImage || !this.backImage) {
            throw new Error('Images not loaded');
        }

        return {
            frontImage: this.frontImage,
            backImage: this.backImage
        };
    }
    
    /**
     * Set the cropped images
     * @param croppedFront - The cropped front image
     * @param croppedBack - The cropped back image
     */
    setCroppedImages(croppedFront: ImageWithDPI, croppedBack: ImageWithDPI): void {
        this.croppedFront = croppedFront;
        this.croppedBack = croppedBack;
    }

    /**
     * Check if cropped images exist
     * @return {boolean} True if cropped images exist
     */
    hasCroppedImages(): boolean {
        return !!this.croppedFront && !!this.croppedBack;
    }

    /**
     * Get the cropped images
     * @return {CroppedImages} Object containing cropped front and back images
     */
    getCroppedImages(): CroppedImages {
        if (!this.croppedFront || !this.croppedBack) {
            throw new Error('Cropped images not available');
        }

        return {
            croppedFront: this.croppedFront,
            croppedBack: this.croppedBack
        };
    }

    /**
     * Generate a PDF with the cropped images
     * @param {ImageWithDPI} frontImage - The cropped front image
     * @param {ImageWithDPI} backImage - The cropped back image
     * @param {number} frontOffset - Vertical position of front image (0-50%)
     * @param {number} backOffset - Vertical position of back image (50-100%)
     * @return {string} URL for the generated PDF
     */
    async generatePdf(
        frontImage: ImageWithDPI,
        backImage: ImageWithDPI,
        frontOffset: number,
        backOffset: number
    ): Promise<string> {
        if (!frontImage || !backImage) {
            throw new Error('Missing cropped images.');
        }

        // Create new PDF using jsPDF
        const pdf = PDFDocument.createBlankDocument();
        using _ = new Finally(() => pdf.destroy());
        const page = new PDFPage(pdf, 0);
        using _1 = new Finally(() => page.destroy());
        const bounds = page.getBounds();
        const pageWidth = bounds[2] - bounds[0];
        const pageHeight = bounds[3] - bounds[1];

        const frontImagePtWidth = frontImage.width / frontImage.dpi * 72;
        const frontImagePtHeight = frontImage.height / frontImage.dpi * 72;
        const backImagePtWidth = backImage.width / backImage.dpi * 72;
        const backImagePtHeight = backImage.height / backImage.dpi * 72;
        // Calculate positions
        const frontY = (pageHeight * frontOffset / 100) - (frontImagePtHeight / 2);
        const backY = (pageHeight * backOffset / 100) - (backImagePtHeight / 2);
        const frontX = (pageWidth - frontImagePtWidth) / 2;
        const backX = (pageWidth - backImagePtWidth) / 2;

        // Add images to PDF
        const mupdfFrontImage = new Image(await frontImage.blob.arrayBuffer());
        using _2 = new Finally(() => mupdfFrontImage.destroy());
        page.insertImage({image: mupdfFrontImage, name: 'frontImage'}, {
            x: frontX,
            y: frontY,
            width: frontImagePtWidth,
            height: frontImagePtHeight
        });
        const mupdfBackImage = new Image(await backImage.blob.arrayBuffer());
        using _3 = new Finally(() => mupdfBackImage.destroy());
        page.insertImage({image: mupdfBackImage, name: 'backImage'}, {
            x: backX,
            y: backY,
            width: backImagePtWidth,
            height: backImagePtHeight
        });

        // Generate and save the PDF
        const blob = new Blob([pdf.saveToBuffer().asUint8Array()], { type: 'application/pdf' });

        // Revoke previous URL if exists
        if (this.outputPdfUrl) {
            URL.revokeObjectURL(this.outputPdfUrl);
        }

        // Create new URL for download
        this.outputPdfUrl = URL.createObjectURL(blob);

        return this.outputPdfUrl;
    }
} 