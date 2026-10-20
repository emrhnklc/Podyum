import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";

// Görselin sade geometrisini SVG kaynak olarak koruruz. Üretilen PNG'ler
// depodadır; normal mobil kurulum/derleme bu betiği çalıştırmayı gerektirmez.
const require = createRequire(
  new URL("../../backend/package.json", import.meta.url),
);
const sharp = require("sharp");
const directory = new URL("../assets/brand/", import.meta.url);
await mkdir(directory, { recursive: true });
const logo = await readFile(new URL("logo.svg", directory), "utf8");
const foreground = logo
  .replace(/\s*<rect id="tile"[^>]*\/>/, "")
  .replace(
    '<g id="mark">',
    '<g id="mark" transform="translate(28.16 28.16) scale(0.78)">',
  );
const assets = [
  ["logo.png", logo, 512],
  ["icon.png", logo.replace('rx="64"', 'rx="0"'), 1024],
  ["adaptive-icon.png", foreground, 1024],
  [
    "monochrome-icon.png",
    foreground.replace('fill="#ED8295"', 'fill="#FFFFFF"'),
    1024,
  ],
  ["splash-logo.png", logo, 512],
  ["favicon.png", logo, 64],
];
for (const [name, source, size] of assets) {
  let image = sharp(Buffer.from(source)).resize(size, size);
  if (name === "icon.png")
    image = image.flatten({ background: "#D90B2D" }).removeAlpha();
  await image.png().toFile(new URL(name, directory).pathname);
  console.log(`${name}: ${size} × ${size}`);
}
