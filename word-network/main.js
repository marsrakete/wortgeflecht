import * as THREE from "three";
import { createViewport } from "../share/viewport.js";
import { fitCameraToObjects } from "../share/camera.js";
import { buildGraph } from "./graph.js";
import { createNetworkModel } from "./model.js";
import { createInteraction } from "./interaction.js";
import { stepSimulation, resetGraph } from "./simulation.js";
import { cameraPosition } from "./config.js";
import { loadInputs, saveInputs, listClouds, putCloud, deleteCloud, listProjects, putProject, deleteProject, createCloud, createProject } from "../share/storage.js";

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
void initializeInputs();
viewport.renderer.setAnimationLoop(render);

let persistenceTimer = null;

/** Lädt gespeicherte Eingaben vor dem ersten Netzaufbau. @returns {Promise<void>} Abgeschlossene Initialisierung. */
async function initializeInputs() {
  const savedInputs = await Promise.race([loadInputs(), new Promise((resolve) => setTimeout(() => resolve(null), 1000))]);
  if (savedInputs) {
    for (let index = 0; index < fields.length; index++) {
      fields[index].value = savedInputs[index];
    }
  }
  rebuild();
}

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
  clearTimeout(persistenceTimer);
  persistenceTimer = setTimeout(persistInputs, 250);
}
/** Speichert die aktuellen Eingaben entprellt in IndexedDB. @returns {Promise<void>} Abgeschlossener Speicherversuch. */
async function persistInputs() {
  const inputs = fields.map((field) => field.value);
  await saveInputs(inputs);
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

const activeClouds = { x: null, y: null, z: null };
const storageStatus = document.getElementById("storage-status");const actionDialog = document.getElementById("action-dialog");
document.addEventListener("click", closeCloudMenusAfterOutsideClick);
document.addEventListener("keydown", closeCloudMenusOnEscape);
for (const button of document.querySelectorAll(".cloud-save")) {
  button.addEventListener("click", () => saveCloudForField(button.dataset.field, false));
}
for (const button of document.querySelectorAll(".cloud-new")) {
  button.addEventListener("click", () => saveCloudForField(button.dataset.field, true));
}
for (const button of document.querySelectorAll(".cloud-load")) {
  button.addEventListener("click", () => showClouds(button.dataset.field));
}
document.getElementById("project-save").addEventListener("click", saveCurrentProject);
document.getElementById("project-load").addEventListener("click", showProjects);

/** Zeigt eine zeitlich begrenzte Erfolgs- oder Fehlermeldung für Speichervorgänge. @param {string} message Sichtbarer Meldungstext. @param {string} kind Meldungstyp: success oder error. @returns {void} Kein Rückgabewert. */
/** Schließt geöffnete Wortwolken-Menüs, wenn außerhalb eines Menüs geklickt wird. @param {MouseEvent} event Klickereignis. @returns {void} Kein Rückgabewert. */
function closeCloudMenusAfterOutsideClick(event) {
  const insideMenu = event.target.closest(".cloud-menu");
  const clickedAction = event.target.closest(".cloud-menu-panel button");
  for (const menu of document.querySelectorAll(".cloud-menu[open]")) {
    if (!insideMenu || menu !== insideMenu || clickedAction) {
      menu.open = false;
    }
  }
}

/** Schließt offene Wortwolken-Menüs mit Escape. @param {KeyboardEvent} event Tastaturereignis. @returns {void} Kein Rückgabewert. */
function closeCloudMenusOnEscape(event) {
  if (event.key !== "Escape") {
    return;
  }
  for (const menu of document.querySelectorAll(".cloud-menu[open]")) {
    menu.open = false;
  }
}

/** Zeigt eine gestaltete Bestätigung oder Texteingabe ohne Systemdialog. @param {object} options Dialogtitel, Erklärung, Bestätigungstext sowie optionale Eingabefeld- und Gefahrenoptionen. @returns {Promise<boolean|string|null>} true bei Bestätigung, Eingabetext bei Texteingabe oder null bei Abbruch. */
function requestAction(options) {
  return new Promise((resolve) => {
    const title = document.getElementById("action-title");
    const message = document.getElementById("action-message");
    const inputLabel = document.getElementById("action-input-label");
    const input = document.getElementById("action-input");
    const confirm = document.getElementById("action-confirm");
    title.textContent = options.title;
    message.textContent = options.message;
    confirm.textContent = options.confirmLabel;
    confirm.dataset.danger = String(Boolean(options.danger));
    inputLabel.hidden = !options.inputLabel;
    input.hidden = !options.inputLabel;
    inputLabel.textContent = options.inputLabel || "";
    input.value = options.inputValue || "";
    actionDialog.showModal();
    if (options.inputLabel) {
      input.focus();
      input.select();
    } else {
      confirm.focus();
    }
    const finish = (result) => {
      actionDialog.close();
      confirm.removeEventListener("click", confirmAction);
      document.getElementById("action-cancel").removeEventListener("click", cancelAction);
      actionDialog.removeEventListener("cancel", cancelWithEscape);
      resolve(result);
    };
    const confirmAction = () => {
      if (options.inputLabel) {
        finish(input.value);
      } else {
        finish(true);
      }
    };
    const cancelAction = () => finish(null);
    const cancelWithEscape = () => finish(null);
    confirm.addEventListener("click", confirmAction);
    document.getElementById("action-cancel").addEventListener("click", cancelAction);
    actionDialog.addEventListener("cancel", cancelWithEscape);
  });
}

function showStorageStatus(message, kind) {
  storageStatus.textContent = message;
  storageStatus.dataset.kind = kind;
  storageStatus.hidden = false;
  clearTimeout(storageStatusTimer);
  storageStatusTimer = setTimeout(() => {
    storageStatus.hidden = true;
  }, 4200);
}
let storageStatusTimer = null;

/** Speichert ein einzelnes Eingabefeld als Wortwolke oder überschreibt seine aktive Fassung. @param {string} fieldId Feldkennung. @param {boolean} asNew Neue Fassung erzwingen. @returns {Promise<void>} Abgeschlossener Speicherversuch. */
async function saveCloudForField(fieldId, asNew) {
  const field = document.getElementById("words-" + fieldId);
  if (!field.value.trim()) {
    showStorageStatus("Leere Wortwolken können nicht gespeichert werden.", "error");
    return;
  }
  try {
    let cloud = activeClouds[fieldId];
    if (!cloud || asNew) {
      cloud = createCloud(field.value);
    } else {
      cloud = { ...cloud, text: field.value, updatedAt: new Date().toISOString() };
    }
    await putCloud(cloud);
    activeClouds[fieldId] = cloud;
    await saveInputs(fields.map((entry) => entry.value));
    showStorageStatus("„" + cloud.name + "“ wurde erfolgreich gespeichert.", "success");
  } catch (error) {
    showStorageStatus("Die Wortwolke konnte nicht gespeichert werden.", "error");
    console.error("Wortwolke speichern fehlgeschlagen.", error);
  }
}

/** Zeigt die universellen Wortwolken eines Eingabefelds im Lade-Popup. @param {string} fieldId Zielkennung. @returns {Promise<void>} Abgeschlossener Ladeversuch. */
async function showClouds(fieldId) {
  try {
    const list = document.getElementById("cloud-list");
    list.replaceChildren();
    const clouds = (await listClouds()).sort(sortByUpdated);
    if (clouds.length === 0) {
      const empty = document.createElement("p");
      empty.className = "storage-empty";
      empty.textContent = "Noch keine Wortwolken gespeichert.";
      list.append(empty);
    }
    for (const cloud of clouds) {
      const row = document.createElement("div");
      const load = document.createElement("button");
      load.type = "button";
      load.textContent = "Laden";
      const rename = document.createElement("button");
      rename.type = "button";
      rename.textContent = "Umbenennen";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Löschen";
      const label = document.createElement("span");
      label.textContent = cloud.name + " · " + new Date(cloud.updatedAt).toLocaleString();
      load.addEventListener("click", () => {
        document.getElementById("words-" + fieldId).value = cloud.text;
        activeClouds[fieldId] = cloud;
        scheduleBuild();
        document.getElementById("cloud-dialog").close();
        showStorageStatus("„" + cloud.name + "“ wurde geladen.", "success");
      });
      rename.addEventListener("click", async () => {
        const name = await requestAction({ title: "Wortwolke umbenennen", message: "Gib einen neuen Namen für diese Wortwolke ein.", confirmLabel: "Umbenennen", inputLabel: "Name", inputValue: cloud.name });
        if (name && name.trim()) {
          try {
            await putCloud({ ...cloud, name: name.trim(), updatedAt: new Date().toISOString() });
            showStorageStatus("Wortwolke wurde umbenannt.", "success");
            await showClouds(fieldId);
          } catch (error) {
            showStorageStatus("Die Wortwolke konnte nicht umbenannt werden.", "error");
            console.error("Wortwolke umbenennen fehlgeschlagen.", error);
          }
        }
      });
      remove.addEventListener("click", async () => {
        if (await requestAction({ title: "Wortwolke löschen?", message: "„" + cloud.name + "“ wird dauerhaft aus diesem Gerät gelöscht.", confirmLabel: "Wortwolke löschen", danger: true })) {
          try {
            await deleteCloud(cloud.id);
            showStorageStatus("Wortwolke wurde gelöscht.", "success");
            await showClouds(fieldId);
          } catch (error) {
            showStorageStatus("Die Wortwolke konnte nicht gelöscht werden.", "error");
            console.error("Wortwolke löschen fehlgeschlagen.", error);
          }
        }
      });
      row.append(label, load, rename, remove);
      list.append(row);
    }
    document.getElementById("cloud-dialog").showModal();
  } catch (error) {
    showStorageStatus("Die Wortwolken konnten nicht geladen werden.", "error");
    console.error("Wortwolken laden fehlgeschlagen.", error);
  }
}

/** Speichert das aktuelle Tripel als autarkes Projekt. @returns {Promise<void>} Abgeschlossener Speicherversuch. */
async function saveCurrentProject() {
  const clouds = [];
  for (const fieldId of ["x", "y", "z"]) {
    const field = document.getElementById("words-" + fieldId);
    if (!field.value.trim()) {
      showStorageStatus("Projekte mit leeren Eingabefeldern können nicht gespeichert werden.", "error");
      return;
    }
  }
  const name = await requestAction({ title: "Projekt speichern", message: "Gib deinem aktuellen Projekt einen Namen.", confirmLabel: "Projekt speichern", inputLabel: "Projektname", inputValue: "Projekt " + new Date().toLocaleDateString() });
  if (!name || !name.trim()) {
    return;
  }
  try {
    for (const fieldId of ["x", "y", "z"]) {
      const fieldValue = document.getElementById("words-" + fieldId).value;
      if (!activeClouds[fieldId] || activeClouds[fieldId].text !== fieldValue) {
        activeClouds[fieldId] = createCloud(fieldValue);
        await putCloud(activeClouds[fieldId]);
      }
      clouds.push(activeClouds[fieldId]);
    }
    await putProject(createProject(name.trim(), clouds));
    showStorageStatus("Projekt „" + name.trim() + "“ wurde gespeichert.", "success");
  } catch (error) {
    showStorageStatus("Das Projekt konnte nicht gespeichert werden.", "error");
    console.error("Projekt speichern fehlgeschlagen.", error);
  }
}

/** Zeigt Projekte zum Laden und Löschen. @returns {Promise<void>} Abgeschlossener Ladeversuch. */
async function showProjects() {
  try {
    const list = document.getElementById("project-list");
    list.replaceChildren();
    const projects = (await listProjects()).sort(sortByUpdated);
    if (projects.length === 0) {
      const empty = document.createElement("p");
      empty.className = "storage-empty";
      empty.textContent = "Noch keine Projekte gespeichert.";
      list.append(empty);
    }
    for (const project of projects) {
      const row = document.createElement("div");
      const label = document.createElement("span");
      label.textContent = project.name;
      const load = document.createElement("button");
      load.textContent = "Laden";
      load.type = "button";
      load.addEventListener("click", async () => {
        try {
          for (const fieldId of ["x", "y", "z"]) {
            const cloud = project.clouds[fieldId];
            activeClouds[fieldId] = cloud;
            document.getElementById("words-" + fieldId).value = cloud.text;
            await putCloud(cloud);
          }
          await saveInputs(fields.map((field) => field.value));
          rebuild();
          document.getElementById("project-dialog").close();
          showStorageStatus("Projekt „" + project.name + "“ wurde geladen.", "success");
        } catch (error) {
          showStorageStatus("Das Projekt konnte nicht vollständig geladen werden.", "error");
          console.error("Projekt laden fehlgeschlagen.", error);
        }
      });
      const remove = document.createElement("button");
      remove.textContent = "Löschen";
      remove.type = "button";
      remove.addEventListener("click", async () => {
        if (await requestAction({ title: "Projekt löschen?", message: "„" + project.name + "“ wird dauerhaft aus diesem Gerät gelöscht.", confirmLabel: "Projekt löschen", danger: true })) {
          try {
            await deleteProject(project.id);
            showStorageStatus("Projekt wurde gelöscht.", "success");
            await showProjects();
          } catch (error) {
            showStorageStatus("Das Projekt konnte nicht gelöscht werden.", "error");
            console.error("Projekt löschen fehlgeschlagen.", error);
          }
        }
      });
      row.append(label, load, remove);
      list.append(row);
    }
    document.getElementById("project-dialog").showModal();
  } catch (error) {
    showStorageStatus("Die Projekte konnten nicht geladen werden.", "error");
    console.error("Projekte laden fehlgeschlagen.", error);
  }
}

/** Sortiert Einträge nach letzter Änderung. @param {object} left Erster Eintrag. @param {object} right Zweiter Eintrag. @returns {number} Sortierung. */
function sortByUpdated(left, right) {
  return String(right.updatedAt).localeCompare(String(left.updatedAt));
}