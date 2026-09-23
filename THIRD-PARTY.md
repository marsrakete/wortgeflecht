# Third-Party-Komponenten

## Three.js 0.180.0

Wortgeflecht liefert Three.js lokal unter [vendor/three/](vendor/three/) aus. Dadurch funktionieren die App und der Service Worker auch ohne CDN-Zugriff nach dem ersten Laden.

- Projekt: [three.js](https://github.com/mrdoob/three.js)
- Version: `0.180.0`
- Lizenz: MIT
- Paketquelle und Versionsbindung: [package.json](package.json) und [package-lock.json](package-lock.json)
- Verwendete Bestandteile: `build/three.module.js`, `build/three.core.js`, `examples/jsm/controls/OrbitControls.js` und `examples/jsm/renderers/CSS2DRenderer.js`

Copyright © 2010–2025 three.js authors.

### MIT-Lizenz

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Weitere npm-Abhängigkeiten

Die Build-, Bild- und Testwerkzeuge sind in [package.json](package.json) aufgeführt. Ihre jeweiligen Lizenztexte und Abhängigkeiten werden durch npm in `node_modules/` installiert und nicht als Laufzeitbestandteile der PWA ausgeliefert.
