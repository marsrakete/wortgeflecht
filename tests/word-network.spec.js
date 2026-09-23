import { test, expect } from "@playwright/test";
import path from "node:path";

/** Liefert Three.js lokal in derselben Version. @param {object} route Browseranfrage. @returns {Promise<void>} Anfrageabschluss. */
async function localThree(route) {
  const relative = new URL(route.request().url()).pathname.split(
    "/three@0.180.0/",
  )[1];
  await route.fulfill({
    path: path.resolve("node_modules/three", relative),
    contentType: "text/javascript",
  });
}

/** Prüft Texteingaben, Ziehen, Reset, Rotation und Navigation in einem echten Browser. @param {object} fixtures Playwright-Fixtures. @param {object} info Screenshotpfade. @returns {Promise<void>} Prüfabschluss. */
async function interactionTest({ page }, info) {
  const errors = [];
  /** Sammelt unbehandelte Browserfehler. @param {Error} error Fehler. @returns {void} Kein Rückgabewert. */
  function collect(error) {
    errors.push(error.message);
  }
  page.on("pageerror", collect);
  await page.route("https://cdn.jsdelivr.net/npm/three@0.180.0/**", localThree);
  await page.goto("/");
  await expect(page.locator(".word-node")).toHaveCount(12);
  await expect(page.locator("#link-count")).toHaveText("4");
  await page.locator("#view").scrollIntoViewIfNeeded();
  const node = page.locator('[data-node="0"]');
  await expect(node).toBeVisible();
  await node.focus();
  const initial = await node.boundingBox();
  await node.press("ArrowRight");
  await expect(node).toHaveClass(/pinned/);
  await page.locator("#reset").click();
  await expect(node).not.toHaveClass(/pinned/);
  await page.locator("#view").scrollIntoViewIfNeeded();
  const position = await node.boundingBox();
  const neighbour = page.locator('[data-node="1"]');
  const neighbourBefore = await neighbour.getAttribute("style");
  await dragNode(page, position, info.project.name === "mobile");
  await expect(page.locator(".word-node.pinned")).toHaveCount(1);
  await expect(neighbour).not.toHaveAttribute("style", neighbourBefore);
  await page.locator("#reset").click();
  await expect(page.locator(".word-node.pinned")).toHaveCount(0);
  await page.locator("#view").scrollIntoViewIfNeeded();
  const restored = await node.boundingBox();
  expect(Math.abs(restored.x - initial.x)).toBeLessThan(2);
  const transform = await node.getAttribute("style");
  await page.locator("#rotate").click();
  await expect(page.locator("#rotate")).toHaveAttribute("aria-pressed", "true");
  await expect(node).not.toHaveAttribute("style", transform);
  await page.locator("#reset").click();
  await expect(page.locator("#rotate")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("#planes").uncheck();
  await page.locator("#planes").check();
  await page.screenshot({
    path: info.outputPath("word-network-full.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
}

/** Prüft Texteingaben, leere Netze und Modellverträge unabhängig von den Gesten. @param {object} fixtures Browser-Fixtures. @returns {Promise<void>} Prüfabschluss. */
async function inputTest({ page }) {
  const errors = [];
  /** Sammelt Browserfehler. @param {Error} error Fehler. @returns {void} Kein Rückgabewert. */
  function collect(error) { errors.push(error.message); }
  page.on("pageerror", collect);
  await page.route("https://cdn.jsdelivr.net/npm/three@0.180.0/**", localThree);
  await page.goto("/");
  await expect(page.locator(".word-node")).toHaveCount(12);
  await page.locator("#words-x").fill("Raum RAUM <b>Text</b>");
  await page.locator("#words-y").fill("raum");
  await page.locator("#words-z").fill("RAUM");
  await expect(page.locator(".word-node")).toHaveCount(4);
  await expect(page.locator("#link-count")).toHaveText("3");
  await expect(page.locator(".word-node b")).toHaveCount(0);
  await expect(
    page.locator(".word-text").filter({ hasText: "<b>Text</b>" }),
  ).toHaveCount(1);
  await page.locator("#reset").click();
  await expect(page.locator("#words-x")).toHaveValue("Raum RAUM <b>Text</b>");
  for (const id of ["x", "y", "z"]) {
    await page.locator("#words-" + id).fill("");
  }
  await expect(page.locator(".word-node")).toHaveCount(0);
  await expect(page.locator("#empty")).toBeVisible();
  const overflow = await page.evaluate(measureOverflow);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(await page.evaluate(modelContract)).toEqual({
    labels: 1,
    surfaces: 3,
    released: true,
    planesHidden: true,
    updated: true,
  });
  expect(errors).toEqual([]);
}

/** Zieht mit Maus oder emuliertem Touch einen Knoten. @param {object} page Browserseite. @param {object} box Knotengeometrie. @param {boolean} touch Aktiviert echte Touch-Pointerereignisse. @returns {Promise<void>} Abgeschlossene Geste. */
async function dragNode(page, box, touch) {
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  if (touch) {
    const session = await page.context().newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 12; step++) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (65 * step) / 12, y: y - (50 * step) / 12 }],
      });
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 65, y - 50, { steps: 12 });
    await page.mouse.up();
  }
}

/** Prüft wiederholten Modellaufbau ohne doppelte Ebenen oder Ressourcenlecks. Keine Parameter. @returns {Promise<object>} Vertragswerte. */
async function modelContract() {
  const THREE = await import("three");
  const { createNetworkModel } =
    await import("/word-network/model.js");
  const { buildGraph } = await import("/word-network/graph.js");
  const container = document.createElement("div"),
    scene = new THREE.Scene();
  const model = createNetworkModel(
    scene,
    container,
    document.getElementById("word-template"),
  );
  model.rebuild(buildGraph(["Alpha Beta", "Alpha", ""]));
  let released = false;
  /** Merkt die Ressourcenfreigabe. Keine Parameter. @returns {void} Kein Rückgabewert. */
  function onDispose() {
    released = true;
  }
  scene.children[0].children[0].children[0].geometry.addEventListener(
    "dispose",
    onDispose,
  );
  const graph = buildGraph(["Solo", "", ""]);
  model.rebuild(graph);
  model.setPlanes(false);
  const planesHidden = scene.children[0].children[0].visible === false;
  model.setPlanes(true);
  graph.nodes[0].position = [1, 2, 3];
  graph.nodes[0].pinned = true;
  model.update(graph);
  const label = model.labels.get(0);
  const updated = label.object.position.equals(new THREE.Vector3(1, 2, 3)) && label.element.classList.contains("pinned");
  return {
    labels: model.labels.size,
    surfaces: scene.children[0].children[0].children.length,
    released,
    planesHidden,
    updated,
  };
}
/** Misst horizontalen Dokumentüberlauf. Keine Parameter. @returns {number} Überlauf in Pixeln. */
function measureOverflow() {
  return document.documentElement.scrollWidth - innerWidth;
}
test("Word network interaction and templates", interactionTest);


test("Word inputs, empty graph and model contracts", inputTest);


