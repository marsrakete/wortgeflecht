/**
 * Klont ein HTML-Template und sammelt seine Ausgabe- und Meldungsfelder.
 * @param {HTMLElement} target Zielcontainer, dessen Inhalt ersetzt wird.
 * @param {HTMLTemplateElement} template Struktur der Anzeige.
 * @returns {{values: Object<string, HTMLElement>, messages: Object<string, HTMLElement>}} Ergebnis der beschriebenen Operation.
 */
export function mountTemplate(target, template) {
  const fragment = template.content.cloneNode(true);
  target.replaceChildren(fragment);
  const values = {};
  for (const element of target.querySelectorAll("[data-value]")) {
    values[element.dataset.value] = element;
  }
  const messages = {};
  for (const element of target.querySelectorAll("[data-message]")) {
    messages[element.dataset.message] = element;
  }
  return { values, messages };
}
