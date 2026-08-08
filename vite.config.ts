import babel from "@rolldown/plugin-babel";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { patchCssModules } from "vite-css-modules";
import { VitePWA } from "vite-plugin-pwa";

// speechSynthesis requires a secure context, and only https qualifies when the
// dev server is opened from another device (e.g. a phone on the same network).
// Vitest drives its browser tests through this config too, and playwright
// rejects the self-signed certificate, so tests stay on http.
const useHttps = process.env.VITEST == null;

// simplified from the compass web createReactMobxLinguiViteConfig factory:
// no lingui, no mobx decorators, no env-variable injection, no proxies
export default defineConfig({
    appType: "spa",
    // GitHub Pages serves the app from /spake/; the deploy workflow sets this
    base: process.env.BASE_PATH ?? "/",
    build: {
        sourcemap: true,
    },
    css: {
        modules: {
            generateScopedName: "[path][name]_[local]",
        },
    },
    plugins: [
        useHttps && basicSsl(),
        react(),
        babel({
            plugins: [
                [
                    "@babel/plugin-transform-typescript",
                    { allExtensions: true, isTSX: true },
                ],
            ],
            presets: [reactCompilerPreset()],
        }),
        patchCssModules(),
        VitePWA({
            includeAssets: ["apple-touch-icon.png"],
            manifest: {
                background_color: "#0b0e17",
                description:
                    "A speaking aid: chain sentences together from a radial word cloud, spoken aloud as you go",
                display: "standalone",
                icons: [
                    {
                        sizes: "192x192",
                        src: "icon-192.png",
                        type: "image/png",
                    },
                    {
                        sizes: "512x512",
                        src: "icon-512.png",
                        type: "image/png",
                    },
                    {
                        purpose: "maskable",
                        sizes: "512x512",
                        src: "maskable-512.png",
                        type: "image/png",
                    },
                ],
                name: "spake",
                short_name: "spake",
                theme_color: "#0b0e17",
            },
            registerType: "autoUpdate",
            workbox: {
                globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
                // the bigram data makes the main chunk larger than the
                // default 2 MB precache limit
                maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
            },
        }),
    ],
    preview: {
        host: true,
        port: 3000,
    },
    resolve: {
        alias: {
            "@tabler/icons-react":
                "@tabler/icons-react/dist/esm/icons/index.mjs",
        },
        tsconfigPaths: true,
    },
    server: {
        // expose on the local network so phones/tablets can use the app
        host: true,
        port: 3000,
    },
});
