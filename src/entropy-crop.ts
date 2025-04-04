/**
 * Entropy Cropping Implementation
 * This file contains the logic for automatic cropping of ID card images based on entropy
 */

export class EntropyCropper {
    private canvas: OffscreenCanvas;
    private ctx: OffscreenCanvasRenderingContext2D | null;

    constructor() {
        this.canvas = new OffscreenCanvas(0, 0);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    /**
     * Calculate the entropy of an image region
     * @param {ImageData} imageData - The image data to analyze
     * @return {number} - The calculated entropy value
     */
    calculateEntropy(imageData: ImageData): number {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const histogramGray = new Array(256).fill(0);
        const totalPixels = width * height;
        
        // Calculate grayscale histogram
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Convert RGB to grayscale using standard formula
            const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
            histogramGray[gray]++;
        }
        
        // Calculate entropy using Shannon entropy formula
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (histogramGray[i] > 0) {
                const probability = histogramGray[i] / totalPixels;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }

    /**
     * Find the optimal crop region based on entropy
     * @param image - The image to analyze
     * @param threshold - Threshold value (0-1) for determining crop boundaries
     * @return The crop region with x, y, width, height
     */
    async findCropRegion(image: ImageWithDPI, threshold: number = 0.5): Promise<{ x: number; y: number; width: number; height: number }> {
        const width = image.width;
        const height = image.height;
        
        // Resize canvas to match image dimensions
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Draw image on canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, width, height);
            this.ctx.drawImage(await window.createImageBitmap(image.blob), 0, 0, width, height);
            
            // Calculate entropy for rows and columns
            const rowEntropy = new Array(height).fill(0);
            const colEntropy = new Array(width).fill(0);
            
            // Calculate entropy for each row
            for (let y = 0; y < height; y++) {
                const rowData = this.ctx.getImageData(0, y, width, 1);
                rowEntropy[y] = this.calculateEntropy(rowData);
            }
            
            // Calculate entropy for each column
            for (let x = 0; x < width; x++) {
                const colData = this.ctx.getImageData(x, 0, 1, height);
                colEntropy[x] = this.calculateEntropy(colData);
            }
            
            // Normalize entropy values
            const maxRowEntropy = Math.max(...rowEntropy);
            const maxColEntropy = Math.max(...colEntropy);
            
            const normalizedRowEntropy = rowEntropy.map(e => e / maxRowEntropy);
            const normalizedColEntropy = colEntropy.map(e => e / maxColEntropy);
            
            // Find crop boundaries based on threshold
            let top = 0;
            let bottom = height - 1;
            let left = 0;
            let right = width - 1;
            
            // Find top boundary
            for (let y = 0; y < height; y++) {
                if (normalizedRowEntropy[y] > threshold) {
                    top = y;
                    break;
                }
            }
            
            // Find bottom boundary
            for (let y = height - 1; y >= 0; y--) {
                if (normalizedRowEntropy[y] > threshold) {
                    bottom = y;
                    break;
                }
            }
            
            // Find left boundary
            for (let x = 0; x < width; x++) {
                if (normalizedColEntropy[x] > threshold) {
                    left = x;
                    break;
                }
            }
            
            // Find right boundary
            for (let x = width - 1; x >= 0; x--) {
                if (normalizedColEntropy[x] > threshold) {
                    right = x;
                    break;
                }
            }
            
            return {
                x: left,
                y: top,
                width: right - left + 1,
                height: bottom - top + 1
            };
        }
        
        // Fallback if context is null
        return {
            x: 0,
            y: 0,
            width: width,
            height: height
        };
    }

    async rotateImage(image: ImageWithDPI, rotation: number): Promise<ImageWithDPI> {
        // first calculate the new width and height
        const newWidth = Math.ceil(Math.abs(image.width * Math.cos(rotation * Math.PI / 180)) + Math.abs(image.height * Math.sin(rotation * Math.PI / 180)));
        const newHeight = Math.ceil(Math.abs(image.width * Math.sin(rotation * Math.PI / 180)) + Math.abs(image.height * Math.cos(rotation * Math.PI / 180)));
        this.canvas.width = newWidth;
        this.canvas.height = newHeight;
        if (!this.ctx) {
            throw new Error('Failed to create canvas context');
        }
        this.ctx.clearRect(0, 0, newWidth, newHeight);
        this.ctx.save();
        this.ctx.translate(newWidth / 2, newHeight / 2);
        this.ctx.rotate(rotation * Math.PI / 180);
        this.ctx.drawImage(await window.createImageBitmap(image.blob), -image.width / 2, -image.height / 2, image.width, image.height);
        this.ctx.restore();
        return {
            blob: await this.canvas.convertToBlob(),
            dpi: image.dpi,
            width: newWidth,
            height: newHeight
        }
    }

    /**
     * Crop an image based on entropy
     * @param {ImageWithDPI} image - The image to crop
     * @param {Object} options - The options for cropping
     * @param {number} options.threshold - Threshold value (0-1) for determining crop boundaries
     * @param {number} options.padding - Padding to add around the crop region
     * @param {number} options.rotation - Rotation angle for the image (0-360)
     * @return {ImageWithDPI} - Image containing the cropped image
     */
    async rotateAndCropImage(image: ImageWithDPI, {
        threshold = 0.5,
        padding = 10,
        rotation = 0
    }: {
        threshold?: number,
        padding?: number,
        rotation?: number
    }): Promise<ImageWithDPI> {
        // rotate image
        image = await this.rotateImage(image, rotation);
        // Find crop region
        const region = await this.findCropRegion(image, threshold);
        
        // Apply padding
        region.x = Math.max(0, region.x - padding);
        region.y = Math.max(0, region.y - padding);
        region.width = Math.min(image.width - region.x, region.width + (padding * 2));
        region.height = Math.min(image.height - region.y, region.height + (padding * 2));
        
        // Create a new canvas for the cropped result
        this.canvas.width = region.width;
        this.canvas.height = region.height;
        
        // Draw the cropped region
        if (this.ctx) {
            this.ctx.clearRect(0, 0, region.width, region.height);
            this.ctx.drawImage(
                await window.createImageBitmap(image.blob),
                region.x, region.y, region.width, region.height,
                0, 0, region.width, region.height
            );
        }
        return {
            blob: await this.canvas.convertToBlob(),
            dpi: image.dpi,
            width: region.width,
            height: region.height
        }
    }
} 