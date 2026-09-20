import * as THREE from "three";
import { pinNode } from "./simulation.js";

/**
 * Bindet Pointer- und Tastatursteuerung für Wortknoten; Ziehen erfolgt in einer kameranormalen Ebene.
 * @param {object} options Viewport, Container, getGraph und onGrab als explizite Abhängigkeiten.
 * @returns {{cancel: Function}} Abbruchfunktion vor Reset oder Netzaustausch.
 */
export function createInteraction({
  view,
  camera,
  controls,
  getGraph,
  onGrab,
}) {
  const raycaster = new THREE.Raycaster(),
    pointer = new THREE.Vector2(),
    dragPlane = new THREE.Plane();
  const offset = new THREE.Vector3();
  let active = null;
  view.addEventListener("pointerdown", start);
  view.addEventListener("pointermove", move);
  view.addEventListener("pointerup", end);
  view.addEventListener("pointercancel", end);
  view.addEventListener("lostpointercapture", end);
  view.addEventListener("keydown", keydown);

  /** Berechnet den Treffpunkt des Zeigers mit der Ziehebene. @param {PointerEvent} event Zeigerereignis. @returns {THREE.Vector3|null} Räumlicher Treffpunkt. */
  function intersection(event) {
    const rect = view.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.ray.intersectPlane(dragPlane, new THREE.Vector3());
  }

  /** Beginnt die Knotenbewegung und pausiert die Kamerasteuerung. @param {PointerEvent} event Zeigerereignis. @returns {void} Kein Rückgabewert. */
  function start(event) {
    const element = event.target.closest("[data-node]");
    if (!element || active || event.button !== 0) {
      return;
    }
    const node = getGraph().nodes[Number(element.dataset.node)];
    if (!node) {
      return;
    }
    onGrab();
    controls.enabled = false;
    const position = new THREE.Vector3(...node.position);
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      position,
    );
    const point = intersection(event);
    if (!point) {
      controls.enabled = true;
      return;
    }
    offset.copy(position).sub(point);
    active = { node, element, pointerId: event.pointerId };
    element.classList.add("dragging");
    element.setPointerCapture(event.pointerId);
    element.focus({ preventScroll: true });
    event.preventDefault();
    event.stopPropagation();
  }

  /** Fixiert den aktiven Knoten am aktuellen räumlichen Zeigerort. @param {PointerEvent} event Zeigerereignis. @returns {void} Kein Rückgabewert. */
  function move(event) {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    const point = intersection(event);
    if (point) {
      pinNode(active.node, point.add(offset).toArray());
    }
    event.preventDefault();
  }

  /** Beendet ausschließlich die passende Zeigerinteraktion. @param {PointerEvent} event Zeigerereignis. @returns {void} Kein Rückgabewert. */
  function end(event) {
    if (active && active.pointerId === event.pointerId) {
      cancel();
    }
  }

  /** Gibt Pointer-Capture und Kamerasteuerung frei. Keine Parameter. @returns {void} Kein Rückgabewert. */
  function cancel() {
    if (active) {
      const previous = active;
      active = null;
      previous.element.classList.remove("dragging");
      if (previous.element.hasPointerCapture(previous.pointerId)) {
        previous.element.releasePointerCapture(previous.pointerId);
      }
    }
    controls.enabled = true;
  }

  /** Verschiebt fokussierte Knoten mit Pfeiltasten parallel zum Bildschirm. @param {KeyboardEvent} event Tastaturereignis. @returns {void} Kein Rückgabewert. */
  function keydown(event) {
    const element = event.target.closest("[data-node]");
    if (
      !element ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    ) {
      return;
    }
    const node = getGraph().nodes[Number(element.dataset.node)];
    if (!node) {
      return;
    }
    onGrab();
    const direction = new THREE.Vector3();
    if (event.key === "ArrowLeft") {
      direction.x = -0.4;
    } else if (event.key === "ArrowRight") {
      direction.x = 0.4;
    } else if (event.key === "ArrowUp") {
      direction.y = 0.4;
    } else {
      direction.y = -0.4;
    }
    direction
      .applyQuaternion(camera.quaternion)
      .add(new THREE.Vector3(...node.position));
    pinNode(node, direction.toArray());
    event.preventDefault();
  }
  return { cancel };
}
