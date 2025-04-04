/**
 * PDF Processor for ID Card PDF Merger
 * Handles PDF loading, image extraction, and PDF generation
 */

import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, PDFPage, Image } from "mupdf/mupdfjs"

// Configure the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.1.91/build/pdf.worker.min.mjs';

/**
 * Gets the size of the specified page, converted from PDF units to inches.
 */
function getPageSizeInches({ view, userUnit, rotate }: { view: number[], userUnit: number, rotate: number }) {
    const [x1, y1, x2, y2] = view;
    // We need to take the page rotation into account as well.
    const changeOrientation = rotate % 180 !== 0;

    const width = ((x2 - x1) / 72) * userUnit;
    const height = ((y2 - y1) / 72) * userUnit;

    return {
        width: changeOrientation ? height : width,
        height: changeOrientation ? width : height,
    };
}

/**
 * Extract image from a PDF page
 * @param page - The PDF page object from PDF.js
 * @return Promise resolving to the extracted image
 */
async function extractImageFromPage(page: pdfjsLib.PDFPageProxy): Promise<ImageWithDPI> {
    const scale = 4.0; // Higher scale for better quality
    const viewport = page.getViewport({ scale });

    // Create canvas for rendering
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Failed to create canvas context.');
    }

    // Render PDF page to canvas
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;
    return {
        blob: await new Promise((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error('Failed to convert canvas to blob'));
                    return;
                }
                resolve(blob);
            }, 'image/png');
        }),
        dpi: canvas.width / getPageSizeInches(page).width,
        width: canvas.width,
        height: canvas.height
    };
}

async function extractImageByPDFJS(buffer: ArrayBuffer) {
    // Load PDF using PDF.js
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    if (pdf.numPages !== 2) {
        throw new Error(`Expected a 2-page PDF, but got ${pdf.numPages} pages.`);
    }

    // Get both pages
    const frontPagePromise = pdf.getPage(1);
    const backPagePromise = pdf.getPage(2);

    const [frontPage, backPage] = await Promise.all([frontPagePromise, backPagePromise]);

    const [frontImg, backImg] = await Promise.all([
        extractImageFromPage(frontPage),
        extractImageFromPage(backPage)
    ]);

    return {
        frontImage: frontImg,
        backImage: backImg
    };
}

async function getImagesByMupdf(buffer: ArrayBuffer) {
    const pdfDoc = PDFDocument.openDocument(buffer);
    if (pdfDoc.countPages() !== 2) {
        throw new Error(`Expected a 2-page PDF, but got ${pdfDoc.countPages()} pages.`);
    }
    const frontPage = pdfDoc.loadPage(0);
    const backPage = pdfDoc.loadPage(1);
    let imagesInFrontPage = frontPage.getImages().map(async (image) => {
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
    async processPdf(file: File): Promise<PDFImages> {
        if (!file || file.type !== 'application/pdf') {
            throw new Error('Invalid file type. Please upload a PDF.');
        }
        const pdfBytes = await file.arrayBuffer();

        try {
            let result = await getImagesByMupdf(pdfBytes);
            this.frontImage = result.frontImage;
            this.backImage = result.backImage;
            return result;
        } catch {
            throw new Error('Failed to extract images from PDF.');
        }
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
     * @param {ImageWithDPI} frontImage - The cropped front image canvas
     * @param {ImageWithDPI} backImage - The cropped back image canvas
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
        const page = new PDFPage(pdf, 0);
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
        page.insertImage({image: new Image(await frontImage.blob.arrayBuffer()), name: 'frontImage'}, {
            x: frontX,
            y: frontY,
            width: frontImagePtWidth,
            height: frontImagePtHeight
        });
        page.insertImage({image: new Image(await backImage.blob.arrayBuffer()), name: 'backImage'}, {
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