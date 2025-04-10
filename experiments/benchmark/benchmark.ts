import { Bench } from 'tinybench'
import { PDFDocument } from "mupdf/mupdfjs";
import { drawPageAsPNG } from "mupdf/tasks";
import { IDCardImageProcessor } from "../../src/image-processor";
import { calculateEntropy as calculateEntropyWasm, initEntropyWasm } from "../entropy-wasm/src/entropy";

// 定义 ImageWithDPI 接口，如果它在其他地方已定义，可移除此定义
interface ImageWithDPI {
    blob: Blob;
    dpi: number;
    width: number;
    height: number;
}

async function ImageProcessorBenchmark() {
    const bench = new Bench({ 
        name: 'image processing benchmark', 
        time: 100 
    })
    const pdfBuffer = await fetch('/Scan2025-04-09_145406.pdf').then(res => res.arrayBuffer());
    const pdf = PDFDocument.openDocument(pdfBuffer);
    const image: ImageWithDPI = {
        blob: new Blob([drawPageAsPNG(pdf, 0, 600)], { type: 'image/png' }),
        dpi: 600,
        width: 600,
        height: 600
    }
    const imageProcessor = new IDCardImageProcessor();

    async function rotateImage(image: ImageWithDPI, rotation: number): Promise<ImageWithDPI> {
        // first calculate the new width and height
        const newWidth = Math.ceil(Math.abs(image.width * Math.cos(rotation * Math.PI / 180)) + Math.abs(image.height * Math.sin(rotation * Math.PI / 180)));
        const newHeight = Math.ceil(Math.abs(image.width * Math.sin(rotation * Math.PI / 180)) + Math.abs(image.height * Math.cos(rotation * Math.PI / 180)));
        const canvas = new OffscreenCanvas(newWidth, newHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create canvas context');
        }
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, newWidth, newHeight);
        ctx.save();
        ctx.translate(newWidth / 2, newHeight / 2);
        ctx.rotate(rotation * Math.PI / 180);
        ctx.drawImage(await window.createImageBitmap(image.blob), -image.width / 2, -image.height / 2, image.width, image.height);
        ctx.restore();
        return {
            blob: await canvas.convertToBlob(),
            dpi: image.dpi,
            width: newWidth,
            height: newHeight
        }
    }

    bench.add('reuse canvas', async () => {
        await imageProcessor.rotateImage(image, 45);
    }).add('create canvas', async () => {
        await rotateImage(image, 45);
    })
    await bench.run();
    console.table(bench.table());
}

// 熵计算基准测试
async function EntropyCalculationBenchmark() {
    console.log('Entropy Calculation Benchmark');
    await initEntropyWasm();

    // 创建一个大图像样本用于测试
    const width = 4819;
    const height = 6874;
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to create canvas context');
    }
    
    // 绘制测试图像
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 100; i++) {
        ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.5)`;
        ctx.fillRect(Math.random() * width, Math.random() * height, Math.random() * 300, Math.random() * 300);
    }
    
    const imageData = ctx.getImageData(0, 0, width, height);
    
    // 原始计算熵的方法
    function calculateEntropyOriginal(imageData: ImageData): number {
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
  
    // 优化 1: 使用 TypedArray 优化的熵计算方法
    function calculateEntropyTypedArray(imageData: ImageData): number {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const histogramGray = new Uint32Array(256);
        const totalPixels = width * height;
        
        // 使用整数计算加速灰度转换
        for (let i = 0; i < data.length; i += 4) {
            // 使用位运算加速灰度计算 (近似 r*0.299 + g*0.587 + b*0.114)
            // 这里使用常用近似: (r*76 + g*150 + b*30) >> 8
            const gray = ((data[i] * 76 + data[i + 1] * 150 + data[i + 2] * 30) >> 8);
            histogramGray[gray]++;
        }
        
        // 预计算 log2 值以避免重复计算
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (histogramGray[i] > 0) {
                const probability = histogramGray[i] / totalPixels;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }
    
    // 优化 2: 降采样策略
    function calculateEntropyDownsampled(imageData: ImageData, samplingRate: number = 4): number {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const histogramGray = new Uint32Array(256);
        let sampleCount = 0;
        
        // 仅处理部分像素
        for (let y = 0; y < height; y += samplingRate) {
            for (let x = 0; x < width; x += samplingRate) {
                const i = (y * width + x) * 4;
                if (i < data.length) {
                    const gray = ((data[i] * 76 + data[i + 1] * 150 + data[i + 2] * 30) >> 8);
                    histogramGray[gray]++;
                    sampleCount++;
                }
            }
        }
        
        // 计算熵
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (histogramGray[i] > 0) {
                const probability = histogramGray[i] / sampleCount;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }
    
    // 优化 3: 批处理多个像素
    function calculateEntropyBatched(imageData: ImageData, batchSize: number = 16): number {
        const data = imageData.data;
        const totalPixels = imageData.width * imageData.height;
        const histogramGray = new Uint32Array(256);
        
        // 批量处理像素
        for (let i = 0; i < data.length; i += 4 * batchSize) {
            for (let j = 0; j < batchSize * 4; j += 4) {
                if (i + j < data.length) {
                    const gray = ((data[i + j] * 76 + data[i + j + 1] * 150 + data[i + j + 2] * 30) >> 8);
                    histogramGray[gray]++;
                }
            }
        }
        
        // 计算熵
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (histogramGray[i] > 0) {
                const probability = histogramGray[i] / totalPixels;
                entropy -= probability * Math.log2(probability);
            }
        }
        
        return entropy;
    }

    // 验证各方法计算结果的一致性
    console.log('Original Result:', calculateEntropyOriginal(imageData));
    console.log('TypedArray Result:', calculateEntropyTypedArray(imageData));
    console.log('Downsampling (2x) Result:', calculateEntropyDownsampled(imageData, 2));
    console.log('Downsampling (4x) Result:', calculateEntropyDownsampled(imageData, 4));

    
    // 基准测试
    const bench = new Bench({ 
        name: 'entropy calculation benchmark', 
        time: 1000,
        iterations: 1,
        throws: true,
        warmup: false
    });
    
    bench.add('Original', () => {
        calculateEntropyOriginal(imageData);
    }).add('TypedArray', () => {
        calculateEntropyTypedArray(imageData);
    }).add('Downsampling (2x)', () => {
        calculateEntropyDownsampled(imageData, 2);
    }).add('Downsampling (4x)', () => {
        calculateEntropyDownsampled(imageData, 4);
    }).add('WebAssembly (Simulated)', () => {
        calculateEntropyWasm(imageData);
    }).addEventListener('cycle', (e) => {
        console.log(e.task?.name);
    });

    await bench.run();
    console.table(bench.table());
}

EntropyCalculationBenchmark()

