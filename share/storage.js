const DATABASE_NAME = "wortgeflecht";
const DATABASE_VERSION = 3;
const CLOUD_STORE = "clouds";
const PROJECT_STORE = "projects";
const SETTINGS_STORE = "settings";

/** Erzeugt eine stabile lokale ID. @returns {string} UUID. */
function createId() {
  if (globalThis.crypto && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

/** Öffnet die IndexedDB mit Wortwolken- und Projektablage. @returns {Promise<IDBDatabase>} Datenbank. */
function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) { reject(new Error("IndexedDB ist nicht verfügbar")); return; }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CLOUD_STORE)) { database.createObjectStore(CLOUD_STORE, { keyPath: "id" }); }
      if (!database.objectStoreNames.contains(PROJECT_STORE)) { database.createObjectStore(PROJECT_STORE, { keyPath: "id" }); }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) { database.createObjectStore(SETTINGS_STORE); }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB konnte nicht geöffnet werden"));
  });
}

/** Führt eine IndexedDB-Transaktion aus. @param {string} storeName Speichername. @param {IDBTransactionMode} mode Zugriffsmodus. @param {(store: IDBObjectStore) => IDBRequest} operation Datenbankoperation. @returns {Promise<any>} Ergebnis. */
async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  return await new Promise((resolve, reject) => {
    const request = operation(database.transaction(storeName, mode).objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Liest alle universellen Wortwolken. @returns {Promise<object[]>} Wortwolken. */
export async function listClouds() { return await transact(CLOUD_STORE, "readonly", (store) => store.getAll()); }
/** Speichert eine Wortwolke. @param {object} cloud Wortwolke mit id, name und text. @returns {Promise<object>} Gespeicherte Wortwolke. */
export async function putCloud(cloud) { return await transact(CLOUD_STORE, "readwrite", (store) => store.put(cloud)); }
/** Löscht eine Wortwolke. @param {string} id Wortwolken-ID. @returns {Promise<void>} Abgeschlossen. */
export async function deleteCloud(id) { await transact(CLOUD_STORE, "readwrite", (store) => store.delete(id)); }
/** Liest alle autarken Projekte. @returns {Promise<object[]>} Projekte. */
export async function listProjects() { return await transact(PROJECT_STORE, "readonly", (store) => store.getAll()); }
/** Speichert ein autarkes Projekt. @param {object} project Projekt mit eingebetteten clouds. @returns {Promise<object>} Gespeichertes Projekt. */
export async function putProject(project) { return await transact(PROJECT_STORE, "readwrite", (store) => store.put(project)); }
/** Löscht ein Projekt. @param {string} id Projekt-ID. @returns {Promise<void>} Abgeschlossen. */
export async function deleteProject(id) { await transact(PROJECT_STORE, "readwrite", (store) => store.delete(id)); }
/** Baut eine neue Wortwolke aus einem Eingabefeld. @param {string} text Feldtext. @returns {object} Neue Wortwolke. */
export function createCloud(text) {
  const firstWord = text.trim().split(/\s+/u)[0] || "Ohne Namen";
  const now = new Date().toISOString();
  return { id: createId(), name: `Wortwolke ${firstWord}`, text, createdAt: now, updatedAt: now, schemaVersion: 1 };
}
/** Baut ein autarkes Projekt aus drei Wortwolken. @param {string} name Projektname. @param {object[]} clouds Drei Wortwolken. @returns {object} Neues Projekt. */
export function createProject(name, clouds) {
  const now = new Date().toISOString();
  return { id: createId(), name, clouds: { x: structuredClone(clouds[0]), y: structuredClone(clouds[1]), z: structuredClone(clouds[2]) }, createdAt: now, updatedAt: now, schemaVersion: 1 };
}

/** Lädt die zuletzt verwendeten Texte als Kompatibilitäts- und Startwert. @returns {Promise<string[]|null>} Drei Texte oder null. */
export async function loadInputs() {
  try {
    return await transact(SETTINGS_STORE, "readonly", (store) => store.get("lastInputs"));
  } catch (error) {
    console.warn("Letzte Eingaben konnten nicht geladen werden.", error);
    return null;
  }
}
/** Speichert die zuletzt verwendeten Texte für den nächsten Start. @param {string[]} inputs Drei Texte. @returns {Promise<void>} Abgeschlossen. */
export async function saveInputs(inputs) {
  if (!Array.isArray(inputs) || inputs.length !== 3) { throw new TypeError("Expected three inputs"); }
  await transact(SETTINGS_STORE, "readwrite", (store) => store.put([...inputs], "lastInputs"));
}