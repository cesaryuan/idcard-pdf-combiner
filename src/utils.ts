export async function getImageFromSrc(src: string) {
    const image = new Image();
    image.src = src;
    return new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => {
            resolve(image);
        }
        image.onerror = reject;
    });
}