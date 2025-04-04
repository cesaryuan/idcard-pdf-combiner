/**
 * PDF Processor for ID Card PDF Merger
 * Handles PDF loading, image extraction, and PDF generation
 */

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { getImageFromPdf } from './pdf-image-extractor';
import { getImageFromSrc } from './utils';

// Configure the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.1.91/build/pdf.worker.min.mjs';

declare global {
    interface HTMLImageElement {
        dpi: number;
    }
}

type PDFImages = {
    frontImage: HTMLImageElement;
    backImage: HTMLImageElement;
};

type CroppedImages = {
    croppedFront: HTMLImageElement;
    croppedBack: HTMLImageElement;
};

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
async function extractImageFromPage(page: pdfjsLib.PDFPageProxy): Promise<HTMLImageElement> {
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
    const image = await getImageFromSrc(canvas.toDataURL('image/png'));
    image.dpi = image.naturalWidth / getPageSizeInches(page).width;
    return image;
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

export class PDFProcessor {
    private frontImage: HTMLImageElement | null = null;
    private backImage: HTMLImageElement | null = null;
    private croppedFront: HTMLImageElement | null = null;
    private croppedBack: HTMLImageElement | null = null;
    private outputPdfUrl: string | null = null;
    
    // A4 paper dimensions at 72 DPI (points)
    private a4Width = 8.27;
    private a4Height = 11.69;
    
    /**
     * Create a PDF processor
     */
    constructor() {
    }
    
    /**
     * Process a PDF file
     * @param {File} file - The PDF file to process
     * @return {Promise<PDFImages>} Promise resolving to extracted images
     */
    async processPdf(file: File): Promise<PDFImages> {
        const pdfBytes = await new Promise<ArrayBuffer>((resolve, reject) => {
            if (!file || file.type !== 'application/pdf') {
                reject(new Error('Invalid file type. Please upload a PDF.'));
                return;
            }
            
            const fileReader = new FileReader();
            
            fileReader.onload = (event) => {
                if (!event.target || !event.target.result) {
                    reject(new Error('Failed to read file.'));
                    return;
                }
                
                if (event.target.result instanceof ArrayBuffer) {
                    resolve(event.target.result);
                } else {
                    reject(new Error('Invalid file data.'));
                }
            };
            
            fileReader.onerror = () => {
                reject(new Error('Failed to read the file.'));
            };
            
            fileReader.readAsArrayBuffer(file);
        });
        
        try {
            let result = await extractImageByPDFJS(pdfBytes);
            this.frontImage = result.frontImage;
            this.backImage = result.backImage;
            return result;
        } catch {
            throw new Error('Failed to extract images from PDF.');
            // 无法计算图片 DPI，不符合要求
            // let result = await getImageFromPdf(pdfBytes)
            // if (result.length !== 2) {
            //     throw new Error('Expected 2 images. Got ' + result.length);
            // }
            // if (!result[0].blob || !result[1].blob) {
            //     throw new Error('No blob found');
            // }
            // this.frontImage = await getImageFromSrc(URL.createObjectURL(result[0].blob));
            // this.backImage = await getImageFromSrc(URL.createObjectURL(result[1].blob));
            // return {
            //     frontImage: this.frontImage,
            //     backImage: this.backImage
            // }
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
    setCroppedImages(croppedFront: HTMLImageElement, croppedBack: HTMLImageElement): void {
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
     * @param {HTMLImageElement} frontImage - The cropped front image canvas
     * @param {HTMLImageElement} backImage - The cropped back image canvas
     * @param {number} frontOffset - Vertical position of front image (0-50%)
     * @param {number} backOffset - Vertical position of back image (50-100%)
     * @return {string} URL for the generated PDF
     */
    generatePdf(
        frontImage: HTMLImageElement,
        backImage: HTMLImageElement,
        frontOffset: number,
        backOffset: number
    ): string {
        if (!frontImage || !backImage) {
            throw new Error('Missing cropped images.');
        }
        
        // Create new PDF using jsPDF
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'in',
            format: 'a4'
        });

        const frontImageInchWidth = frontImage.naturalWidth / frontImage.dpi;
        const frontImageInchHeight = frontImage.naturalHeight / frontImage.dpi;
        const backImageInchWidth = backImage.naturalWidth / backImage.dpi;
        const backImageInchHeight = backImage.naturalHeight / backImage.dpi;
        // Calculate positions
        const frontY = (this.a4Height * frontOffset / 100) - (frontImageInchHeight / 2);
        const backY = (this.a4Height * backOffset / 100) - (backImageInchHeight / 2);
        const frontX = (this.a4Width - frontImageInchWidth) / 2;
        const backX = (this.a4Width - backImageInchWidth) / 2;
        
        // Add images to PDF
        pdf.addImage(frontImage, 'JPEG', frontX, frontY, frontImageInchWidth, frontImageInchHeight);
        pdf.addImage(backImage, 'JPEG', backX, backY, backImageInchWidth, backImageInchHeight);
        
        // Generate and save the PDF
        const blob = pdf.output('blob');
        
        // Revoke previous URL if exists
        if (this.outputPdfUrl) {
            URL.revokeObjectURL(this.outputPdfUrl);
        }
        
        // Create new URL for download
        this.outputPdfUrl = URL.createObjectURL(blob);
        
        return this.outputPdfUrl;
    }
} 