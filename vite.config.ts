import { defineConfig } from 'vite';
export default defineConfig({
    optimizeDeps: {
        exclude: ["mupdf", "onnxruntime-web"],
        esbuildOptions: {
            target: "esnext",
        },
    },
    build: {
        target: 'esnext',
    },
}); 