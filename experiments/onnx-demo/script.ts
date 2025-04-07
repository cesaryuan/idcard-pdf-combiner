
import * as ort from 'onnxruntime-web';
import { Tensor, InferenceSession } from "onnxruntime-web";
import { PaddleImageDirectionDetector } from '../../src/image-processor';
import { loadImage } from '../../src/utils';

const directionDetector = new PaddleImageDirectionDetector();
const EleRunInference = document.getElementById('runInference') as HTMLButtonElement;
if (!EleRunInference) {
    throw new Error('Button element not found!');
}
const EleProgress = document.getElementById('progress') as HTMLDivElement;
if (!EleProgress) {
    throw new Error('Progress element not found!');
}

document.addEventListener('DOMContentLoaded', async () => {
    await directionDetector.init();
    EleRunInference.addEventListener('click', async () => {
        try {
            EleProgress.textContent = 'Running inference...';
            const { degree, probability } = await directionDetector.detectDirection(await loadImage('./180-2.png'));
            EleProgress.textContent = `Degree: ${degree}, Probability: ${probability}`;
            // EleProgress.textContent = 'Inference completed successfully!';
        } catch (e) {
            console.error('Error during inference:', e);
            EleProgress.textContent = 'Error during inference: ' + e.message;
        }
    });
});