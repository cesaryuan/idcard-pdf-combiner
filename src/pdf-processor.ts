/**
 * PDF Processor for ID Card PDF Merger
 * Handles PDF loading, image extraction, and PDF generation
 */

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';

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
    processPdf(file: File): Promise<PDFImages> {
        return new Promise((resolve, reject) => {
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
                
                let typedArray;
                if (event.target.result instanceof ArrayBuffer) {
                    typedArray = new Uint8Array(event.target.result);
                } else {
                    reject(new Error('Invalid file data.'));
                    return;
                }
                
                // Load PDF using PDF.js
                pdfjsLib.getDocument(typedArray).promise
                    .then((pdf) => {
                        if (pdf.numPages !== 2) {
                            reject(new Error(`Expected a 2-page PDF, but got ${pdf.numPages} pages.`));
                            return;
                        }
                        
                        // Get both pages
                        const frontPagePromise = pdf.getPage(1);
                        const backPagePromise = pdf.getPage(2);
                        
                        return Promise.all([frontPagePromise, backPagePromise]);
                    })
                    .then((pages) => {
                        if (!pages) return;
                        
                        const [frontPage, backPage] = pages;
                        
                        // Extract images from both pages
                        return Promise.all([
                            this.extractImageFromPage(frontPage),
                            this.extractImageFromPage(backPage)
                        ]);
                    })
                    .then((images) => {
                        if (!images) return;
                        
                        const [frontImg, backImg] = images;
                        this.frontImage = frontImg;
                        this.backImage = backImg;
                        
                        resolve({
                            frontImage: this.frontImage,
                            backImage: this.backImage
                        });
                    })
                    .catch((error) => {
                        reject(error);
                    });
            };
            
            fileReader.onerror = () => {
                reject(new Error('Failed to read the file.'));
            };
            
            fileReader.readAsArrayBuffer(file);
        });
    }
    
    /**
     * Extract image from a PDF page
     * @param page - The PDF page object from PDF.js
     * @return {Promise<HTMLImageElement>} - Promise resolving to the extracted image
     */
    private extractImageFromPage(page: pdfjsLib.PDFPageProxy): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const scale = 4.0; // Higher scale for better quality
            const viewport = page.getViewport({ scale });
            
            // Create canvas for rendering
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const context = canvas.getContext('2d');
            if (!context) {
                reject(new Error('Failed to create canvas context.'));
                return;
            }
            
            // Render PDF page to canvas
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            page.render(renderContext).promise
                .then(() => {
                    // Convert canvas to image
                    const image = new Image();
                    
                    image.onload = () => {
                        image.dpi = image.naturalWidth / this.getPageSizeInches(page).width;
                        resolve(image);
                    };
                    image.onerror = () => reject(new Error('Failed to convert canvas to image.'));
                    image.src = canvas.toDataURL('image/png');
                })
                .catch(reject);
        });
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

    /**
     * Gets the size of the specified page, converted from PDF units to inches.
     * @param params
     */
    getPageSizeInches({ view, userUnit, rotate }: { view: number[], userUnit: number, rotate: number }) {
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
} 