
import * as ort from 'onnxruntime-web';
import { Tensor, InferenceSession } from "onnxruntime-web";

// Initialize ONNX Runtime Web
let session: InferenceSession | null = null;
const modelPath = '../../public/models/PP-LCNet_x1_0_doc_ori_infer.onnx';
const DEGREES = [0, 90, 180, 270]; // Rotation degrees
const EleRunInference = document.getElementById('runInference') as HTMLButtonElement;
if (!EleRunInference) {
    throw new Error('Button element not found!');
}
const EleProgress = document.getElementById('progress') as HTMLDivElement;
if (!EleProgress) {
    throw new Error('Progress element not found!');
}

// Initialize the ONNX Runtime Session
async function initOnnxSession() {
    try {
        EleProgress.textContent = 'Loading ONNX model...';
        session = await ort.InferenceSession.create(modelPath);
        EleProgress.textContent = 'Model loaded successfully!';
        EleRunInference.disabled = false;
    } catch (e) {
        console.error('Failed to create ONNX Session:', e);
        EleProgress.textContent = 'Error loading model: ' + e.message;
    }
}

// Run inference
async function runInference(imageTensor: Tensor): Promise<{"softmax_0.tmp_0": Tensor}> {
    try {
        if (!session) {
            throw new Error('ONNX session not initialized!');
        }
        const results = await session.run({
            'x': imageTensor
        });
        return results as {"softmax_0.tmp_0": Tensor};
    } catch (e) {
        console.error('Failed to run inference:', e);
        throw e;
    }
}

async function urlToImageData(url: string): Promise<ImageData> {
    const canvas = new OffscreenCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context!');
    }
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve();
        };
        img.onerror = (err) => reject(err);
    });
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

document.addEventListener('DOMContentLoaded', () => {
    initOnnxSession();
    EleRunInference.addEventListener('click', async () => {
        try {
            EleProgress.textContent = 'Running inference...';
            const imageData = await urlToImageData('./degree_180.png');
            const tensor = await ort.Tensor.fromImage(imageData, {
                resizedWidth: 224,
                resizedHeight: 224,
            });
            const results = await runInference(tensor);
            const data = results['softmax_0.tmp_0'].data as Float32Array;
            const classIdx = data.findIndex((value: number) => value === Math.max(...data));
            const classProb = data[classIdx];
            EleProgress.textContent = `Class: ${DEGREES[classIdx]}, Probability: ${classProb}`;
            console.log('Inference results:', results);
            // EleProgress.textContent = 'Inference completed successfully!';
        } catch (e) {
            console.error('Error during inference:', e);
            EleProgress.textContent = 'Error during inference: ' + e.message;
        }
    });
});