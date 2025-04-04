export async function getImageFromBlob(blob: Blob) {
    const image = new Image();
    image.src = URL.createObjectURL(blob);
    image.onload = () => {
        URL.revokeObjectURL(image.src);
    }
    return image;
}

// show image in dialog
export async function showImage(image: Uint8Array) {
    const blob = new Blob([image], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    const dialog = document.createElement('dialog');
    dialog.style.maxWidth = '90%';
    dialog.style.maxHeight = '80vh';
    dialog.innerHTML = `
        <div style="position: relative;">
            <button style="position: absolute; top: 5px; right: 5px; background: #f44336; color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-weight: bold;">×</button>
            <img src="${url}" style="max-width: 100%; max-height: 70vh; display: block;" />
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

export class Finally {
    private cleanup: () => void;

    constructor(cleanup: () => void) {
        this.cleanup = cleanup;
    }
    [Symbol.dispose]() {
        this.cleanup();
    }
}