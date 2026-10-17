import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createViewport } from "../share/viewport.js";

const fields = [document.getElementById("seed-x"), document.getElementById("seed-y"), document.getElementById("seed-z")];
const assistant = document.getElementById("assistant");
const workspace = document.getElementById("workspace");
const board = document.getElementById("node-board");
const nodeDialog = document.getElementById("node-dialog");
const nodeForm = document.getElementById("node-form");
const status = document.getElementById("workspace-status");
const colors = ["#79ded1", "#b6a0ff", "#f6bd77"];
const viewport = createViewport(board, { fov: 42, position: [9, 7, 13], target: [0, 0, 0], groundColor: 0x071226, lightIntensity: 2.4, lightPosition: [4, 8, 7] });
viewport.scene.background = new THREE.Color(0x071226);
const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = "denkraum-labels";
board.appendChild(labelRenderer.domElement);
/** Passt den CSS2D-Renderer an die sichtbare Denkraumfläche an. @returns {void} Aktualisierte Labelgröße. */
function resizeLabels() { labelRenderer.setSize(board.clientWidth, board.clientHeight, false); }
resizeLabels();
window.addEventListener("resize", resizeLabels);
const nodeGroup = new THREE.Group();
viewport.scene.add(nodeGroup);
const linkGroup = new THREE.Group();
viewport.scene.add(linkGroup);
const starGroup = new THREE.Group();
viewport.scene.add(starGroup);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let currentProject = null;
let editingNode = null;
let draggedNode = null;
let planesCreated = false;

/** Erzeugt einen dezenten Sternenhintergrund für den Denkraum. @returns {void} Aktualisierte Szene. */
function createStars() { const positions = []; for (let index = 0; index < 900; index++) { positions.push((Math.random() - 0.5) * 42, (Math.random() - 0.5) * 26, (Math.random() - 0.5) * 34 - 5); } const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); const material = new THREE.PointsMaterial({ color: 0x9ebdff, size: 0.035, transparent: true, opacity: 0.72, sizeAttenuation: true }); starGroup.add(new THREE.Points(geometry, material)); }

