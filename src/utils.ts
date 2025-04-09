export async function getImageFromBlob(blob: Blob) {
    const image = new Image();
    image.src = URL.createObjectURL(blob);
    image.onload = () => {
        URL.revokeObjectURL(image.src);
    }
    return image;
}

// show image in dialog
export async function showImage(image: ImageWithDPI) {
    const blob = new Blob([image.blob], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const dialog = document.createElement('dialog');
    dialog.style.maxWidth = '90%';
    dialog.style.maxHeight = '80vh';
    dialog.innerHTML = `
        <div style="position: relative;">
            <button style="position: absolute; top: 5px; right: 5px; background: #f44336; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">×</button>
            <img src="${url}" style="max-width: 100%; max-height: 70vh; display: block; background-color: black;" />
        </div>
    `;
    document.body.appendChild(dialog);
    dialog.querySelector('img')?.addEventListener('load', () => {
        URL.revokeObjectURL(url);
    });
    dialog.show();
    
    // Add event listener to close button
    const closeButton = dialog.querySelector('button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            dialog.close();
            URL.revokeObjectURL(url);
            dialog.remove();
        });
    }
}

export async function resizeShortSide(image: ImageWithDPI, shortSide: number): Promise<ImageWithDPI> {
    const scale = shortSide / Math.min(image.width, image.height);
    const scaledWidth = Math.round(image.width * scale);
    const scaledHeight = Math.round(image.height * scale);
    const canvas = new OffscreenCanvas(scaledWidth, scaledHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to create canvas context');
    }
    ctx.drawImage(await createImageBitmap(image.blob), 0, 0, canvas.width, canvas.height);
    return {
        blob: await canvas.convertToBlob(),
        width: scaledWidth,
        height: scaledHeight,
        dpi: image.dpi * scale
    }
}

export async function cropImage(image: ImageWithDPI, size: number): Promise<ImageWithDPI> {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to create canvas context');
    }
    const centerX = image.width / 2;
    const centerY = image.height / 2;
    const startX = centerX - size / 2;
    const startY = centerY - size / 2;
    ctx.drawImage(await createImageBitmap(image.blob), startX, startY, size, size);
    return {
        blob: await canvas.convertToBlob(),
        width: size,
        height: size,
        dpi: image.dpi
    }
}

export async function loadImage(url: string): Promise<ImageWithDPI> {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = reject;
    });
    return {
        blob: await fetch(url).then(res => res.blob()),
        width: image.width,
        height: image.height,
        dpi: 96
    }
}

export class Finally {
    private cleanup: () => void;

    constructor(cleanup: () => void) {
        this.cleanup = cleanup;
    }
    [Symbol.dispose]() {
        this.cleanup();
    }
}