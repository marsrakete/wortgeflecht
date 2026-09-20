# Wortgeflecht

Wortgeflecht ist ein eigenständiges Three.js-Projekt. Es gehört nicht zum
Pyramiden- oder Kegelschnittmodell.

Öffne es über den Projektserver unter:

```text
http://127.0.0.1:4173/Wortgeflecht/
```

Die drei Eingabefelder gehören zu den Ebenen XY, YZ und XZ. Wörter werden je
Ebene als Kette verbunden. Ein identisches Wort in mehreren Feldern erzeugt
zusätzliche gestrichelte 3D-Verbindungen.

Wörter lassen sich mit Maus oder Touch herausziehen. Das Netz reagiert mit
gedämpften Federkräften; der herausgezogene Knoten bleibt fixiert. Die Ansicht
kann gedreht und automatisch rotiert werden. `Reset` setzt Knoten und Kamera
zurück, behält aber die Eingaben.

## Eigenständigkeit

- `index.html`: eigene Oberfläche und Templates
- `word-network/`: Graph, Simulation, Modell, Interaktion und Einstieg
- `share/`: eigene Kopien der benötigten Viewport-, Kamera-, Template- und
  Ressourcenmodule
- `styles/`: eigenes Stylesheet
- `manifest.webmanifest` und `pyramiden-icon.png`: eigene App-Metadaten

Das Projekt verwendet nur Three.js und seine Orbit-/CSS2D-Erweiterungen über
die Importmap. Es importiert keine Module aus dem übergeordneten Geometrieprojekt.
