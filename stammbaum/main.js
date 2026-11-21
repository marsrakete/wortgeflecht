import "../version.js";
import { parseGedcom, findStart, searchName, generationRows, connectedGenerationRows, lifeDates } from "./gedcom.js";
import { accessImport } from "./storage.js";

const byId = id => document.getElementById(id);
const version = byId("app-version");
version.textContent = `v${globalThis.APP_VERSION_INFO.appVersion}`;
version.hidden = false;

const fileInput = byId("gedcom");
const status = byId("status");
const picker = byId("picker");
const searchButton = byId("search");
const query = byId("query");
const results = byId("results");
const details = byId("person");
const pathList = byId("person-path");
const hint = byId("hint");
const remove = byId("remove");
const datesButton = byId("dates");
const view = byId("view");
const generationControls = byId("generations");
const generationButtons = [...generationControls.querySelectorAll("button")];
const relations = [
  ["parents", "Eltern"],
  ["partners", "Partner"],
  ["children", "Kinder"],
];
let tree, graph, focusedPerson;
let depth = "1";
let path = [];
let graphUnavailable = false;

navigator.serviceWorker?.register(new URL("../sw.js", import.meta.url), { updateViaCache: "none" })
  .catch(() => {});

datesButton.addEventListener("click", () => {
  const showDates = view.classList.toggle("show-dates");
  datesButton.setAttribute("aria-pressed", String(showDates));
});

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function personButton(person, onSelect) {
  const dates = lifeDates(person);
  const button = element("button", dates ? `${person.name} · ${dates}` : person.name);
  button.addEventListener("click", () => onSelect(person));
  return button;
}

function renderGraph() {
  if (!graph) return;
  const all = depth === "all";
  const rows = all
    ? connectedGenerationRows(focusedPerson, tree.people)
    : generationRows(focusedPerson, tree.people, Number(depth));
  graph.show(focusedPerson, rows, next => select(next, true), all);
}

function setDepth(value) {
  depth = value;
  for (const button of generationButtons) {
    button.setAttribute("aria-pressed", String(button.value === depth));
  }
}

for (const button of generationButtons) {
  button.addEventListener("click", () => {
    const requested = button.value;
    setDepth(requested === depth ? "1" : requested);
    renderGraph();
  });
}

function select(person, moveFocus = false) {
  focusedPerson = person;
  const previous = path.findIndex(entry => entry.id === person.id);
  if (previous === -1) path.push(person);
  else path = path.slice(0, previous + 1);

  pathList.replaceChildren();
  for (const entry of path) {
    const item = element("li", "");
    if (entry === person) {
      item.append(element("span", entry.name));
      item.firstElementChild.setAttribute("aria-current", "step");
    } else {
      const button = element("button", entry.name);
      button.addEventListener("click", () => select(entry, true));
      item.append(button);
    }
    pathList.append(item);
  }

  const heading = element("h2", person.name);
  heading.tabIndex = -1;
  details.replaceChildren(heading);
  const dates = lifeDates(person);
  if (dates) details.append(element("p", dates));

  const groups = Object.fromEntries(relations.map(([key]) => [
    key, [...person[key]].map(id => tree.people.get(id)),
  ]));
  for (const [key, label] of relations) {
    if (!groups[key].length) continue;
    const list = element("ul", "");
    for (const relative of groups[key]) {
      const item = element("li", "");
      item.append(personButton(relative, next => select(next, true)));
      list.append(item);
    }
    details.append(element("h3", label), list);
  }
  renderGraph();
  hint.textContent = graphUnavailable
    ? "3D ist in diesem Browser nicht verfügbar. Die Verwandtenliste bleibt nutzbar."
    : "Personen ziehen zum Verschieben · Hintergrund ziehen zum Drehen · Scrollen zum Zoomen";
  if (moveFocus) heading.focus({ preventScroll: true });
}

function renderSearch() {
  const terms = searchName(query.value).split(/\s+/).filter(Boolean);
  const matches = terms.length ? [...tree.people.values()].filter(person =>
    (person.names.length ? person.names : [person.name]).some(name =>
      terms.every(term => searchName(name).includes(term)),
    ),
  ) : [];
  results.replaceChildren();
  for (const person of matches.slice(0, 50)) {
    const item = element("li", "");
    item.append(personButton(person, choose));
    results.append(item);
  }
  byId("result-status").textContent = terms.length
    ? `${matches.length} Treffer${matches.length > 50 ? " · die ersten 50 werden angezeigt" : ""}`
    : "";
  return matches;
}

function choose(person, resetPath = false) {
  if (resetPath) path = [];
  picker.close();
  select(person, true);
}

function openSearch() {
  query.value = "";
  renderSearch();
  if (!picker.open) picker.showModal();
  query.focus();
}

async function showTree(data, filename, saved = true) {
  tree = data;
  setDepth("1");
  path = [];
  if (!graph && !graphUnavailable) {
    try {
      const { createGraph } = await import("./graph.js");
      graph = createGraph(view);
    } catch {
      graphUnavailable = true;
    }
  }
  status.textContent = `${filename} · ${tree.people.size} Personen · ${tree.familyCount} Familien`
    + (saved ? "" : " · Speichern fehlgeschlagen. Der Import ist bis zum Schließen dieser Seite verfügbar.");
  byId("tools").hidden = false;
  searchButton.disabled = false;
  datesButton.hidden = generationControls.hidden = !graph;
  select(findStart(tree.people));
  openSearch();
}

searchButton.addEventListener("click", openSearch);
byId("close").addEventListener("click", () => picker.close());
byId("start").addEventListener("click", () => choose(findStart(tree.people), true));
query.addEventListener("input", renderSearch);
query.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  const empty = !query.value.trim();
  const person = empty ? findStart(tree.people) : renderSearch()[0];
  if (person) choose(person, empty);
});

function setBusy(busy) {
  fileInput.disabled = remove.disabled = busy;
}

fileInput.addEventListener("change", async () => {
  const [file] = fileInput.files;
  if (!file) return;
  setBusy(true);
  try {
    const bytes = await file.arrayBuffer();
    const parsed = parseGedcom(bytes);
    let saved = true;
    try {
      await accessImport("readwrite", store => store.put({ bytes, filename: file.name }, "current"));
    } catch {
      saved = false;
    }
    await showTree(parsed, file.name, saved);
  } catch (error) {
    status.textContent = `Import fehlgeschlagen. ${error.message}`;
  } finally {
    fileInput.value = "";
    setBusy(false);
  }
});

remove.addEventListener("click", async () => {
  setBusy(true);
  try {
    await accessImport("readwrite", store => store.delete("current"));
    tree = focusedPerson = undefined;
    path = [];
    pathList.replaceChildren();
    graph?.clear();
    details.replaceChildren();
    query.value = "";
    results.replaceChildren();
    byId("tools").hidden = true;
    searchButton.disabled = true;
    hint.textContent = "Wähle eine GEDCOM-Datei, um den Stammbaum zu öffnen.";
    status.textContent = "Import gelöscht.";
  } catch {
    status.textContent = "Der gespeicherte Import konnte nicht gelöscht werden.";
  } finally {
    setBusy(false);
    if (!tree) fileInput.focus();
  }
});

setBusy(true);
try {
  const saved = await accessImport("readonly", store => store.get("current"));
  if (saved) await showTree(parseGedcom(saved.bytes), saved.filename);
  else status.textContent = "Noch kein Stammbaum importiert.";
} catch {
  status.textContent = "Der gespeicherte Stammbaum konnte nicht geladen werden.";
} finally {
  setBusy(false);
}
