interface ImageWithDPI {
    blob: Blob
    /** pixel per inch */
    dpi: number
    width: number
    height: number
}

type PDFImages = {
    frontImage: ImageWithDPI;
    backImage: ImageWithDPI;
};

type CroppedImages = {
    croppedFront: ImageWithDPI;
    croppedBack: ImageWithDPI;
};
