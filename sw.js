importScripts("./version.js");

const APP_VERSION = globalThis.APP_VERSION_INFO?.cacheVersion || "v0";
const CACHE_NAME = `wortgeflecht-${APP_VERSION}`;
const APP_SHELL = [
  "./",
  "./index.html",  "./denkraum.html",
  "./styles/denkraum.css",
  "./denkraum/main.js",
  "./version.js",
  "./stammbaum.html",
  "./styles/stammbaum.css",
  "./stammbaum/main.js",
  "./stammbaum/gedcom.js",
  "./stammbaum/i18n.js",
  "./stammbaum/timeline.js",
  "./stammbaum/storage.js",
  "./stammbaum/graph.js",
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
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: "reload" })))).then(() => self.skipWaiting()));
}

/** Aktiviert den aktuellen Cache und entfernt alte Versionen. @param {ExtendableEvent} event Aktivierungsereignis. @returns {void} Kein Rückgabewert. */
function activate(event) {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  event.waitUntil(self.clients.claim());
}

function isTreeResource(url) {
  const scope = self.registration.scope;
  if (!url.startsWith(scope)) return false;
  const path = url.slice(scope.length).split(/[?#]/, 1)[0];
  return path === "stammbaum.html" || path.startsWith("stammbaum/") || path === "styles/stammbaum.css";
}

async function fetchTreeResource(request) {
  let response;
  try {
    response = await fetch(request, { cache: "reload" });
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }

  if (response.ok) {
    try {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    } catch {
      // The server response is still usable if browser storage is unavailable.
    }
  } else if (response.status >= 500) {
    return (await caches.match(request)) ?? response;
  }

  return response;
}

/** Liefert Cache-Inhalte offline und aktualisiert erfolgreiche App-Ressourcen. @param {FetchEvent} event Fetch-Ereignis. @returns {void} Kein Rückgabewert. */
function fetchResource(event) {
  if (event.request.method !== "GET" || event.request.cache === "no-store") {
    return;
  }
  if (event.request.url.startsWith(self.registration.scope) &&
    (isTreeResource(event.request.url) || isTreeResource(event.request.referrer))) {
    event.respondWith(fetchTreeResource(event.request));
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
