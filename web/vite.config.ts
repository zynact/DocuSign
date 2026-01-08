import {defineConfig} from 'vite'
import path from "path"
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],

    build: {
       minify: "oxc",
       outDir: "../static"
    },

    server: {
        allowedHosts: ["prescribed-consensus-smile-maria.trycloudflare.com"]
    },

    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
})
