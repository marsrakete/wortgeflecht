const fs = require("node:fs/promises");
const path = require("node:path");
const { Resvg } = require("@resvg/resvg-js");
const sharp = require("sharp");

const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 630;

/** Liefert das Projektverzeichnis für reproduzierbare Pfadauflösung. @returns {string} Absoluter Projektpfad. */
function getRootDirectory() {
  return path.resolve(__dirname, "..");
}

/** Liest die Open-Graph-Konfiguration. @param {string} rootDirectory Projektpfad. @returns {Promise<object>} Konfiguration. */
async function readConfig(rootDirectory) {
  const configPath = path.join(rootDirectory, "config", "og-image.config.json");
  return JSON.parse(await fs.readFile(configPath, "utf8"));
}

/** Rendert die SVG-Quelle in den kanonischen PNG-Puffer. @param {string} svg SVG-Text. @param {object} render Renderoptionen. @returns {Buffer} PNG-Daten. */
function renderSvg(svg, render) {
  const width = Number(render.width) || DEFAULT_WIDTH;
  const background = render.background || "rgba(255,255,255,0)";
  const renderer = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: render.loadSystemFonts !== false },
    background,
  });
  return renderer.render().asPng();
}

/** Prüft die konfigurierte Bildgröße. @param {Buffer} png PNG-Daten. @param {object} render Renderoptionen. @returns {Promise<void>} Erfolgreiche Prüfung. */
async function verifySize(png, render) {
  const metadata = await sharp(png).metadata();
  const width = Number(render.width) || DEFAULT_WIDTH;
  const height = Number(render.height) || DEFAULT_HEIGHT;
  if (metadata.width !== width || metadata.height !== height) {
    throw new Error(`Unerwartete OG-Größe: ${metadata.width}x${metadata.height}, erwartet ${width}x${height}`);
  }
}

/** Schreibt ein konfiguriertes PNG- oder JPEG-Ziel. @param {string} rootDirectory Projektpfad. @param {object} output Ausgabeoptionen. @param {Buffer} png PNG-Daten. @returns {Promise<void>} Abgeschriebene Datei. */
async function writeOutput(rootDirectory, output, png) {
  const target = path.join(rootDirectory, output.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (output.format === "png") {
    await fs.writeFile(target, png);
    return;
  }
  if (output.format === "jpeg" || output.format === "jpg") {
    await sharp(png).flatten({ background: "#0b1020" }).jpeg({ quality: output.quality || 92, mozjpeg: true }).toFile(target);
    return;
  }
  throw new Error(`Nicht unterstütztes Format: ${output.format}`);
}

/** Baut alle konfigurierten Open-Graph-Bilder aus der SVG-Quelle. @returns {Promise<void>} Erfolgreicher Build. */
async function main() {
  const rootDirectory = getRootDirectory();
  const config = await readConfig(rootDirectory);
  const svg = await fs.readFile(path.join(rootDirectory, config.source), "utf8");
  const png = renderSvg(svg, config.render || {});
  await verifySize(png, config.render || {});
  for (const output of config.outputs || []) {
    await writeOutput(rootDirectory, output, png);
  }
  process.stdout.write(`Open-Graph-Bilder aus ${config.source} gebaut.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
