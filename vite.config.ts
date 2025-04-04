import { defineConfig } from 'vite';
export default defineConfig({
    optimizeDeps: {
        exclude: ["mupdf"],
        esbuildOptions: {
            target: "esnext",
        },
    },
    build: {
        target: 'esnext',
    },
}); 