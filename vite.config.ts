import { defineConfig } from 'vite';
import wasm from "vite-plugin-wasm";

export default defineConfig({
    plugins: [wasm()],
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