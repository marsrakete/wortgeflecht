import * as THREE from "three";
import {
  CSS2DObject,
  CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import { clearGroup } from "../share/resources.js";
import { planes } from "./config.js";

/**
 * Erstellt Ebenen, räumliche Linien und mit der Kamera lesbare Wort-Templates.
 * @param {THREE.Scene} scene Zielszene.
 * @param {HTMLElement} view Ansichtscontainer.
 * @param {HTMLTemplateElement} template Template für einen Wortknoten.
 * @returns {object} Modell mit rebuild, update, renderLabels, setPlanes, labels und bounds.
 */
export function createNetworkModel(scene, view, template) {
  const group = new THREE.Group(),
    surfaces = new THREE.Group();
  const bounds = new THREE.Points(new THREE.BufferGeometry());
  const labels = new Map(),
    lines = [];
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.classList.add("labels");
  view.appendChild(labelRenderer.domElement);
  scene.add(group);

  /**
   * Ersetzt das bisherige Netz und gibt dessen DOM- und GPU-Ressourcen frei.
   * @param {object} graph Neues Netz.
   * @returns {void} Baut das Modell vollständig auf.
   */
  function rebuild(graph) {
    for (const { element } of labels.values()) {
      element.remove();
    }
    labels.clear();
    lines.length = 0;
    clearGroup(surfaces);
    clearGroup(group);
    group.add(surfaces);
    for (const plane of planes) {
      const surface = new THREE.Mesh(
        new THREE.PlaneGeometry(graph.extent * 2, graph.extent * 2),
        new THREE.MeshBasicMaterial({
          color: plane.color,
          transparent: true,
          opacity: 0.055,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      if (plane.id === "y") {
        surface.rotation.y = Math.PI / 2;
      } else if (plane.id === "z") {
        surface.rotation.x = -Math.PI / 2;
      }
      const border = new THREE.LineSegments(
        new THREE.EdgesGeometry(surface.geometry),
        new THREE.LineBasicMaterial({
          color: plane.color,
          transparent: true,
          opacity: 0.22,
        }),
      );
      surface.add(border);
      surfaces.add(surface);
    }
    const points = [];
    for (const node of graph.nodes) {
      const element = view.ownerDocument.importNode(
        template.content.firstElementChild,
        true,
      );
      element.classList.add("axis-" + node.plane);
      element.dataset.node = String(node.id);
      element.querySelector(".word-text").textContent = node.text;
      const object = new CSS2DObject(element);
      object.position.fromArray(node.position);
      group.add(object);
      labels.set(node.id, { element, object });
      points.push(new THREE.Vector3(...node.origin));
    }
    // Unsichtbare Stützpunkte geben leeren und einwortigen Netzen einen sinnvollen Rahmen.
    points.push(new THREE.Vector3(-3, -3, -3), new THREE.Vector3(3, 3, 3));
    bounds.geometry.dispose();
    bounds.geometry = new THREE.BufferGeometry().setFromPoints(points);
    for (const edge of graph.edges) {
      let material;
      if (edge.kind === "shared") {
        material = new THREE.LineDashedMaterial({
          color: 0xe0e8ff,
          transparent: true,
          opacity: 0.7,
          dashSize: 0.13,
          gapSize: 0.1,
        });
      } else {
        const plane = planes.find(findPlane);
        material = new THREE.LineBasicMaterial({
          color: plane.color,
          transparent: true,
          opacity: 0.8,
        });
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(),
        ]),
        material,
      );
      group.add(line);
      lines.push({ edge, line });
      /** Ermittelt die Farbe der Quell-Ebene. @param {object} plane Ebenendefinition. @returns {boolean} Zugehörigkeit. */
      function findPlane(plane) {
        return plane.id === graph.nodes[edge.source].plane;
      }
    }
    update(graph);
  }

  /** Überträgt verformte Knoten und Linien in die Darstellung. @param {object} graph Aktuelles Netz. @returns {void} Aktualisierte Geometrien. */
  function update(graph) {
    for (const node of graph.nodes) {
      const label = labels.get(node.id);
      label.object.position.fromArray(node.position);
      label.element.classList.toggle("pinned", node.pinned);
    }
    for (const { edge, line } of lines) {
      const positions = line.geometry.attributes.position;
      positions.setXYZ(0, ...graph.nodes[edge.source].position);
      positions.setXYZ(1, ...graph.nodes[edge.target].position);
      positions.needsUpdate = true;
      line.geometry.computeBoundingSphere();
      if (edge.kind === "shared") {
        line.computeLineDistances();
      }
    }
  }

  /** Zeichnet lesbare HTML-Beschriftungen an ihren 3D-Positionen. @param {THREE.Camera} camera Aktuelle Kamera. @returns {void} Aktualisierte Beschriftungen. */
  function renderLabels(camera) {
    labelRenderer.setSize(view.clientWidth, view.clientHeight);
    labelRenderer.render(scene, camera);
  }

  /** Schaltet die Referenzebenen um. @param {boolean} visible Gewünschte Sichtbarkeit. @returns {void} Kein Rückgabewert. */
  function setPlanes(visible) {
    surfaces.visible = visible;
  }

  return { rebuild, update, renderLabels, setPlanes, labels, bounds };
}
