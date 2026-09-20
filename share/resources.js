/**
 * Entfernt alle Kinder und gibt ihre Geometrien und Materialien frei.
 * @param {THREE.Group} group Gruppe mit exklusiv besessenen Ressourcen.
 * @returns {void} Ergebnis der beschriebenen Operation.
 */
export function clearGroup(group) {
  for (const child of [...group.children]) {
    child.traverse(disposeObject);
    group.remove(child);
  }
}
/**
 * Gibt die GPU-Ressourcen eines einzelnen Objekts frei.
 * @param {THREE.Object3D} object Objekt mit optionaler Geometrie und Materialien.
 * @returns {void} Ergebnis der beschriebenen Operation.
 */
function disposeObject(object) {
  if (object.geometry) {
    object.geometry.dispose();
  }
  if (Array.isArray(object.material)) {
    for (const material of object.material) {
      material.dispose();
    }
  } else if (object.material) {
    object.material.dispose();
  }
}
