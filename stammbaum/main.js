import { parseGedcom, findStart, searchName } from "./gedcom.js";
import { accessImport } from "./storage.js";

const byId = id => document.getElementById(id);
const fileInput = byId("gedcom");
const status = byId("status");
const picker = byId("picker");
const query = byId("query");
const results = byId("results");
const details = byId("person");
const hint = byId("hint");
const remove = byId("remove");
const relations = [
  ["parents", "Eltern"],
  ["partners", "Partner"],
  ["children", "Kinder"],
];
let tree, graph;
let graphUnavailable = false;

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function life(person) {
  return [person.birth && `* ${person.birth}`, person.death && `† ${person.death}`]
    .filter(Boolean).join(" · ");
}

function personButton(person, onSelect) {
  const dates = life(person);
  const button = element("button", dates ? `${person.name} · ${dates}` : person.name);
  button.addEventListener("click", () => onSelect(person));
  return button;
}

function select(person, moveFocus = false) {
  const heading = element("h2", person.name);
  heading.tabIndex = -1;
  details.replaceChildren(heading);
  const dates = life(person);
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
  graph?.show(person, groups, next => select(next, true));
  hint.textContent = graphUnavailable
    ? "3D ist in diesem Browser nicht verfügbar. Die Verwandtenliste bleibt nutzbar."
    : "Ziehen zum Drehen · Scrollen oder Geste zum Zoomen";
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

function choose(person) {
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
  if (!graph && !graphUnavailable) {
    try {
      const { createGraph } = await import("./graph.js");
      graph = createGraph(byId("view"));
    } catch {
      graphUnavailable = true;
    }
  }
  status.textContent = `${filename} · ${tree.people.size} Personen · ${tree.familyCount} Familien`
    + (saved ? "" : " · Speichern fehlgeschlagen. Der Import ist bis zum Schließen dieser Seite verfügbar.");
  byId("tools").hidden = false;
  select(findStart(tree.people));
  openSearch();
}

byId("search").addEventListener("click", openSearch);
byId("close").addEventListener("click", () => picker.close());
byId("start").addEventListener("click", () => choose(findStart(tree.people)));
query.addEventListener("input", renderSearch);
query.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing) return;
  event.preventDefault();
  const person = query.value.trim() ? renderSearch()[0] : findStart(tree.people);
  if (person) choose(person);
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
    tree = undefined;
    graph?.clear();
    details.replaceChildren();
    query.value = "";
    results.replaceChildren();
    byId("tools").hidden = true;
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
