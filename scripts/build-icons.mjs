// Generates the PWA icons in public/ by rendering the app's gold "dots"
// motif in headless Chromium. Run with: pnpm data:icons
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "../public");

function iconHtml(size, glyphRatio) {
    const glyph = Math.round(size * glyphRatio);
    const dot = Math.round(glyph * 0.13);
    const gap = Math.round(glyph * 0.09);
    const dots = `<span style="width:${dot}px;height:${dot}px;background:#0b0e17;border-radius:50%"></span>`;
    return `<!doctype html><html><body style="margin:0">
        <div style="width:${size}px;height:${size}px;background:#0b0e17;display:flex;align-items:center;justify-content:center">
            <div style="width:${glyph}px;height:${glyph}px;background:#ffd166;border-radius:50%;display:flex;align-items:center;justify-content:center;gap:${gap}px">
                ${dots}${dots}${dots}
            </div>
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
