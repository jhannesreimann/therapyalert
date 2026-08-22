# TherapyAlert

TherapyAlert sucht nach freien Psychotherapieplätzen für Erwachsene und stellt die Treffer übersichtlich dar. Statt sich täglich durch die Arztsuche zu klicken, genügt ein Suchlauf: Die App fragt die Arztsuche der Kassenärztlichen Vereinigung Berlin-Brandenburg (KVBB) ab und zusätzlich den Terminservice der 116117.

Live läuft die App hier: [therapyalert.netlify.app](https://therapyalert.netlify.app/)

## Funktionen

- **KVBB-Arztsuche:** Findet Praxen im Umkreis mit freien Einzeltherapieplätzen für Erwachsene. Ort oder PLZ eingeben, Umkreis wählen, los. Bekannte Praxen lassen sich per Blacklist ausschließen.
- **116117 eTerminservice:** Mit einem Vermittlungscode werden PT-Sprechstundentermine gesucht und als Wochenkalender mit buchbaren Zeitslots angezeigt. Der Fortschritt läuft live über Server-Sent Events ins Frontend.
- **Auto-Refresh:** Optional aktualisiert die App die Ergebnisse alle 10 Minuten von selbst.
- **Dark Mode** und Einstellungen, die im Browser gespeichert bleiben.

Der Zugriff ist über einen einfachen Zugangscode geschützt, das Tool ist privat gedacht.

## Technik

| Teil     | Stack                                                            |
|----------|------------------------------------------------------------------|
| Frontend | React 19, Vite, Tailwind CSS 4, lucide-react                     |
| Backend  | Python, Flask, BeautifulSoup/lxml, Playwright (headless Chromium) |

Das Backend kümmert sich um das Scraping, das Frontend ist reine Darstellung. Für die Ortssuche nutzt das Frontend Nominatim (OpenStreetMap).

Deployed ist das Frontend bei Netlify, die nötige Konfiguration liegt in `netlify.toml` im Repo.

## Lokale Entwicklung

### Backend

```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python3 app.py
# Läuft auf http://localhost:5050
```

Für den eTerminservice-Teil wird Chromium über Playwright benötigt. Der KVBB-Teil funktioniert auch ohne.

### Frontend

```bash
cd frontend
npm install
npm run dev
# Läuft auf http://localhost:3000
```

Der Vite-Dev-Server leitet `/api`-Anfragen an `http://localhost:5050` weiter, sodass Backend und Frontend zusammen laufen. Ein Produktionsbuild entsteht mit `npm run build`.

Versionen werden über den Release-Workflow im Actions-Tab erzeugt.

## API

Alle Endpunkte sind GET-Anfragen am Backend.

### `GET /api/kvbb`

| Parameter   | Default      | Beschreibung                          |
|-------------|--------------|---------------------------------------|
| `location`  | `Potsdam`    | Ort oder PLZ                          |
| `range`     | `20.0`       | Umkreis in km                         |
| `lat`       | `52.4009309` | Breitengrad                           |
| `lng`       | `13.0591397` | Längengrad                            |
| `size`      | `500`        | Max. Anzahl Einträge                  |
| `blacklist` | *(leer)*     | Kommagetrennte Namen zum Ausschließen |

### `GET /api/etermin/stream`

Sucht eTerminservice-Termine und streamt Fortschritt sowie Ergebnis als Server-Sent Events. Parameter: `code` (Vermittlungscode), `plz`, `distance`. Es gibt auch eine einfache Variante ohne Streaming unter `/api/etermin`.

### `GET /api/health`

Antwortet mit Status und Zeitstempel, eignet sich zum Prüfen ob das Backend lebt.

## Wie das Scraping funktioniert

Die KVBB-Arztsuche baut auf JavaServer Faces (JSF) mit PrimeFaces. Die Liste der Praxen kommt zwar mit der initialen HTML-Seite, die Tabellen mit den freien Therapieplätzen aber erst per AJAX, wenn man einen Eintrag aufklappt. Das Backend holt die Seite einmal, extrahiert alle Praxisnamen und Entry-Indizes und verschickt dann in Batches à 10 Worker parallele AJAX-Expand-Requests mit eigener Session pro Worker. Aus den Antworten parst es die FT-Tabellen und behält nur Zeilen mit „Einzel Erw." größer 0.

Beim eTerminservice übernimmt Playwright den Teil eines echten Nutzers: Vermittlungscode eingeben, PLZ dazu, abschicken, Umkreis setzen. Danach werden die Suchergebnisse geparst und als Termine mit Zeitslots zurückgegeben.

## Lizenz

[MIT](LICENSE)
