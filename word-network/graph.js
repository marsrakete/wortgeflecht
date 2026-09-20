import { planes, maximumWords } from "./config.js";

/**
 * Trennt Wörter und entfernt Wiederholungen unabhängig von Unicode-Schreibweise und Großschreibung.
 * @param {string} text Eingabe eines Feldes.
 * @returns {{words: Array<object>, omitted: number}} Erste Wörter mit Normalisierungsschlüssel und Anzahl ausgelassener Wörter.
 */
export function parseWords(text) {
  if (typeof text !== "string") {
    throw new TypeError("Expected text");
  }
  const unique = new Map();
  for (const word of text.trim().split(/\s+/u)) {
    if (!word) {
      continue;
    }
    const key = word.normalize("NFC").toLocaleLowerCase("de");
    if (!unique.has(key)) {
      unique.set(key, { text: word, key });
    }
  }
  return {
    words: [...unique.values()].slice(0, maximumWords),
    omitted: Math.max(0, unique.size - maximumWords),
  };
}

/**
 * Erzeugt je Ebene eine Wortkette und verbindet identische Wörter zwischen den Ebenen.
 * @param {string[]} inputs Genau drei Texte in der Reihenfolge X, Y, Z.
 * @returns {{nodes: object[], edges: object[], omitted: number, extent: number}} Unverformtes räumliches Netz.
 */
export function buildGraph(inputs) {
  if (!Array.isArray(inputs) || inputs.length !== 3) {
    throw new TypeError("Expected three inputs");
  }
  const nodes = [],
    edges = [],
    matches = new Map();
  let omitted = 0,
    extent = 5;
  for (let planeIndex = 0; planeIndex < planes.length; planeIndex++) {
    const plane = planes[planeIndex],
      parsed = parseWords(inputs[planeIndex]);
    omitted += parsed.omitted;
    const columns = Math.max(2, Math.ceil(Math.sqrt(parsed.words.length)));
    const rows = Math.ceil(parsed.words.length / columns);
    let previous = null;
    for (let index = 0; index < parsed.words.length; index++) {
      const row = Math.floor(index / columns);
      let column = index % columns;
      if (row % 2 === 1) {
        column = columns - 1 - column;
      }
      const position = [0, 0, 0];
      position[plane.axes[0]] =
        (column - (columns - 1) / 2) * 3.4 + plane.offset[0];
      position[plane.axes[1]] = (row - (rows - 1) / 2) * 2.4 + plane.offset[1];
      extent = Math.max(extent, ...position.map(Math.abs));
      const node = {
        ...parsed.words[index],
        id: nodes.length,
        plane: plane.id,
        origin: position,
        position: [...position],
        velocity: [0, 0, 0],
        pinned: false,
      };
      nodes.push(node);
      if (previous !== null) {
        edges.push(makeEdge(nodes[previous], node, "chain"));
      }
      previous = node.id;
      let related = matches.get(node.key);
      if (!related) {
        related = [];
        matches.set(node.key, related);
      }
      for (const other of related) {
        edges.push(makeEdge(other, node, "shared"));
      }
      related.push(node);
    }
  }
  return { nodes, edges, omitted, extent: extent + 1.5 };
}

/**
 * Speichert die ursprüngliche Länge einer elastischen Verbindung.
 * @param {object} a Erster Knoten.
 * @param {object} b Zweiter Knoten.
 * @param {string} kind Verbindungstyp chain oder shared.
 * @returns {object} Knotenindizes, Typ und Ruhelänge.
 */
function makeEdge(a, b, kind) {
  return {
    source: a.id,
    target: b.id,
    kind,
    length: Math.hypot(...a.position.map(difference)),
  };
  /** Berechnet eine Koordinatendifferenz. @param {number} value Quellkoordinate. @param {number} axis Achsenindex. @returns {number} Differenz. */
  function difference(value, axis) {
    return value - b.position[axis];
  }
}
