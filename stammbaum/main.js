import "../version.js";
import { parseGedcom, findStart, searchName, generationRows, connectedGenerationRows, lifeDates } from "./gedcom.js";
import { accessImport } from "./storage.js";
import { createTimeline } from "./timeline.js";
import { locale, messages } from "./i18n.js";

document.documentElement.lang = locale;
for (const node of document.querySelectorAll("[data-i18n]")) {
  node.textContent = messages[node.dataset.i18n];
}
for (const node of document.querySelectorAll("[data-i18n-label]")) {
  node.setAttribute("aria-label", messages[node.dataset.i18nLabel]);
}
for (const node of document.querySelectorAll("[data-i18n-title]")) {
  node.title = messages[node.dataset.i18nTitle];
}

const byId = id => document.getElementById(id);
const version = byId("app-version");
version.textContent = messages.version(globalThis.APP_VERSION_INFO.appVersion);
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
const relations = ["parents", "partners", "children"];
const searchLimit = 50;
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
  const button = element("button", dates ? [person.name, dates].join(messages.separator) : person.name);
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

  const groups = Object.fromEntries(relations.map(key => [
    key, [...person[key]].map(id => tree.people.get(id)),
  ]));
  for (const key of relations) {
    if (!groups[key].length) continue;
    const list = element("ul", "");
    for (const relative of groups[key]) {
      const item = element("li", "");
      item.append(personButton(relative, next => select(next, true)));
      list.append(item);
    }
    details.append(element("h3", messages[key]), list);
  }
  renderGraph();
  hint.textContent = graphUnavailable
    ? messages.graphUnavailable
    : messages.graphControls;
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
  for (const person of matches.slice(0, searchLimit)) {
    const item = element("li", "");
    item.append(personButton(person, choose));
    results.append(item);
  }
  byId("result-status").textContent = terms.length
    ? messages.resultCount(matches.length, searchLimit)
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
  const summary = messages.importSummary(filename, tree.people.size, tree.familyCount);
  status.textContent = saved ? summary : [summary, messages.saveFailed].join(messages.separator);
  byId("tools").hidden = false;
  searchButton.disabled = false;
  datesButton.hidden = generationControls.hidden = !graph;
  select(findStart(tree.people));
  openSearch();
}

searchButton.addEventListener("click", openSearch);
const timeline = createTimeline(byId("timeline"), person => select(person, true));
byId("timeline-open").addEventListener("click", () => timeline.open(tree.people.values(), focusedPerson));
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
    status.textContent = messages.importFailed(error.message);
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
    hint.textContent = messages.chooseFile;
    status.textContent = messages.importDeleted;
  } catch {
    status.textContent = messages.deleteFailed;
  } finally {
    setBusy(false);
    if (!tree) fileInput.focus();
  }
});

setBusy(true);
try {
  const saved = await accessImport("readonly", store => store.get("current"));
  if (saved) await showTree(parseGedcom(saved.bytes), saved.filename);
  else status.textContent = messages.noImport;
} catch {
  status.textContent = messages.loadFailed;
} finally {
  setBusy(false);
}
