import * as THREE from "three";
import { createViewport } from "../share/viewport.js";
import { fitCameraToObjects } from "../share/camera.js";
import { buildGraph } from "./graph.js";
import { createNetworkModel } from "./model.js";
import { createInteraction } from "./interaction.js";
import { stepSimulation, resetGraph } from "./simulation.js";
import { cameraPosition } from "./config.js";

const view = document.getElementById("view");
const fields = [
  document.getElementById("words-x"),
  document.getElementById("words-y"),
  document.getElementById("words-z"),
];
const rotation = document.getElementById("rotate"),
  planeToggle = document.getElementById("planes");
const viewport = createViewport(view, {
  fov: 45,
  position: cameraPosition,
  target: [0, 0, 0],
  groundColor: 0x334466,
  lightIntensity: 2,
  lightPosition: [5, 8, 6],
  onResize: scheduleFit,
});
viewport.scene.background = new THREE.Color(0x0b1020);
viewport.controls.autoRotateSpeed = 0.65;
viewport.controls.minDistance = 3;
viewport.controls.maxDistance = 160;
const model = createNetworkModel(
  viewport.scene,
  view,
  document.getElementById("word-template"),
);
let graph = buildGraph(["", "", ""]),
  timer = null,
  lastTime = null;
const interaction = createInteraction({
  view,
  camera: viewport.camera,
  controls: viewport.controls,
  getGraph,
  onGrab: stopRotation,
});
for (const field of fields) {
  field.addEventListener("input", scheduleBuild);
}
document.getElementById("words-form").addEventListener("submit", preventSubmit);
document.getElementById("reset").addEventListener("click", reset);
rotation.addEventListener("click", toggleRotation);
planeToggle.addEventListener("change", togglePlanes);
rebuild();
viewport.renderer.setAnimationLoop(render);

/** Liefert das aktuelle Netz ohne versteckten Modulzustand. Keine Parameter. @returns {object} Aktuelles Netz. */
function getGraph() {
  return graph;
}
/** Verhindert Navigation beim Absenden des Eingabeformulars. @param {SubmitEvent} event Formularereignis. @returns {void} Kein Rückgabewert. */
function preventSubmit(event) {
  event.preventDefault();
}
/** Entprellt Änderungen größerer Texte. Keine Parameter. @returns {void} Kein Rückgabewert. */
function scheduleBuild() {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 200);
}
/** Plant die Einrahmung nach abgeschlossener Initialisierung. Keine Parameter. @returns {void} Kein Rückgabewert. */
function scheduleFit() {
  requestAnimationFrame(fit);
}
/** Rahmt das aktuelle Netz ein. Keine Parameter. @returns {void} Kein Rückgabewert. */
function fit() {
  viewport.camera.zoom = 1;
  fitCameraToObjects(viewport.camera, viewport.controls, [model.bounds]);
  // Auf schmalen Displays nutzt der Startblick mehr Raum; Textbreite und
  // Kopf-/Fußzeile bleiben bei der Projektionsgrenze ausdrücklich berücksichtigt.
  let zoom = 1;
  if (view.clientWidth < 760) {
    zoom = 1.6;
  }
  viewport.camera.updateMatrixWorld();
  const horizontal = Math.max(0.2, 1 - 150 / view.clientWidth);
  const vertical = Math.max(0.2, 1 - 140 / view.clientHeight);
  for (const node of graph.nodes) {
    const point = new THREE.Vector3(...node.origin).project(viewport.camera);
    if (Math.abs(point.x) > 0.001) {
      zoom = Math.min(zoom, horizontal / Math.abs(point.x));
    }
    if (Math.abs(point.y) > 0.001) {
      zoom = Math.min(zoom, vertical / Math.abs(point.y));
    }
  }
  viewport.camera.zoom = zoom;
  viewport.camera.updateProjectionMatrix();
}
/** Baut das Netz aus den drei Eingaben neu auf. Keine Parameter. @returns {void} Kein Rückgabewert. */
function rebuild() {
  clearTimeout(timer);
  timer = null;
  interaction.cancel();
  const inputs = [];
  for (const field of fields) {
    inputs.push(field.value);
  }
  graph = buildGraph(inputs);
  model.rebuild(graph);
  togglePlanes();
  document.getElementById("node-count").textContent = String(
    graph.nodes.length,
  );
  let shared = 0;
  for (const edge of graph.edges) {
    if (edge.kind === "shared") {
      shared++;
    }
  }
  document.getElementById("link-count").textContent = String(shared);
  document.getElementById("empty").hidden = graph.nodes.length > 0;
  document.getElementById("limit-warning").hidden = graph.omitted === 0;
  reset();
}
/** Stoppt automatische Rotation während direkter Knotenbedienung. Keine Parameter. @returns {void} Kein Rückgabewert. */
function stopRotation() {
  viewport.controls.autoRotate = false;
  rotation.setAttribute("aria-pressed", "false");
}
/** Schaltet die automatische Kamerarotation um. Keine Parameter. @returns {void} Kein Rückgabewert. */
function toggleRotation() {
  viewport.controls.autoRotate = !viewport.controls.autoRotate;
  rotation.setAttribute("aria-pressed", String(viewport.controls.autoRotate));
}
/** Überträgt die Sichtbarkeit der Referenzebenen. Keine Parameter. @returns {void} Kein Rückgabewert. */
function togglePlanes() {
  model.setPlanes(planeToggle.checked);
}
/** Glättet das Netz, entfernt Fixierungen und setzt die Kamera zurück. Keine Parameter. @returns {void} Kein Rückgabewert. */
function reset() {
  if (timer !== null) {
    rebuild();
    return;
  }
  interaction.cancel();
  stopRotation();
  resetGraph(graph);
  model.update(graph);
  // reset entfernt auch restliche Orbit-Dämpfung vor der definierten Ausgangskamera.
  viewport.controls.reset();
  viewport.controls.target.set(0, 0, 0);
  viewport.camera.position.set(...cameraPosition);
  fit();
}
/** Simuliert und zeichnet einen zeitunabhängigen Animationsschritt. @param {number} time Rendererzeit in Millisekunden. @returns {void} Kein Rückgabewert. */
function render(time) {
  let elapsed = 0;
  if (lastTime !== null) {
    elapsed = (time - lastTime) / 1000;
  }
  lastTime = time;
  stepSimulation(graph, elapsed);
  model.update(graph);
  viewport.controls.update(elapsed);
  viewport.renderer.render(viewport.scene, viewport.camera);
  model.renderLabels(viewport.camera);
}
