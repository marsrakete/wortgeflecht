import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

/** Prüft rekursiv die JavaScript-Syntax ohne Abhängigkeiten oder Git-Dateien. @param {string} directory Projektverzeichnis. @returns {void} Wirft bei Syntaxfehlern. */
function checkDirectory(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["node_modules", ".git", "test-results", "playwright-report"].includes(entry.name)) {
      continue;
    }
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      checkDirectory(file);
    } else if (entry.name.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
    }
  }
}

checkDirectory(".");
const html = readFileSync("index.html", "utf8");
const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/u)[1]);
assert.equal(importMap.imports.three, "./vendor/three/build/three.module.js", "Three.js muss lokal eingebunden sein");
assert.equal(importMap.imports["three/addons/"], "./vendor/three/examples/jsm/", "Three.js-Erweiterungen müssen lokal eingebunden sein");
assert.ok(existsSync("vendor/three/build/three.module.js"), "Lokales Three.js fehlt");
assert.ok(existsSync("vendor/three/build/three.core.js"), "Lokaler Three.js-Kern fehlt");
assert.ok(existsSync("vendor/three/examples/jsm/controls/OrbitControls.js"), "Lokale OrbitControls fehlen");
assert.ok(existsSync("vendor/three/examples/jsm/renderers/CSS2DRenderer.js"), "Lokaler CSS2DRenderer fehlt");
assert.ok(existsSync("sw.js"), "Service Worker fehlt");
assert.ok(existsSync("version.js"), "Zentrale Versionsquelle fehlt");
const serviceWorker = readFileSync("sw.js", "utf8");
assert.ok(serviceWorker.includes("self.skipWaiting()"), "Service Worker aktiviert Updates nicht sofort");
assert.ok(html.includes("registration.update()"), "App prüft Service-Worker-Updates nicht");
assert.ok(html.includes("controllerchange"), "App reagiert nicht auf neue Service-Worker-Versionen");
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/gu)) {
  assert.ok(existsSync(match[1]), `Fehlende HTML-Ressource: ${match[1]}`);
}
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
for (const icon of manifest.icons) {
  assert.ok(existsSync(icon.src), `Fehlendes Icon: ${icon.src}`);
}
assert.ok(existsSync("assets/wortgeflecht-og.svg"), "Fehlende Open-Graph-SVG-Quelle");
assert.ok(existsSync("assets/wortgeflecht-og.png"), "Fehlendes Open-Graph-PNG");
assert.ok(existsSync("og-image.jpg"), "Fehlendes Open-Graph-JPEG");
assert.ok(html.includes('property="og:image"'), "Open-Graph-Bildmetadaten fehlen");
assert.ok(html.includes('name="twitter:card"'), "Twitter-Card-Metadaten fehlen");
console.log("Syntax, lokale Ressourcen und Three.js-Versionen geprüft.");
const readme = readFileSync("README.md", "utf8");
for (const match of readme.matchAll(/\]\(([^)]+)\)/gu)) {
  if (!match[1].startsWith("http")) {
    assert.ok(existsSync(match[1]), `Fehlender README-Pfad: ${match[1]}`);
  }
}
console.log("README-Dateilinks geprüft.");
