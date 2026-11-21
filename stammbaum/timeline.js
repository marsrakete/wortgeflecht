import { lifeDates } from "./gedcom.js";
import { messages } from "./i18n.js";

const windowYears = 30;

function dateYear(date) {
  return Number(date.match(/\b\d{3,4}\b/)?.[0]) || null;
}

export function timelineEntries(people) {
  const lives = [];
  const events = [];

  for (const person of people) {
    const birth = dateYear(person.birth);
    const death = dateYear(person.death);
    if (birth !== null) events.push({ person, first: birth, last: birth, type: "birth" });
    if (death !== null) events.push({ person, first: death, last: death, type: "death" });
    if (birth !== null && death !== null && birth <= death) {
      lives.push({ person, first: birth, last: death, type: "life" });
    } else if (birth !== null || death !== null) {
      const year = birth ?? death;
      lives.push({ person, first: year, last: year, type: birth === null ? "death" : "birth" });
    }
  }

  for (const entries of [lives, events]) {
    entries.sort((a, b) => a.first - b.first || a.last - b.last);
  }
  return { lives, events };
}

export function createTimeline(dialog, onSelect) {
  const slider = dialog.querySelector("input");
  const heading = dialog.querySelector("output");
  const viewport = dialog.querySelector(".timeline-window");
  const axis = dialog.querySelector(".timeline-axis");
  const list = dialog.querySelector(".timeline-list");
  const empty = dialog.querySelector(".timeline-empty");
  const modes = [...dialog.querySelectorAll("[data-timeline-mode]")];
  const previous = dialog.querySelector("#timeline-previous");
  const next = dialog.querySelector("#timeline-next");
  let data, firstYear, lastYear, first, mode = "lives";
  let gesture, swiped = false;

  function render() {
    const last = Math.min(first + windowYears, lastYear);
    const span = Math.max(1, last - first);
    const percent = year => `${100 * (year - first) / span}%`;
    heading.textContent = first === last ? String(first) : `${first}–${last}`;
    slider.value = first;
    slider.setAttribute("aria-valuetext", heading.textContent);
    previous.disabled = first <= Number(slider.min);
    next.disabled = first >= Number(slider.max);

    axis.replaceChildren();
    const years = [first];
    for (let year = Math.ceil((first + 4) / 10) * 10; year <= last - 4; year += 10) years.push(year);
    if (last !== first) years.push(last);
    for (const year of years) {
      const tick = document.createElement("span");
      tick.textContent = year;
      tick.style.setProperty("--position", percent(year));
      axis.append(tick);
    }

    const visible = data[mode].filter(entry => entry.first <= last && entry.last >= first);
    empty.hidden = visible.length > 0;
    list.replaceChildren();
    for (const {person, first: start, last: end, type} of visible) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "timeline-person";
      button.textContent = person.name;
      const dates = document.createElement("small");
      dates.textContent = type === "birth" ? messages.birthDate(person.birth)
        : type === "death" ? messages.deathDate(person.death) : lifeDates(person);
      button.append(dates);
      button.addEventListener("click", () => {
        dialog.close();
        onSelect(person);
      });
      const track = document.createElement("span");
      track.className = "timeline-track";
      track.setAttribute("aria-hidden", "true");
      const mark = document.createElement("span");
      mark.className = "timeline-mark";
      mark.dataset.kind = type;
      mark.classList.toggle("point", start === end);
      mark.style.setProperty("--start", percent(Math.max(start, first)));
      mark.style.setProperty("--end", percent(Math.min(end, last)));
      track.append(mark);
      item.append(button, track);
      list.append(item);
    }
  }

  function go(year) {
    const target = Math.max(firstYear, Math.min(Number(slider.max), year));
    if (target === first) return;
    first = target;
    viewport.scrollTop = 0;
    render();
  }

  previous.addEventListener("click", () => go(first - 10));
  next.addEventListener("click", () => go(first + 10));
  slider.addEventListener("input", () => go(Number(slider.value)));
  dialog.querySelector("#timeline-close").addEventListener("click", () => dialog.close());
  for (const button of modes) {
    button.addEventListener("click", () => {
      mode = button.dataset.timelineMode;
      for (const option of modes) option.setAttribute("aria-pressed", String(option === button));
      if (!data.events.length) return;
      viewport.scrollTop = 0;
      render();
    });
  }

  viewport.addEventListener("pointerdown", event => {
    if (!event.isPrimary || event.button !== 0) return;
    swiped = false;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  viewport.addEventListener("pointercancel", () => { gesture = undefined; });
  viewport.addEventListener("pointerup", event => {
    if (gesture?.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = undefined;
    if (Math.abs(dx) < 35 || Math.abs(dx) < Math.abs(dy)) return;
    swiped = true;
    if (data.events.length) go(first - Math.sign(dx) * 10);
  });
  viewport.addEventListener("click", event => {
    if (swiped && event.detail > 0) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  return {
    open(people, focusedPerson) {
      data = timelineEntries(people);
      const available = data.events.length > 0;
      dialog.querySelector(".timeline-controls").hidden = !available;
      axis.hidden = list.hidden = !available;
      empty.textContent = available ? messages.timelineEmptyWindow : messages.timelineEmptyFile;
      empty.hidden = available;
      if (available) {
        firstYear = data.events[0].first;
        lastYear = data.events.at(-1).last;
        slider.min = firstYear;
        slider.max = Math.max(firstYear, lastYear - windowYears);
        slider.disabled = slider.min === slider.max;
        const focusYear = dateYear(focusedPerson.birth) ?? dateYear(focusedPerson.death) ?? firstYear;
        first = Math.max(firstYear, Math.min(Number(slider.max), focusYear - 5));
        render();
        viewport.scrollTop = 0;
      }
      dialog.showModal();
    },
  };
}
