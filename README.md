# Wortgeflecht

Eigenständiges Three.js-Projekt: Drei Texte bilden Wortketten in den Ebenen XY,
YZ und XZ. Identische Wörter verbinden die Ebenen durch gestrichelte Linien.
Wörter lassen sich mit Maus, Touch oder Pfeiltasten verschieben und fixieren.
`Reset` setzt Netz und Kamera zurück und behält die Eingaben.

## Lokal starten

Voraussetzung: Node.js ab Version 22 mit npm. Alle Befehle im Projektordner
`C:\Projekte\wortgeflecht` ausführen:

```powershell
npm ci
npm start
```

Anschließend [http://127.0.0.1:4173/](http://127.0.0.1:4173/) öffnen.
Der Server liefert diesen Projektordner direkt aus; ein zusätzlicher Pfad
`/Wortgeflecht/` ist nicht erforderlich. Beenden mit `Strg+C`.
Die Seite benötigt HTTP und WebGL. Three.js 0.180.0 und seine Erweiterungen
werden über die Importmap von jsDelivr geladen; dafür ist Internet erforderlich.
Es gibt keinen Buildschritt und keinen Service Worker für Offlinebetrieb.

## Tests

Einmalig den Testbrowser installieren:

```powershell
npx playwright install chromium
```

```powershell
npm test
```

Der Gesamtlauf prüft JavaScript-Syntax, lokale HTML-/Manifest-Ressourcen,
die Übereinstimmung der Three.js-Versionen, Unit-Tests und Browser-Tests.
Einzeln ausführbar mit `npm run check`, `npm run test:unit` und
`npm run test:browser`. Der Browserlauf startet seinen eigenen Server auf
Port 4173; einen laufenden `npm start` vorher beenden.

- Unit-Tests: Modulverträge, Unicode-Normalisierung, Wortgrenzen, Graphkanten,
  Simulation, Fixierung, Reset, Kamerarahmung und Ressourcenfreigabe.
- Chromium-Tests: Desktop (1440×900), Tablet (820×1180), Mobil (390×844),
  Initialisierung mit Erfassung von Browserfehlern, Tastatur-/Maus-/Touchbedienung,
  Rotation, Reset, Texteingaben, leere Netze, Eingabegrenzen, Templates und Layout.
- Three.js wird im Browsertest lokal aus `node_modules/three` bereitgestellt;
  die Erreichbarkeit des produktiven CDN wird damit nicht geprüft.
- Screenshots und Fehler-Traces liegen unter `test-results/` (nicht versioniert).

Die Tests sind eine reproduzierbare Regressionsbasis, kein Nachweis sämtlicher
Geräte-/Browserkombinationen. Firefox, Safari und reale Touchgeräte sind nicht
Teil dieses automatisierten Laufs.

## Struktur

- [index.html](index.html): Oberfläche, Texte, Importmap und Wort-Template
- [word-network/](word-network/): Konfiguration, Graph, Simulation, Modell und Interaktion
- [share/](share/): Viewport-, Kamera-, Template- und Ressourcenmodule
- [styles/word-network.css](styles/word-network.css): responsive Darstellung
- [manifest.webmanifest](manifest.webmanifest), [assets/wortgeflecht-favicon.svg](assets/wortgeflecht-favicon.svg): App-Metadaten und Favicon
- [tests/](tests/): Unit- und Browser-Tests
- [playwright.config.js](playwright.config.js): Browserprofile und Testserver
- [scripts/check.js](scripts/check.js): Syntax-, Ressourcen- und Versionsprüfung

Es werden keine Module aus einem übergeordneten Projekt importiert.
Bei einem Three.js-Update müssen `package.json`, Lockdatei, Importmap und
CDN-Abfangroute in den Browsertests gemeinsam aktualisiert werden.

## Open-Graph-Bild und Favicon

Die Social-Grafik wird wie bei Threadline aus einer versionierten SVG-Quelle
gebaut:

```powershell
npm run build:og-image
```

Die Quelle liegt unter [assets/wortgeflecht-og.svg](assets/wortgeflecht-og.svg),
die Konfiguration unter [config/og-image.config.json](config/og-image.config.json).
Resvg erzeugt das 1200×630-PNG, Sharp daraus das JPEG für Open Graph. Das neue
Wortnetz-Favicon liegt unter
[assets/wortgeflecht-favicon.svg](assets/wortgeflecht-favicon.svg).
## Offline/PWA

Wortgeflecht kann nach dem ersten erfolgreichen Online-Aufruf offline genutzt
werden. Three.js, OrbitControls und CSS2DRenderer werden lokal ausgeliefert;
der Service Worker cached die App-Shell und die benötigten Dateien.

Die Installation als PWA muss über HTTPS erfolgen. `localhost` und
`127.0.0.1` gelten beim lokalen Entwickeln ebenfalls als sichere Kontexte.
Nach Änderungen an der App-Shell wird die Cache-Version in [sw.js](sw.js)
erhöht. Der Offline-Test läuft mit:

```powershell
npx playwright test tests/pwa.spec.js
```
Der Service Worker aktualisiert sich wie bei Threadline selbst: Beim Start wird
`registration.update()` aufgerufen. Eine neue Version überspringt die Warteschlange
mit `skipWaiting`, übernimmt die Kontrolle und löst über `controllerchange` einen
Reload aus. Nach Änderungen an der App-Shell muss `CACHE_NAME` in [sw.js](sw.js)
erhöht werden.