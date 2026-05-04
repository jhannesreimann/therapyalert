# TherapyAlert

Benachrichtigt dich automatisch wenn ein Psychotherapeut freie Einzeltherapieplätze für Erwachsene meldet.

## Quellen

- **KVBB Arztsuche** – Scraping via JSF-AJAX (funktioniert zuverlässig, ~15-20s pro Scan)
- **eTerminservice.de (116117)** – Playwright (headless Chromium) umgeht Akamai-Bot-Schutz; zeigt verfügbare PT-Sprechstundentermine mit Zeitslots, SSE-Ladebalken im Frontend

## Starten (lokal)

### Backend (Python Flask)

```bash
cd backend
pip install -r requirements.txt
playwright install chromium
python3 app.py
# Läuft auf http://localhost:5050
```

### Frontend (React + Vite + TailwindCSS)

```bash
cd frontend
npm install
npm run dev
# Läuft auf http://localhost:3000
```

## Deployment

### Backend → Railway.app

1. Erstelle einen Account auf [railway.app](https://railway.app) (GitHub-Login)
2. **New Project → Deploy from GitHub repo** → dieses Repo auswählen
3. Bei der Service-Konfiguration: **Root Directory** auf `backend` setzen
4. Railway erkennt das `Dockerfile` automatisch und baut es
5. Nach dem Deploy: Die generierte URL kopieren (z.B. `https://therapyalert-backend.up.railway.app`)

### Frontend → Netlify

1. Erstelle einen Account auf [netlify.app](https://netlify.com) (GitHub-Login)
2. **Add new site → Import an existing project → GitHub** → dieses Repo auswählen
3. Build-Einstellungen werden automatisch aus `netlify.toml` erkannt:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`
4. Unter **Site configuration → Environment variables** hinzufügen:
   - Key: `VITE_API_BASE`
   - Value: die Railway-URL von oben (z.B. `https://therapyalert-backend.up.railway.app`)
5. **Deploy site** klicken — fertig

## API Endpunkte

### `GET /api/kvbb`
| Parameter  | Default        | Beschreibung                              |
|------------|----------------|-------------------------------------------|
| `location` | `Potsdam`      | Ort oder PLZ                              |
| `range`    | `20.0`         | Umkreis in km                             |
| `lat`      | `52.4009309`   | Breitengrad                               |
| `lng`      | `13.0591397`   | Längengrad                                |
| `size`     | `500`          | Max. Einträge                             |
| `blacklist`| *(leer)*       | Kommagetrennte Namen zum Ausschließen     |

### `GET /api/etermin`
| Parameter | Default  | Beschreibung         |
|-----------|----------|----------------------|
| `code`    | *(leer)* | Vermittlungscode     |
| `plz`     | `14471`  | Postleitzahl         |

### `GET /api/health`
Gibt `{"status": "ok"}` zurück.

## Wie es funktioniert

Die KVBB-Seite verwendet JavaServer Faces (JSF) mit PrimeFaces. Die Listeneinträge der Praxen werden in der initialen HTML-Seite ohne FT-Tabellen (Freie Therapieplätze) geladen – die Daten kommen erst via JSF-AJAX-Request wenn ein Eintrag aufgeklappt wird.

Das Backend:
1. Lädt die Suchseite und extrahiert alle Praxisnamen und Entry-Indices
2. Teilt die Einträge in Batches auf (10 parallele Worker)
3. Jeder Worker öffnet eine eigene Session und sendet AJAX-Expand-Requests für seinen Batch
4. Parsed die FT-Tabellen und filtert nach `Einzel Erw.` mit Wert > 0