/** Öffnet den separaten Denkraum-Speicher. @returns {Promise<IDBDatabase>} Datenbankverbindung. */
function openDatabase() { return new Promise((resolve, reject) => { const request = indexedDB.open("wortgeflecht-denkraum", 1); request.onupgradeneeded = () => request.result.createObjectStore("projects", { keyPath: "id" }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); }
/** Speichert ein Denkraum-Projekt getrennt vom Wortnetz. @param {object} project Projektzustand. @returns {Promise<void>} Abgeschlossen. */
async function saveProject(project) { const database = await openDatabase(); await new Promise((resolve, reject) => { const transaction = database.transaction("projects", "readwrite"); transaction.objectStore("projects").put(project); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); }); database.close(); }
/** Lädt das zuletzt geänderte Denkraum-Projekt aus IndexedDB. @returns {Promise<object|null>} Letztes Projekt oder null. */
async function loadLatestProject() { const database = await openDatabase(); try { return await new Promise((resolve, reject) => { const request = database.transaction("projects", "readonly").objectStore("projects").getAll(); request.onsuccess = () => { const projects = request.result; projects.sort((first, second) => String(second.updatedAt).localeCompare(String(first.updatedAt))); if (projects.length > 0) { resolve(projects[0]); } else { resolve(null); } }; request.onerror = () => reject(request.error); }); } finally { database.close(); } }
/** Zeigt eine Statusmeldung. @param {string} message Meldungstext. @returns {void} Kein Rückgabewert. */
function showStatus(message) { status.textContent = message; }
/** Erzeugt Knoten aus den drei Initialfeldern. @returns {object[]} Knotenliste. */
function createInitialGraph() { const nodes = []; const links = []; const planes = ["x", "y", "z"]; for (let planeIndex = 0; planeIndex < fields.length; planeIndex++) { const words = fields[planeIndex].value.trim().split(/\s+/u).filter(Boolean); for (let index = 0; index < words.length; index++) { const now = new Date().toISOString(); const seedId = crypto.randomUUID(); const thoughtId = crypto.randomUUID(); const seedPosition = [(index % 6 - 2.5) * 1.5, (Math.floor(index / 6) - 1) * 1.4, (planeIndex - 1) * 2.2]; const thoughtPosition = [(index % 5 - 2) * 1.45, (planeIndex - 1) * 1.5 + (Math.floor(index / 5) * 0.8), (index % 2) * 0.7]; nodes.push({ id: seedId, title: words[index], sourcePlane: planes[planeIndex], originText: words[index], note: "", type: "seed", color: colors[planeIndex], position: seedPosition, createdAt: now, updatedAt: now }); nodes.push({ id: thoughtId, title: words[index], sourcePlane: planes[planeIndex], originText: words[index], note: "", type: "thought", color: colors[planeIndex], position: thoughtPosition, createdAt: now, updatedAt: now }); links.push({ id: crypto.randomUUID(), from: seedId, to: thoughtId, relation: "developed-from" }); } } return { nodes, links }; }
/** Baut die drei transparenten Arbeitsflächen. @returns {void} Aktualisierte Szene. */
function createPlanes() { if (planesCreated) { return; } const definitions = [{ id: "x", title: "KONTEXT", color: 0x79ded1, rotation: [0, 0, 0] }, { id: "y", title: "MENSCHEN", color: 0xb6a0ff, rotation: [0, Math.PI / 2, 0] }, { id: "z", title: "UMSETZUNG", color: 0xf6bd77, rotation: [Math.PI / 2, 0, 0] }]; for (const definition of definitions) { const plane = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), new THREE.MeshBasicMaterial({ color: definition.color, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })); plane.rotation.set(...definition.rotation); viewport.scene.add(plane); const label = document.createElement("span"); label.className = "denkraum-plane-label plane-" + definition.id; label.textContent = definition.title; board.appendChild(label); } planesCreated = true; }
/** Rendert die Knoten als leuchtende Kugeln mit CSS2D-Beschriftung. @param {object[]} nodes Knotenliste. @returns {void} Aktualisierte Szene. */
function renderNodes(nodes) {
  nodeGroup.clear();
  linkGroup.clear();
  const bySource = new Map();
  for (const node of nodes) {
    bySource.set(node.id, node);
    const typeColors = { goal: "#79ded1", problem: "#f6bd77", action: "#78b7ff", thought: "#b6a0ff" };
    let nodeColor = node.color;
    if (node.type !== "seed" && typeColors[node.type]) { nodeColor = typeColors[node.type]; }
    const color = new THREE.Color(nodeColor || colors[1]);
    const isSeed = node.type === "seed";
    const radius = isSeed ? 0.12 : 0.58;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 20), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: isSeed ? 1.4 : 1.1, roughness: 0.18, metalness: 0.05 }));
    sphere.position.fromArray(node.position);
    sphere.userData.node = node;
    sphere.userData.nodeId = node.id;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.75, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: isSeed ? 0.2 : 0.3 }));
    sphere.add(halo);
    if (!isSeed) {
      const outerHalo = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.35, 24, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08 }));
      sphere.add(outerHalo);
    }
    const label = document.createElement("span");
    label.className = isSeed ? "denkraum-node-label seed-label" : "denkraum-node-label thought-label";
    label.textContent = node.title;
    const labelObject = new CSS2DObject(label);
    labelObject.position.set(0, radius * 2.2, 0);
    sphere.add(labelObject);
    nodeGroup.add(sphere);
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const explicitLinks = currentProject && Array.isArray(currentProject.links) ? currentProject.links : [];
  for (const link of explicitLinks) { const source = nodeById.get(link.from); const target = nodeById.get(link.to); if (source && target) { addLink(source, target, new THREE.Color(target.color || colors[1]).getHex(), 0.95, false); } }
  for (const node of nodes.filter((candidate) => candidate.type !== "seed")) {
    const related = nodes.filter((candidate) => candidate.type === "seed" && candidate.sourcePlane === node.sourcePlane);
    for (const seed of related.slice(0, 6)) { addLink(node, seed, new THREE.Color(node.color || colors[1]).getHex(), 0.6, false); }
  }
  const chains = new Map();
  for (const node of nodes.filter((candidate) => candidate.type === "seed")) {
    const key = node.sourcePlane || "center";
    if (!chains.has(key)) { chains.set(key, []); }
    chains.get(key).push(node);
  }
  for (const chain of chains.values()) {
    for (let index = 1; index < chain.length; index++) {
      addLink(chain[index - 1], chain[index], new THREE.Color(chain[index].color || colors[1]).getHex(), 0.72, false);
    }
  }
  const shared = new Map();
  for (const node of nodes.filter((candidate) => candidate.type === "seed")) {
    const key = node.originText ? node.originText.normalize("NFC").toLocaleLowerCase("de") : "";
    if (!key) { continue; }
    if (!shared.has(key)) { shared.set(key, []); }
    shared.get(key).push(node);
  }
  for (const matches of shared.values()) {
    for (let index = 1; index < matches.length; index++) {
      addLink(matches[0], matches[index], 0xe5edff, 0.9, true);
    }
  }
}
/** Zeichnet eine Verbindung zwischen zwei Denkraumknoten. @param {object} source Ausgangsknoten. @param {object} target Zielknoten. @param {number} color Linienfarbe. @param {number} opacity Deckkraft. @param {boolean} dashed Gestrichelte automatische Verbindung. @returns {void} Kein Rückgabewert. */
function addLink(source, target, color, opacity, dashed) {
  const start = new THREE.Vector3(...source.position);
  const end = new THREE.Vector3(...target.position);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  midpoint.y += start.distanceTo(end) * 0.22;
  const curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
  const geometry = new THREE.TubeGeometry(curve, 32, dashed ? 0.018 : 0.035, 8, false);
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
  linkGroup.add(new THREE.Mesh(geometry, material));
  const glowGeometry = new THREE.TubeGeometry(curve, 32, dashed ? 0.055 : 0.1, 8, false);
  const glowMaterial = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: dashed ? 0.06 : 0.14, blending: THREE.AdditiveBlending, depthWrite: false });
  linkGroup.add(new THREE.Mesh(glowGeometry, glowMaterial));
}
/** Öffnet den Editor für einen Knoten oder einen neuen Knoten. @param {object|null} node Zielknoten. @returns {void} Geöffneter Dialog. */
function openNodeEditor(node) { editingNode = node; document.getElementById("node-dialog-title").textContent = node ? "Knoten bearbeiten" : "Knoten hinzufügen"; document.getElementById("node-title-input").value = node ? node.title : ""; document.getElementById("node-note-input").value = node ? node.note : ""; document.getElementById("node-type-input").value = node ? node.type : "thought"; nodeDialog.showModal(); document.getElementById("node-title-input").focus(); }
/** Speichert die Eingaben des Knoteneditors. @param {SubmitEvent} event Formularereignis. @returns {Promise<void>} Abgeschlossener Speichervorgang. */
async function saveNode(event) { event.preventDefault(); const now = new Date().toISOString(); const title = document.getElementById("node-title-input").value.trim(); if (!title) { return; } const note = document.getElementById("node-note-input").value.trim(); const type = document.getElementById("node-type-input").value; if (editingNode) { editingNode.title = title; editingNode.note = note; editingNode.type = type; editingNode.updatedAt = now; } else { const positions = { goal: [-3.2, 1.5, 0], problem: [3.2, 1.5, 0], action: [0, -2.8, 1.1], thought: [0, 0, 0] }; let position = positions.thought; if (positions[type]) { position = positions[type]; } currentProject.nodes.push({ id: crypto.randomUUID(), title, sourcePlane: null, originText: null, note, type, color: colors[1], position, createdAt: now, updatedAt: now }); } nodeDialog.close(); renderNodes(currentProject.nodes); await saveProject(currentProject); showStatus("Knoten gespeichert."); }
/** Bewegt einen Knoten auf der zugehörigen Darstellungsebene. @param {PointerEvent} event Zeigerereignis. @returns {void} Kein Rückgabewert. */
function moveNode(event) { if (!draggedNode || draggedNode.node.type === "seed") { return; } const rect = viewport.renderer.domElement.getBoundingClientRect(); const x = ((event.clientX - rect.left) / rect.width) * 2 - 1; const y = -((event.clientY - rect.top) / rect.height) * 2 + 1; draggedNode.node.position[0] = x * 5; draggedNode.node.position[1] = y * 4; const object = nodeGroup.children.find((child) => child.userData.nodeId === draggedNode.node.id); if (object) { object.position.x = draggedNode.node.position[0]; object.position.y = draggedNode.node.position[1]; } if (Math.abs(event.clientX - draggedNode.startX) + Math.abs(event.clientY - draggedNode.startY) > 5) { draggedNode.moved = true; } }
/** Startet Auswahl oder Ziehen eines 3D-Knotens. @param {PointerEvent} event Zeigerereignis. @returns {void} Kein Rückgabewert. */
function startNodePointer(event) { const rect = viewport.renderer.domElement.getBoundingClientRect(); pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; raycaster.setFromCamera(pointer, viewport.camera); const hit = raycaster.intersectObjects(nodeGroup.children, false)[0]; if (!hit) { return; } draggedNode = { node: hit.object.userData.node, startX: event.clientX, startY: event.clientY, moved: false }; viewport.controls.enabled = false; }
/** Beendet Auswahl oder Ziehen eines 3D-Knotens. @returns {void} Kein Rückgabewert. */
function endNodePointer() { if (!draggedNode) { return; } const selected = draggedNode; draggedNode = null; viewport.controls.enabled = true; if (selected.moved) { void saveProject(currentProject); } else { openNodeEditor(selected.node); } }
/** Öffnet den Denkraum aus den drei Initialfeldern. @returns {Promise<void>} Abgeschlossener Phasenwechsel. */
async function openWorkspace() { if (currentProject && workspace.hidden === false) { createPlanes(); renderNodes(currentProject.nodes); assistant.hidden = true; workspace.hidden = false; showStatus("Gespeicherte Wörter und Verbindungen sind sichtbar."); return; } const graph = createInitialGraph(); currentProject = { id: crypto.randomUUID(), name: "Neuer Denkraum", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), inputs: { x: fields[0].value, y: fields[1].value, z: fields[2].value }, nodes: graph.nodes, links: graph.links, phase: "workspace", schemaVersion: 2 }; createPlanes(); renderNodes(graph.nodes); assistant.hidden = true; workspace.hidden = false; await saveProject(currentProject); showStatus("Wörter verankert und mit Gedankenknoten verbunden."); }
/** Stellt das zuletzt verwendete Denkraum-Projekt nach einem Reload wieder her. @returns {Promise<void>} Abgeschlossene Wiederherstellung. */
async function restoreLatestProject() { try { const project = await loadLatestProject(); if (!project) { return; } currentProject = project; if (project.inputs) { fields[0].value = project.inputs.x || ""; fields[1].value = project.inputs.y || ""; fields[2].value = project.inputs.z || ""; } else { fields[0].value = ""; fields[1].value = ""; fields[2].value = ""; } let nodes = []; if (Array.isArray(project.nodes)) { nodes = project.nodes; } currentProject.nodes = nodes; if (!Array.isArray(currentProject.links)) { currentProject.links = []; } createPlanes(); renderNodes(nodes); assistant.hidden = true; workspace.hidden = false; showStatus("Denkraum wiederhergestellt."); } catch (error) { console.error(error); showStatus("Denkraum konnte nicht geladen werden."); } }
/** Wechselt zurück zur Initialbefüllung. @returns {void} Sichtbarer Assistent. */
function showSeedAssistant() { workspace.hidden = true; assistant.hidden = false; }
createStars();
viewport.renderer.setAnimationLoop((time) => { viewport.controls.update(); resizeLabels(); for (const object of nodeGroup.children) { if (object.userData.node && object.userData.node.type !== "seed") { const baseY = object.userData.baseY || object.position.y; object.userData.baseY = baseY; object.position.y = baseY + Math.sin(time * 0.0012 + object.userData.node.id.length) * 0.045; } } viewport.renderer.render(viewport.scene, viewport.camera); labelRenderer.render(viewport.scene, viewport.camera); });
viewport.renderer.domElement.addEventListener("pointerdown", startNodePointer);
viewport.renderer.domElement.addEventListener("pointermove", moveNode);
viewport.renderer.domElement.addEventListener("pointerup", endNodePointer);
document.getElementById("open-workspace").addEventListener("click", openWorkspace);
document.getElementById("back-to-seed").addEventListener("click", showSeedAssistant);
document.getElementById("add-node").addEventListener("click", () => openNodeEditor(null));
document.getElementById("save-workspace").addEventListener("click", () => { void saveProject(currentProject); showStatus("Denkraum gespeichert."); });
document.getElementById("node-cancel").addEventListener("click", () => nodeDialog.close());
nodeForm.addEventListener("submit", (event) => { void saveNode(event); });
void restoreLatestProject();
