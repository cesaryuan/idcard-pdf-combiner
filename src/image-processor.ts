import * as ort from 'onnxruntime-web';
import { cropImage, resizeShortSide } from './utils';

export class PaddleImageDirectionDetector {
    private static readonly DEGREES = [0, 90, 180, 270];
    private session: ort.InferenceSession | null = null;
    private static readonly modelPath: string = '/models/PP-LCNet_x1_0_doc_ori_infer.onnx';

    constructor() {
    }

    async init() {
        if (this.session) {
            return;
        }
        this.session = await ort.InferenceSession.create(PaddleImageDirectionDetector.modelPath);
    }

    async blobToImageData(blob: Blob): Promise<ImageData> {
        const bitmap = await window.createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create canvas context');
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    /**
     * Detect the direction of the image
     * @param image - The image to detect the direction of
     * @return The direction of the image (0, 90, 180, 270)
     */
    async detectDirection(image: ImageWithDPI): Promise<{ degree: number; probability: number }> {
        if (!this.session) {
            throw new Error('Onnx session not initialized');
        }
        // If not add resize and crop, only add resizedWidth and resizedHeight in fromImage,
        // the actual input image to the model will only be the top-left corner of the original image,
        // if the original image is large, the input image will not have the main elements.
        image = await resizeShortSide(image, 256);
        image = await cropImage(image, 224);

        const imageData = await this.blobToImageData(image.blob);
        const tensor = await ort.Tensor.fromImage(imageData);
        const results = await this.session.run({
            'x': tensor
        });
        const data = results['softmax_0.tmp_0'].data as Float32Array;
        const classIdx = data.findIndex((value: number) => value === Math.max(...data));
        return {
            degree: PaddleImageDirectionDetector.DEGREES[classIdx],
            probability: Math.max(...data)
        };
    }
}

export class IDCardImageProcessor {
    private static directionDetector: PaddleImageDirectionDetector | null = null;
    private canvas: OffscreenCanvas;
    private ctx: OffscreenCanvasRenderingContext2D | null;

    constructor() {
        this.canvas = new OffscreenCanvas(0, 0);
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    }

