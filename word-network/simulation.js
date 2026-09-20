import { simulationSettings as settings } from "./config.js";

/**
 * Bewegt und fixiert einen Knoten, damit er nach dem Loslassen am neuen Ort bleibt.
 * @param {object} node Zu bewegender Knoten.
 * @param {number[]} position Endliche XYZ-Koordinaten.
 * @returns {void} Ändert Position, Geschwindigkeit und Fixierung.
 */
export function pinNode(node, position) {
  if (
    !node ||
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every(Number.isFinite)
  ) {
    throw new TypeError("Expected node and finite XYZ position");
  }
  node.position = [...position];
  node.velocity = [0, 0, 0];
  node.pinned = true;
}

/**
 * Berechnet gedämpfte Federn mit schwacher Bindung an die Ausgangsebenen.
 * @param {object} graph Netz mit Knoten und Kanten.
 * @param {number} elapsed Zeit seit dem letzten Bild in Sekunden.
 * @returns {void} Bewegt ausschließlich nicht fixierte Knoten in begrenzten Teilschritten.
 */
export function stepSimulation(graph, elapsed) {
  if (!Number.isFinite(elapsed) || elapsed < 0) {
    throw new TypeError("Expected nonnegative finite time");
  }
  let remaining = Math.min(elapsed, 0.05);
  while (remaining > 0) {
    const dt = Math.min(remaining, settings.maxStep);
    const forces = graph.nodes.map(anchorForce);
    for (const edge of graph.edges) {
      const a = graph.nodes[edge.source],
        b = graph.nodes[edge.target];
      const delta = [
        b.position[0] - a.position[0],
        b.position[1] - a.position[1],
        b.position[2] - a.position[2],
      ];
      const distance = Math.hypot(...delta);
      if (distance < 1e-8) {
        continue;
      }
      const strength = (settings.spring * (distance - edge.length)) / distance;
      for (let axis = 0; axis < 3; axis++) {
        forces[a.id][axis] += delta[axis] * strength;
        forces[b.id][axis] -= delta[axis] * strength;
      }
    }
    for (const node of graph.nodes) {
      if (node.pinned) {
        continue;
      }
      for (let axis = 0; axis < 3; axis++) {
        node.velocity[axis] =
          (node.velocity[axis] + forces[node.id][axis] * dt) *
          Math.exp(-settings.damping * dt);
        node.position[axis] += node.velocity[axis] * dt;
      }
    }
    remaining -= dt;
  }
}

/** Erstellt die rückstellende Kraft eines Knotens. @param {object} node Knoten mit Ausgangsposition. @returns {number[]} Kraft pro Achse. */
function anchorForce(node) {
  const force = [];
  for (let axis = 0; axis < 3; axis++) {
    force.push((node.origin[axis] - node.position[axis]) * settings.anchor);
  }
  return force;
}

/** Setzt das Netz exakt in seine Ebenen zurück. @param {object} graph Verformtes Netz. @returns {void} Entfernt auch Fixierungen und Geschwindigkeiten. */
export function resetGraph(graph) {
  for (const node of graph.nodes) {
    node.position = [...node.origin];
    node.velocity = [0, 0, 0];
    node.pinned = false;
  }
}
