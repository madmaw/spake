// Generates the PWA icons in public/ by rendering the app's speech-bubble
// motif in headless Chromium. Run with: pnpm data:icons
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../public");

// keep in sync with src/components/SpeechBubbleIcon.tsx
const BUBBLE_SVG = `<svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <rect fill="#ffd166" height="32" rx="16" width="42" x="3" y="3" />
    <path d="M13 30 L8 45 L27 33 Z" fill="#ffd166" />
    <circle cx="15" cy="19" fill="#0b0e17" r="3.4" />
    <circle cx="24" cy="19" fill="#0b0e17" r="3.4" />
    <circle cx="33" cy="19" fill="#0b0e17" r="3.4" />
</svg>`;

function iconHtml(size, glyphRatio) {
    const glyph = Math.round(size * glyphRatio);
    return `<!doctype html><html><body style="margin:0">
        <div style="width:${size}px;height:${size}px;background:#0b0e17;display:flex;align-items:center;justify-content:center">
            <div style="width:${glyph}px;height:${glyph}px">${BUBBLE_SVG}</div>
        </div>
    </body></html>`;
}

const browser = await chromium.launch();

async function render(size, glyphRatio, file) {
    const page = await browser.newPage({
        deviceScaleFactor: 1,
        viewport: { height: size, width: size },
    });
    await page.setContent(iconHtml(size, glyphRatio));
    const buffer = await page.screenshot();
    await page.close();
    writeFileSync(join(PUBLIC, file), buffer);
    console.warn(`wrote public/${file}`);
}

await render(512, 0.62, "icon-512.png");
await render(192, 0.62, "icon-192.png");
// maskable icons get cropped to a circle/squircle, so keep the glyph small
await render(512, 0.5, "maskable-512.png");
await render(180, 0.62, "apple-touch-icon.png");
await browser.close();
