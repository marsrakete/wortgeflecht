import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
/**
 * Erzeugt Szene, Kamera, Beleuchtung und größenabhängige Orbit-Ansicht.
 * @param {HTMLElement} view Container für die Zeichenfläche.
 * @param {object} options Kamera- und Lichtparameter sowie optionaler onResize-Callback.
 * @returns {{scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, controls: OrbitControls}} Ergebnis der beschriebenen Operation.
 */
export function createViewport(view, options) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111);
  const camera = new THREE.PerspectiveCamera(options.fov, 1, 0.05, 100);
  camera.position.set(...options.position);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  view.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(...options.target);
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  scene.add(
    new THREE.HemisphereLight(
      0xffffff,
      options.groundColor,
      options.lightIntensity,
    ),
  );
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(...options.lightPosition);
  scene.add(light);
  /**
   * Passt Zeichenfläche und Projektionsmatrix an den Container an.
   * Keine Parameter.
   * @returns {void} Ergebnis der beschriebenen Operation.
   */
  function resize() {
    const width = view.clientWidth,
      height = view.clientHeight;
    if (!width || !height) {
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (options.onResize) {
      options.onResize();
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(view);
  resize();
  return { scene, camera, renderer, controls };
}
