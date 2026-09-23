import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { clearGroup } from "../share/resources.js";
import { fitCameraToObjects } from "../share/camera.js";

/** Prüft Exportverträge aller gemeinsamen Module. Keine Parameter. @returns {Promise<void>} Prüfabschluss. */
async function contracts() {
  for (const [name, exported] of Object.entries({ camera: "fitCameraToObjects", resources: "clearGroup", template: "mountTemplate", viewport: "createViewport", storage: ["createCloud", "createProject", "deleteCloud", "deleteProject", "listClouds", "listProjects", "loadInputs", "putCloud", "putProject", "saveInputs"] })) {
    if (Array.isArray(exported)) {
      assert.deepEqual(Object.keys(await import(`../share/${name}.js`)).sort(), exported.sort());
      continue;
    }
    assert.deepEqual(Object.keys(await import(`../share/${name}.js`)), [exported]);
  }
}
test("Shared module contracts", contracts);

/** Prüft verschachtelte Ressourcen und Materialarrays sowie wiederholtes Leeren. Keine Parameter. @returns {void} Prüfergebnis. */
function resources() {
  const group = new THREE.Group();
  const nested = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const materials = [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()];
  let released = 0;
  /** Zählt freigegebene Ressourcen. Keine Parameter. @returns {void} Kein Rückgabewert. */
  function count() { released += 1; }
  for (const resource of [geometry, ...materials]) {
    resource.addEventListener("dispose", count);
  }
  nested.add(new THREE.Mesh(geometry, materials));
  group.add(nested);
  clearGroup(group);
  assert.equal(released, 3);
  assert.equal(group.children.length, 0);
  clearGroup(group);
  assert.equal(released, 3);
}
test("Recursive resource disposal including material arrays", resources);

/** Prüft leere Szenen, ungültiges Seitenverhältnis und Einrahmung im Hoch-/Querformat. Keine Parameter. @returns {void} Prüfergebnis. */
function cameraFraming() {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera.position.set(7, 7, 7);
  /** Richtet die Kamera wie OrbitControls aus. Keine Parameter. @returns {void} Kein Rückgabewert. */
  function update() { camera.lookAt(controls.target); camera.updateMatrixWorld(); }
  const controls = { target: new THREE.Vector3(), update };
  const before = camera.position.clone();
  fitCameraToObjects(camera, controls, []);
  assert.ok(camera.position.equals(before));
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3));
  camera.aspect = 0;
  fitCameraToObjects(camera, controls, [mesh]);
  assert.ok(camera.position.equals(before));
  for (const aspect of [390 / 574, 1100 / 900]) {
    camera.aspect = aspect;
    fitCameraToObjects(camera, controls, [mesh]);
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, index).project(camera);
      assert.ok(Math.abs(point.x) < 1 && Math.abs(point.y) < 1);
      assert.ok(point.z > -1 && point.z < 1);
    }
  }
  mesh.geometry.dispose();
  mesh.material.dispose();
}
test("Camera framing boundaries and projected geometry", cameraFraming);
