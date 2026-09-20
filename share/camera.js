import * as THREE from "three";
/**
 * Rahmt die sichtbaren Körper ein und erhält die Blickrichtung.
 * @param {THREE.PerspectiveCamera} camera Kamera der Ansicht.
 * @param {OrbitControls} controls Steuerung mit aktuellem Blickziel.
 * @param {THREE.Object3D[]} objects Einzurahmende Körper.
 * @returns {void} Ändert Kamera und Blickziel.
 */
export function fitCameraToObjects(camera, controls, objects) {
  const box = new THREE.Box3();
  let found = false;
  for (const o of objects) {
    o.updateWorldMatrix(true, true);
    const b = new THREE.Box3().setFromObject(o);
    if (!b.isEmpty()) {
      box.union(b);
      found = true;
    }
  }
  if (!found || camera.aspect <= 0) {
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  // Viewing direction stays intuitive, but framing is recalculated.
  let dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  if (dir.lengthSq() < 0.001) {
    dir.set(1, 0.8, 1);
  }
  dir.normalize();

  // Use the bounding sphere. This is deliberately more generous than the
  // previous box fit and avoids clipping near the bottom on wide/narrow screens.
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const halfFov = Math.max(0.15, Math.min(vFov, hFov) / 2);
  const distance = (sphere.radius / Math.sin(halfFov)) * 1.32;

  // A target slightly BELOW the geometric centre moves the model UP on screen.
  // This leaves comfortable space below it on desktop and mobile.
  const verticalPad = Math.max(size.y, size.z, size.x) * 0.1;
  const target = center.clone();
  target.y -= verticalPad;

  controls.target.copy(target);
  camera.position.copy(target).add(dir.multiplyScalar(distance));
  camera.near = Math.max(0.01, distance - sphere.radius * 2.5);
  camera.far = Math.max(100, distance + sphere.radius * 10);
  camera.updateProjectionMatrix();
  controls.update();
}
