importScripts("./version.js");

const APP_VERSION = globalThis.APP_VERSION_INFO?.cacheVersion || "v0";
const CACHE_NAME = `wortgeflecht-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./version.js",
  "./styles/word-network.css",
  "./word-network/main.js",
  "./word-network/config.js",
  "./word-network/graph.js",
  "./word-network/model.js",
  "./word-network/interaction.js",
  "./word-network/simulation.js",
  "./share/viewport.js",
  "./share/camera.js",
  "./share/resources.js",
  "./share/template.js",
  "./share/storage.js",
  "./manifest.webmanifest",
  "./assets/wortgeflecht-favicon.svg",
  "./assets/wortgeflecht-icon-192.png",
  "./assets/wortgeflecht-icon-512.png",
  "./assets/wortgeflecht-og.svg",
  "./vendor/three/build/three.module.js",
  "./vendor/three/build/three.core.js",
  "./vendor/three/examples/jsm/controls/OrbitControls.js",
  "./vendor/three/examples/jsm/renderers/CSS2DRenderer.js",
];

/** Installiert den App-Shell-Cache für den ersten Offline-Aufruf. @param {ExtendableEvent} event Installationsereignis. @returns {void} Kein Rückgabewert. */
function install(event) {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
}

/** Aktiviert den aktuellen Cache und entfernt alte Versionen. @param {ExtendableEvent} event Aktivierungsereignis. @returns {void} Kein Rückgabewert. */
function activate(event) {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  event.waitUntil(self.clients.claim());
}

/** Liefert Cache-Inhalte offline und aktualisiert erfolgreiche App-Ressourcen. @param {FetchEvent} event Fetch-Ereignis. @returns {void} Kein Rückgabewert. */
function fetchResource(event) {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(event.request).then((response) => {
      if (response.ok && new URL(event.request.url).origin === self.location.origin) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    });
  }));
}

self.addEventListener("install", install);
self.addEventListener("activate", activate);
self.addEventListener("fetch", fetchResource);
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