    async init() {
        if (!IDCardImageProcessor.directionDetector) {
            IDCardImageProcessor.directionDetector = new PaddleImageDirectionDetector();
            await IDCardImageProcessor.directionDetector.init();
        }
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
        this.ctx.fillStyle = 'white';
        this.ctx.fillRect(0, 0, newWidth, newHeight);
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
     * Deskew the image using the Hough transform
     * @param image
     * @link https://github.com/cyanfish/naps2/blob/master/NAPS2.Sdk/Images/Deskewer.cs
     */
    async deskew(image: ImageWithDPI): Promise<ImageWithDPI> {
        // Constants for deskew algorithm
        const ANGLE_MIN = -45;
        const ANGLE_MAX = 45;
        const ANGLE_STEPS = 45 * 10 + 1; // 0.2 degree step size
        const BEST_MAX_COUNT = 100;
        const BEST_THRESHOLD_INDEX = 9;
        const BEST_THRESHOLD_FACTOR = 0.5;
        const CLUSTER_TARGET_SPREAD = 2.01;
        const IGNORE_EDGE_FRACTION = 0.01;

        // Resize canvas to match image dimensions
        this.canvas.width = image.width;
        this.canvas.height = image.height;

        if (!this.ctx) {
            throw new Error('Failed to create canvas context');
        }

        // Draw image on canvas
        this.ctx.clearRect(0, 0, image.width, image.height);
        this.ctx.drawImage(await window.createImageBitmap(image.blob), 0, 0, image.width, image.height);

        // Get image data for processing
        const imageData = this.ctx.getImageData(0, 0, image.width, image.height);
        const data = imageData.data;

        // Create bitmap representation (true for black, false for white)
        const bitmap: boolean[][] = [];
        for (let y = 0; y < image.height; y++) {
            bitmap[y] = [];
            for (let x = 0; x < image.width; x++) {
                const offset = (y * image.width + x) * 4;
                const r = data[offset];
                const g = data[offset + 1];
                const b = data[offset + 2];
                // Convert to grayscale and threshold
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                bitmap[y][x] = gray < 128; // true for dark pixels
            }
        }

        // Precalculate sin/cos values
        const sinCos = new Array(ANGLE_STEPS);
        const angleStepSize = (ANGLE_MAX - ANGLE_MIN) / (ANGLE_STEPS - 1);
        for (let i = 0; i < ANGLE_STEPS; i++) {
            const angle = (ANGLE_MIN + angleStepSize * i) * Math.PI / 180.0;
            sinCos[i] = {
                sin: Math.sin(angle),
                cos: Math.cos(angle)
            };
        }

        // Initialize scores array
        const h = image.height;
        const w = image.width;
        const yOffset = Math.round(h * IGNORE_EDGE_FRACTION);
        const dCount = 2 * (w + h);
        const scores: number[][] = new Array(dCount);
        for (let d = 0; d < dCount; d++) {
            scores[d] = new Array(ANGLE_STEPS).fill(0);
        }

        // Find bottom edges of dark areas and calculate Hough transform
        for (let y = 1 + yOffset; y <= h - 2 - yOffset; y++) {
            for (let x = 1; x <= w - 2; x++) {
                if (bitmap[y][x] && !bitmap[y + 1][x]) {
                    for (let i = 0; i < ANGLE_STEPS; i++) {
                        const sc = sinCos[i];
                        const d = Math.floor(y * sc.cos - x * sc.sin + w);
                        if (d >= 0 && d < dCount) {
                            scores[d][i]++;
                        }
                    }
                }
            }
        }

        // Find angles of best lines
        const best: { angleIndex: number, count: number }[] = new Array(BEST_MAX_COUNT);
        for (let i = 0; i < BEST_MAX_COUNT; i++) {
            best[i] = { angleIndex: 0, count: 0 };
        }

        for (let i = 0; i < dCount; i++) {
            for (let angleIndex = 0; angleIndex < ANGLE_STEPS; angleIndex++) {
                const count = scores[i][angleIndex];
                if (count > best[BEST_MAX_COUNT - 1].count) {
                    best[BEST_MAX_COUNT - 1] = { angleIndex, count };
                    for (let j = BEST_MAX_COUNT - 2; j >= 0; j--) {
                        if (count > best[j].count) {
                            [best[j], best[j + 1]] = [best[j + 1], best[j]];
                        }
                    }
                }
            }
        }

        // Skip "insignificant" lines
        const threshold = Math.floor(best[BEST_THRESHOLD_INDEX].count * BEST_THRESHOLD_FACTOR);
        const bestWithinThreshold = best.filter(x => x.count >= threshold);

        // Calculate actual angles
        const angles = bestWithinThreshold.map(x => ANGLE_MIN + angleStepSize * x.angleIndex);

        // Cluster angles
        const sortedAngles = [...angles].sort((a, b) => a - b);
        let largestCluster = 0;
        let largestClusterIndex = 0;

        for (let i = 0; i < sortedAngles.length; i++) {
            let clusterSize = 0;
            for (let j = i; j < sortedAngles.length; j++) {
                if (sortedAngles[j] < sortedAngles[i] + CLUSTER_TARGET_SPREAD) {
                    clusterSize++;
                } else {
                    break;
                }
            }

            if (clusterSize > largestCluster) {
                largestCluster = clusterSize;
                largestClusterIndex = i;
            }
        }

        // Create cluster
        const cluster: number[] = [];
        for (let i = largestClusterIndex; i < sortedAngles.length; i++) {
            if (sortedAngles[i] < sortedAngles[largestClusterIndex] + CLUSTER_TARGET_SPREAD) {
                cluster.push(sortedAngles[i]);
            } else {
                break;
            }
        }

        // If we couldn't find a consistent skew angle, return the original image
        if (cluster.length < angles.length / 2) {
            return image;
        }

        // Calculate the average angle in the cluster
        const skewAngle = cluster.reduce((sum, angle) => sum + angle, 0) / cluster.length;

        console.log(`Skew angle: ${skewAngle}`);
        // Rotate image by negative skew angle to correct it
        return this.rotateImage(image, -skewAngle);
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
        if (!IDCardImageProcessor.directionDetector) {
            throw new Error('Direction detector not initialized');
        }
        // rotate image
        image = await this.deskew(image);
        const { degree } = await IDCardImageProcessor.directionDetector.detectDirection(image);
        if (rotation + degree !== 0) {
            image = await this.rotateImage(image, rotation + degree);
        }
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
            blob: await this.canvas.convertToBlob({
                type: 'image/jpeg',
                quality: 0.95
            }),
            dpi: image.dpi,
            width: region.width,
            height: region.height
        }
    }
} 