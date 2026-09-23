import { test, expect } from "@playwright/test";
import path from "node:path";

/** Liefert die fixierte Three.js-Version ohne CDN-Zugriff. @param {object} route Anfrage. @returns {Promise<void>} Anfrageabschluss. */
async function localThree(route) {
  const relative = new URL(route.request().url()).pathname.split("/three@0.180.0/")[1];
  await route.fulfill({ path: path.resolve("node_modules/three", relative), contentType: "text/javascript" });
}

/** Prüft Layout, Größenänderung, Eingabegrenzen und Template-Verträge. @param {object} fixtures Browser-Fixtures. @returns {Promise<void>} Prüfabschluss. */
async function boundaries({ page }) {
  const errors = [];
  /** Sammelt Initialisierungs- und Laufzeitfehler. @param {Error} error Fehler. @returns {void} Kein Rückgabewert. */
  function collect(error) { errors.push(error.message); }
  page.on("pageerror", collect);
  await page.route("https://cdn.jsdelivr.net/npm/three@0.180.0/**", localThree);
  await page.goto("/");
  await expect(page.locator(".word-node")).toHaveCount(12);
  await verifyLayout(page);
  await page.setViewportSize({ width: 600, height: 900 });
  await verifyLayout(page);
  const words = [];
  for (let index = 0; index < 61; index++) { words.push("Wort" + index); }
  await page.locator("#words-y").fill("");
  await page.locator("#words-z").fill("");
  await page.locator("#words-x").fill(words.join(" "));
  await expect(page.locator("#node-count")).toHaveText("60");
  await expect(page.locator("#limit-warning")).toBeVisible();
  await expect(page.locator(".word-node")).toHaveCount(60);
  words.pop();
  await page.locator("#words-x").fill(words.join(" "));
  await expect(page.locator("#limit-warning")).toBeHidden();
  await page.locator("#words-x").fill("Sofort Neu");
  await page.locator("#reset").click();
  await expect(page.locator("#node-count")).toHaveText("2");
  await expect(page.locator("#words-x")).toHaveValue("Sofort Neu");
  expect(await page.evaluate(templateContract)).toEqual({ text: "<b>sicher</b>", markup: 0, count: 1, empty: 0 });
  expect(errors).toEqual([]);
}

/** Prüft Canvas und Dokumentüberlauf. @param {object} page Browserseite. @returns {Promise<void>} Prüfabschluss. */
async function verifyLayout(page) {
  await expect(page.locator("#view canvas")).toBeVisible();
  /** Vergleicht Canvas- und Containergröße nach Resize. Keine Parameter. @returns {Promise<number>} Größenabweichung. */
  async function canvasDifference() {
    const view = await page.locator("#view").boundingBox();
    const canvas = await page.locator("#view canvas").boundingBox();
    expect(canvas.width).toBeGreaterThan(300);
    expect(canvas.height).toBeGreaterThan(400);
    return Math.abs(view.width - canvas.width) + Math.abs(view.height - canvas.height);
  }
  await expect.poll(canvasDifference).toBeLessThan(2);
  expect(await page.evaluate(measureOverflow)).toBeLessThanOrEqual(1);
}

/** Misst Dokumentüberlauf. Keine Parameter. @returns {number} Überlauf in Pixeln. */
function measureOverflow() { return document.documentElement.scrollWidth - innerWidth; }

/** Prüft sichere Template-Bindung, Ersetzen und leere Templates im Browser-DOM. Keine Parameter. @returns {Promise<object>} Ergebnisse. */
async function templateContract() {
  const { mountTemplate } = await import("/share/template.js");
  const template = document.getElementById("word-template").cloneNode(true);
  template.content.querySelector(".word-text").dataset.value = "text";
  const target = document.createElement("div");
  mountTemplate(target, template);
  const binding = mountTemplate(target, template);
  binding.values.text.textContent = "<b>sicher</b>";
  const result = { text: target.textContent.replace("◆", "").trim(), markup: target.querySelectorAll("b").length, count: target.children.length };
  mountTemplate(target, document.createElement("template"));
  result.empty = target.children.length;
  return result;
}

test("Responsive viewport, word limits and DOM contracts", boundaries);

