// Renders the Dharma Radio brand mark into favicon + PWA icons.
// Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const paper = "#f6f1e9";
const ink = "#231b14";
const accent = "#bd6526";

const mark = (stroke) => `
  <circle cx="16" cy="16" r="15" fill="${accent}" opacity="0.14"/>
  <path d="M8 19a8 8 0 0 1 16 0Z" fill="${accent}"/>
  <path d="M5 19h22M9 23h14M13 27h6" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round"/>`;

// Adapts to the browser tab's colour scheme.
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>.l{stroke:${ink}}@media (prefers-color-scheme:dark){.l{stroke:#eee7db}}</style>
  <circle cx="16" cy="16" r="15" fill="${accent}" opacity="0.18"/>
  <path d="M8 19a8 8 0 0 1 16 0Z" fill="${accent}"/>
  <path class="l" d="M5 19h22M9 23h14M13 27h6" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;

/** Full-bleed tile; `inset` keeps the mark inside the maskable safe zone. */
const tile = (inset, radius = 0) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${paper}"/>
  <g transform="translate(${inset} ${inset}) scale(${(32 - inset * 2) / 32})">${mark(ink)}</g>
</svg>`;

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

await mkdir("public/icons", { recursive: true });
await writeFile("public/favicon.svg", favicon);
await writeFile("public/icons/icon-192.png", await png(tile(3), 192));
await writeFile("public/icons/icon-512.png", await png(tile(3), 512));
await writeFile("public/icons/maskable-512.png", await png(tile(7), 512));
await writeFile("public/apple-touch-icon.png", await png(tile(4), 180));
await writeFile("public/favicon-96x96.png", await png(tile(1, 7), 96));
// Browsers accept PNG-encoded .ico files.
await writeFile("public/favicon.ico", await png(tile(1, 7), 48));
console.log("icons written");
