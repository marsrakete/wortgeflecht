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
  const links = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  const up = new THREE.Vector3(0, 1, 0);
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
    }
  }

  function show(person, relatives, onSelect) {
    clear();
    const origin = new THREE.Vector3();
    const nodes = new Map();

    function connect(from, to, color) {
      const direction = new THREE.Vector3().subVectors(to, from);
      const link = new THREE.Mesh(links, new THREE.MeshBasicMaterial({ color }));
      link.position.copy(from).lerp(to, 0.5);
      link.scale.y = direction.length();
      link.quaternion.setFromUnitVectors(up, direction.normalize());
      group.add(link);
    }

    function addNode(relative, position, relation) {
      if (nodes.has(relative.id)) return;
      nodes.set(relative.id, { relative, position });
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
      label.position.copy(position).add(new THREE.Vector3(0, relation === "parents" ? 0.5 : -0.5, 0));
      group.add(label);

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
    for (const { relative, position } of nodes.values()) {
      for (const childId of relative.children) {
        const child = nodes.get(childId);
        if (child) connect(position, child.position, colors.children);
      }
    }
    for (const partner of relatives.partners) {
      const node = nodes.get(partner.id);
      if (node && node.relative.id !== person.id) connect(origin, node.position, colors.partners);
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
