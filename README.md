# Wortgeflecht

Wortgeflecht verbindet drei Texte zu einem interaktiven 3D-Wortnetz. Die drei Perspektiven liegen auf den Ebenen XY, YZ und XZ; identische Wörter verbinden die Ebenen. Wörter lassen sich mit Maus, Touch oder Pfeiltasten verschieben und fixieren. `Reset` setzt Netz und Kamera zurück und behält die Eingaben.

## Eingaben, Wortwolken und Projekte

Die zuletzt verwendeten drei Eingabefelder werden automatisch in IndexedDB gespeichert und beim nächsten Start geladen. Über das `…`-Menü eines Feldes lassen sich einzelne Wortwolken speichern, als neue Wortwolke speichern, laden, umbenennen und löschen. Die Wortwolken sind universell: Eine gespeicherte Wortwolke kann in jedes der drei Felder geladen werden.

`Projekt speichern` speichert das aktuell verwendete Tripel als eigenständiges Projekt mit Name, ID, Erstellungsdatum und Änderungsdatum. Das Projekt enthält die drei Wortwolken vollständig und bleibt dadurch auch ohne die ursprünglichen lokalen Wortwolken verwendbar. `Projekt laden` stellt alle drei Felder wieder her. Speicher- und Löschvorgänge werden in der Oberfläche bestätigt; die App verwendet keine System-Bestätigungsdialoge.

## Teilen

Eine Teilen-Funktion kann ein Projekt als komprimierte URL übertragen. Dafür werden die drei Texte und die nötigen Projektmetadaten serialisiert; beim Öffnen der URL wird daraus ein neues lokales Projekt erzeugt. Für sehr große Projekte ist zusätzlich ein Datei-Export sinnvoll, weil URL-Limits von Browsern, Servern und Messengern unterschiedlich sind. Die konkrete URL-Kompression und die daraus abgeleitete Wortgrenze werden bei der Implementierung geprüft und angezeigt.

## Open-Graph-Bild und Favicon

Die Social-Grafik wird aus einer versionierten SVG-Quelle gebaut:

```powershell
npm run build:og-image
```

Die Quelle liegt unter [assets/wortgeflecht-og.svg](assets/wortgeflecht-og.svg), die Konfiguration unter [config/og-image.config.json](config/og-image.config.json). Resvg erzeugt das 1200×630-PNG; Sharp erzeugt daraus das JPEG für Open Graph. Das aktuelle Favicon ist [assets/wortgeflecht-favicon.svg](assets/wortgeflecht-favicon.svg). Die früheren Icon-Verweise sind entfernt; HTML und Manifest referenzieren ausschließlich die aktuellen Wortgeflecht-Assets.

## Offline/PWA

Wortgeflecht kann nach dem ersten erfolgreichen Online-Aufruf offline genutzt und als PWA installiert werden. Three.js, OrbitControls, CSS2DRenderer, Styles, Module und Icons werden lokal ausgeliefert; der Service Worker cached die App-Shell und die benötigten Dateien.

Die Installation als PWA muss über HTTPS erfolgen. `localhost` und `127.0.0.1` gelten beim lokalen Entwickeln ebenfalls als sichere Kontexte. Die Cache-Version steht in [version.js](version.js) und wird vom [sw.js](sw.js) verwendet. Der Service Worker aktualisiert sich selbst: Beim Start wird `registration.update()` aufgerufen. Eine neue Version überspringt die Warteschlange mit `skipWaiting`, übernimmt die Kontrolle und löst über `controllerchange` einen Reload aus.

Der Offline-Test läuft mit:

```powershell
npx playwright test tests/pwa.spec.js
```

## Tests

Einmalig den Testbrowser installieren:

```powershell
npx playwright install chromium
```

```powershell
npm test
```

Der Gesamtlauf prüft JavaScript-Syntax, lokale HTML-/Manifest-Ressourcen, die Übereinstimmung der Three.js-Versionen, Unit-Tests und Browser-Tests. Einzelne Prüfungen:

```powershell
npm run check
npm run test:unit
npm run test:browser
```

Der Browserlauf startet seinen eigenen Server auf Port 4173; einen laufenden Server auf diesem Port vorher beenden. Die Playwright-Profile decken Desktop (1440×900), Tablet (820×1180) und Mobil (390×844) ab. Geprüft werden Initialisierung mit Browserfehlern, Tastatur-, Maus- und Touchbedienung, Rotation, Reset, Texteingaben, leere Netze, Eingabegrenzen, Templates und Layout. Screenshots und Fehler-Traces liegen unter `test-results/` und sind nicht versioniert.

Die Tests bilden eine reproduzierbare Regressionsbasis, ersetzen aber keine Prüfung sämtlicher Geräte- und Browserkombinationen. Firefox, Safari und reale Touchgeräte sind nicht Teil dieses automatisierten Laufs.

## Struktur

- [index.html](index.html): Oberfläche, Importmap, Dialoge und Wort-Template
- [word-network/](word-network/): Konfiguration, Graph, Simulation, Modell und Interaktion
- [share/](share/): Viewport-, Kamera-, Template-, Ressourcen- und IndexedDB-Module
- [styles/word-network.css](styles/word-network.css): responsive Darstellung, Menüs und Dialoge
- [manifest.webmanifest](manifest.webmanifest): PWA-Metadaten
- [assets/](assets/): Favicon, App-Icons und Open-Graph-Bilder
- [vendor/three/](vendor/three/): lokal ausgelieferte Three.js-Dateien
- [THIRD-PARTY.md](THIRD-PARTY.md): Lizenz- und Herkunftshinweise für vendorte Komponenten
- [tests/](tests/): Unit- und Browser-Tests
- [playwright.config.js](playwright.config.js): Browserprofile und Testserver
- [scripts/check.js](scripts/check.js): Syntax-, Ressourcen- und Versionsprüfung
- [version.js](version.js), [sw.js](sw.js): App-Version und Service Worker

Es werden keine Module aus einem übergeordneten Projekt importiert. Bei einem Three.js-Update müssen `package.json`, Lockdatei, Importmap, lokale Vendor-Dateien und die Browsertests gemeinsam aktualisiert werden.

## Entwicklung lokal starten

Dieser Abschnitt ist ausschließlich für die lokale Entwicklung und Tests gedacht. Für den produktiven Betrieb sollte die App über eine geeignete HTTPS-Auslieferung bereitgestellt werden. Voraussetzung ist Node.js ab Version 22 mit npm. Im Projektordner ausführen:

```powershell
npm ci
npm start
```

Anschließend [http://127.0.0.1:4173/](http://127.0.0.1:4173/) öffnen. Der Server liefert den Projektordner direkt aus; ein zusätzlicher Pfad wie `/Wortgeflecht/` ist nicht erforderlich. Beenden mit `Strg+C`.

Für einen einfachen PowerShell-Server ohne npm steht [start-server.ps1](start-server.ps1) zur Verfügung:

```powershell
.\start-server.ps1
```

Die App benötigt HTTP und WebGL. Three.js 0.180.0 und die benötigten Erweiterungen werden lokal aus [vendor/three/](vendor/three/) geladen. Nach der ersten erfolgreichen Online-Initialisierung kann die App als PWA offline weiterverwendet werden.
