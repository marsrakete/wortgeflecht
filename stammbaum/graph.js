import * as THREE from "three";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createViewport } from "../share/viewport.js";
import { createInteraction } from "../word-network/interaction.js";
import { stepSimulation } from "../word-network/simulation.js";
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

  const links = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
  const up = new THREE.Vector3(0, 1, 0);
  const group = new THREE.Group();
  scene.add(group);

  const graph = { nodes: [], edges: [] };
  const direction = new THREE.Vector3();
  let activate;
  let moving = false;
  let previousTime;
  const interaction = createInteraction({
    view, camera, controls,
    getGraph: () => graph,
    onGrab(node) {
      for (const other of graph.nodes) {
        if (other !== node) other.pinned = false;
      }
      moving = true;
    },
    onActivate: node => activate?.(node),
  });

  function syncScene() {
    for (const { label, position } of graph.nodes) label.position.fromArray(position);
    for (const { source, target, link } of graph.edges) {
      const from = graph.nodes[source].label.position;
      const to = graph.nodes[target].label.position;
      direction.subVectors(to, from);
      link.position.copy(from).lerp(to, 0.5);
      link.scale.y = direction.length();
      link.quaternion.setFromUnitVectors(up, direction.normalize());
    }
  }

  function fit() {
    if (graph.edges.length) {
      fitCameraToObjects(camera, controls, group.children);
    } else if (graph.nodes.length === 1) {
      controls.target.copy(graph.nodes[0].label.position);
      camera.position.copy(controls.target).add(new THREE.Vector3(2, 2, 16));
      controls.update();
    }
    camera.near = 0.05;
    camera.updateProjectionMatrix();
  }

  function clear() {
    interaction.cancel();
    graph.nodes.length = graph.edges.length = 0;
    moving = false;
    previousTime = undefined;
    for (const object of [...group.children]) {
      group.remove(object);
      object.material?.dispose();
    }
  }

  function show(person, relatives, onSelect) {
    clear();
    const origin = new THREE.Vector3();
    const nodes = new Map();

    activate = node => {
      if (node.relative !== person) onSelect(node.relative);
    };

    function connect(from, to, color) {
      const link = new THREE.Mesh(links, new THREE.MeshBasicMaterial({ color }));
      graph.edges.push({
        source: from.id, target: to.id, link,
        restOffset: to.origin.map((coordinate, axis) => coordinate - from.origin[axis]),
      });
      group.add(link);
    }

    function addNode(relative, position, relation) {
      if (nodes.has(relative.id)) return;
      const color = colors[relation];
      const button = document.createElement("button");
      button.className = "node";
      const label = new CSS2DObject(button);
      label.position.copy(position);
      group.add(label);

      const origin = position.toArray();
      const node = {
        id: graph.nodes.length, relative, label, origin, position: [...origin],
        pinned: false, velocity: [0, 0, 0],
      };
      nodes.set(relative.id, node);
      graph.nodes.push(node);
      button.dataset.node = node.id;
      button.style.setProperty("--node-color", color);
      button.textContent = relative.name;
      const relationship = { parents: "Elternteil", partners: "Partner", children: "Kind" }[relation];
      if (relationship) {
        button.setAttribute("aria-label", `${relative.name}, ${relationship}`);
        button.addEventListener("click", event => {
          if (event.detail === 0) activate(node);
        });
      } else {
        button.setAttribute("aria-current", "true");
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
    for (const node of nodes.values()) {
      for (const childId of node.relative.children) {
        const child = nodes.get(childId);
        if (child) connect(node, child, colors.children);
      }
    }
    for (const partner of relatives.partners) {
      const node = nodes.get(partner.id);
      if (node && node.relative.id !== person.id) connect(nodes.get(person.id), node, colors.partners);
    }
    syncScene();
    fit();
  }

  renderer.setAnimationLoop(time => {
    if (moving && previousTime !== undefined) {
      stepSimulation(graph, (time - previousTime) / 1000);
      syncScene();
    }
    previousTime = time;
    controls.update();
    renderer.render(scene, camera);
    labels.setSize(view.clientWidth, view.clientHeight);
    labels.render(scene, camera);
  });

  return { show, clear };
}
