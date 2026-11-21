import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createViewport } from "../share/viewport.js";
import { fitCameraToObjects } from "../share/camera.js";

const colors = { focus: "#79ded1", parents: "#b6a0ff", partners: "#f6bd77", children: "#8bbfff" };
const spacing = 3.6;

export function createGraph(view) {
  const { scene, camera, renderer, controls } = createViewport(view, {
    fov: 45,
    position: [2, 2, 16],
    target: [0, 0, 0],
    groundColor: 0x334466,
    lightIntensity: 2,
    lightPosition: [5, 8, 6],
    onResize: () => requestAnimationFrame(fit),
  });
  scene.background.set(0x0c1528);
  controls.minDistance = 2;

  const labels = new CSS2DRenderer();
  labels.domElement.classList.add("labels");
  view.append(labels.domElement);

  const geometry = new THREE.SphereGeometry(0.23, 20, 12);
  const group = new THREE.Group();
  scene.add(group);

  function fit() {
    fitCameraToObjects(camera, controls, group.children);
    camera.near = 0.05;
    camera.updateProjectionMatrix();
  }

  function clear() {
    for (const object of [...group.children]) {
      group.remove(object);
      object.material?.dispose();
      if (object.isLine) object.geometry.dispose();
    }
  }

  function show(person, relatives, onSelect) {
    clear();
    const origin = new THREE.Vector3();

    function addNode(relative, position, relation) {
      const color = colors[relation];
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.42,
      }));
      mesh.position.copy(position);
      group.add(mesh);

      const button = document.createElement("button");
      button.className = "node";
      button.style.setProperty("--node-color", color);
      button.textContent = relative.name;
      const relationship = { parents: "Elternteil", partners: "Partner", children: "Kind" }[relation];
      if (relationship) {
        button.setAttribute("aria-label", `${relative.name}, ${relationship}`);
        button.addEventListener("click", () => onSelect(relative));
      } else {
        button.setAttribute("aria-current", "true");
        button.disabled = true;
      }
      const label = new CSS2DObject(button);
      label.position.copy(position).add(new THREE.Vector3(0, -0.5, 0));
      group.add(label);

      if (relationship) {
        group.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([origin, position]),
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.65 }),
        ));
      }
    }

    addNode(person, origin, "focus");
    for (const [relation, row] of Object.entries(relatives)) {
      row.forEach((relative, index) => {
        const column = index % 5;
        const width = Math.min(5, row.length - Math.floor(index / 5) * 5);
        const offset = column - (width - 1) / 2;
        const tier = Math.floor(index / 5);
        const position = relation === "partners"
          ? new THREE.Vector3((index % 2 ? -1 : 1) * spacing * (1 + Math.floor(index / 2)), 0, -0.85)
          : new THREE.Vector3(offset * spacing, (relation === "parents" ? 1 : -1) * (2.5 + tier * 1.6), -Math.abs(offset) * 0.55);
        addNode(relative, position, relation);
      });
    }
    fit();
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    labels.setSize(view.clientWidth, view.clientHeight);
    labels.render(scene, camera);
  });

  return { show, clear };
}
