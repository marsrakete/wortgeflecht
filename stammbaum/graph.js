import * as THREE from "three";
import { lifeDates } from "./gedcom.js";
import { CSS2DObject, CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { createViewport } from "../share/viewport.js";
import { createInteraction } from "../word-network/interaction.js";
import { stepSimulation } from "../word-network/simulation.js";
import { fitCameraToObjects } from "../share/camera.js";

const colors = { focus: "#79ded1", parents: "#b6a0ff", partners: "#f6bd77", peers: "#f6bd77", children: "#8bbfff" };
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

  const group = new THREE.Group();
  scene.add(group);

  const graph = { nodes: [], edges: [] };
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
      const points = link.geometry.getAttribute("position");
      for (const [index, id] of [source, target].entries()) {
        points.setXYZ(index, ...graph.nodes[id].position);
      }
      points.needsUpdate = true;
    }
  }

  function fit() {
    if (graph.edges.length) {
      for (const { link } of graph.edges) link.geometry.computeBoundingBox();
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
      object.geometry?.dispose();
      object.material?.dispose();
    }
  }

  function show(person, rows, onSelect, all) {
    clear();
    const origin = new THREE.Vector3();
    const nodes = new Map();

    activate = node => {
      if (node.relative !== person) onSelect(node.relative);
    };

    function connect(from, to, color) {
      const geometry = new THREE.BufferGeometry();
      const points = new THREE.BufferAttribute(new Float32Array(6), 3);
      points.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("position", points);
      const link = new THREE.Line(geometry, new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.8,
      }));
      link.frustumCulled = false;
      graph.edges.push({
        source: from.id, target: to.id, link,
        restOffset: to.origin.map((coordinate, axis) => coordinate - from.origin[axis]),
      });
      group.add(link);
    }

    function addNode(relative, position, relation, generation = 0) {
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
      const dates = lifeDates(relative);
      if (dates) {
        const label = document.createElement("span");
        label.className = "node-dates";
        label.textContent = dates;
        button.append(label);
      }
      const relationship = all && relation !== "focus" ? "Familienmitglied" : {
        parents: generation === 1 ? "Elternteil" : `Vorfahren, Ebene ${generation}`,
        partners: "Partner",
        children: generation === 1 ? "Kind" : `Nachkommen, Ebene ${generation}`,
      }[relation];
      if (relationship) {
        button.setAttribute("aria-description", relationship);
        button.addEventListener("click", event => {
          if (event.detail === 0) activate(node);
        });
      } else {
        button.setAttribute("aria-current", "true");
      }
    }

    addNode(person, origin, "focus");
    const height = { parents: 0, children: 0 };
    for (const { relation, generation, members } of rows) {
      const columns = Math.min(8, Math.max(5, Math.ceil(Math.sqrt(members.length * 2))));
      if (relation === "peers") {
        const tiers = Math.ceil(members.length / columns);
        members.forEach((relative, index) => {
          const column = index % columns;
          const tier = Math.floor(index / columns);
          const x = spacing * (column % 2 ? -1 : 1) * (1 + Math.floor(column / 2));
          const y = (tier - (tiers - 1) / 2) * 1.6;
          addNode(relative, new THREE.Vector3(x, y, -0.85), relation);
        });
        height.parents = height.children = (tiers - 1) * 0.8;
        continue;
      }
      const sign = relation === "parents" ? 1 : -1;
      const base = (height[relation] ?? 0) + 2.5;
      members.forEach((relative, index) => {
        const tier = Math.floor(index / columns);
        const width = Math.min(columns, members.length - tier * columns);
        const offset = index % columns - (width - 1) / 2;
        const position = relation === "partners"
          ? new THREE.Vector3((index % 2 ? -1 : 1) * spacing * (1 + Math.floor(index / 2)), 0, -0.85)
          : new THREE.Vector3(offset * spacing, sign * (base + tier * 1.6), -Math.abs(offset) * 0.45);
        addNode(relative, position, relation, generation);
      });
      height[relation] = base + (Math.ceil(members.length / columns) - 1) * 1.6;
    }
    for (const node of nodes.values()) {
      for (const childId of node.relative.children) {
        const child = nodes.get(childId);
        if (child) connect(node, child, colors.children);
      }
      for (const partnerId of node.relative.partners) {
        const partner = nodes.get(partnerId);
        if (partner && node.id < partner.id) connect(node, partner, colors.partners);
      }
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
