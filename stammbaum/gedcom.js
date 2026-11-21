const filenameError = "Die Datei enthält keine lesbaren GEDCOM-Personen.";

export function parseGedcom(bytes) {
  const view = new Uint8Array(bytes);
  let encoding = "utf-8";
  if (view[0] === 0xff && view[1] === 0xfe) encoding = "utf-16le";
  if (view[0] === 0xfe && view[1] === 0xff) encoding = "utf-16be";

  let text;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder("windows-1252").decode(bytes);
  }

  const people = new Map();
  const families = new Map();
  let person, family, event;

  for (const line of text.split(/\r\n?|\n/)) {
    const parts = /^(\d+)\s+(?:(@[^@]+@)\s+)?(\w+)(?:\s+(.*))?$/.exec(line.trim());
    if (!parts) continue;
    const [, level, id, tag, value = ""] = parts;
    if (level === "0") {
      person = family = event = null;
      if (tag === "INDI" && id) {
        person = { id, names: [], birth: "", death: "", parents: new Set(), partners: new Set(), children: new Set() };
        people.set(id, person);
      }
      if (tag === "FAM" && id) {
        family = { parents: new Set(), children: new Set() };
        families.set(id, family);
      }
    } else if (level === "1") {
      event = tag;
      if (person && tag === "NAME") {
        const name = value.replaceAll("/", " ").replace(/\s+/g, " ").trim();
        if (name) person.names.push(name);
      }
      if (family && ["HUSB", "WIFE"].includes(tag)) family.parents.add(value);
      if (family && tag === "CHIL") family.children.add(value);
    } else if (level === "2" && person && tag === "DATE") {
      if (event === "BIRT") person.birth = value;
      if (event === "DEAT") person.death = value;
    }
  }
  if (!people.size) throw new Error(filenameError);

  for (const { parents, children } of families.values()) {
    for (const parentId of parents) {
      const parent = people.get(parentId);
      if (!parent) continue;
      for (const partnerId of parents) {
        if (partnerId !== parentId && people.has(partnerId)) parent.partners.add(partnerId);
      }
      for (const childId of children) {
        const child = people.get(childId);
        if (!child || childId === parentId) continue;
        parent.children.add(childId);
        child.parents.add(parentId);
      }
    }
  }

  for (const person of people.values()) person.name = person.names[0] || "Name unbekannt";
  return { people, familyCount: families.size };
}

function birthYear(person) {
  return Number(person.birth.match(/\b\d{3,4}\b/)?.[0] || Infinity);
}

export function findStart(people) {
  const ordered = [...people.values()].sort((a, b) => birthYear(a) - birthYear(b));
  return ordered.find(person => !person.parents.size && person.children.size)
    ?? ordered.find(person => !person.parents.size)
    ?? ordered[0];
}

export function searchName(value) {
  return value.toLocaleLowerCase("de").replaceAll("ß", "ss")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "").trim();
}
