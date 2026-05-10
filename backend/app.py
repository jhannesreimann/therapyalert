import os
import re
import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional, Generator

import requests
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
import warnings
from flask import Flask, jsonify, request, Response, stream_with_context
from flask_cors import CORS

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

KVBB_BASE = "https://arztsuche.kvbb.de/ases-kvbb/ases.jsf"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
}

AJAX_HEADERS = {
    **HEADERS,
    "Accept": "application/xml, text/xml, */*; q=0.01",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "Faces-Request": "partial/ajax",
    "X-Requested-With": "XMLHttpRequest",
}

EXPAND_COMPONENT = "j_idt582"
MAX_WORKERS = 10


def parse_int(text: str) -> Optional[int]:
    t = text.strip()
    if not t:
        return None
    try:
        return int(t)
    except ValueError:
        return None


def extract_entry_meta(entry) -> dict:
    """Extract name, address, phone, distance from a list entry (pre-expansion)."""
    name_el = entry.select_one("[data-test='arzt-name']")
    name = name_el.get_text(strip=True) if name_el else ""

    address_parts = []
    for span in entry.select(".ases-leistungsort-tab-text-content[title]"):
        title = span.get("title", "").strip()
        if title:
            lines = [l.strip() for l in title.splitlines() if l.strip()]
            addr_lines = [l for l in lines if not re.match(r"^\(\d{3,}", l)]
            address_parts.append(", ".join(addr_lines[:2]) if addr_lines else title)
    address = address_parts[0] if address_parts else ""

    dist_el = entry.select_one(".ases-leistungsort-tab-dist")
    if dist_el:
        dist_text = dist_el.get_text(" ", strip=True)
        m = re.search(r"([\d.,]+\s*km)", dist_text)
        distance = m.group(1) if m else dist_text
    else:
        distance = ""

    phone = ""
    tel_strings = entry.find_all(string=re.compile(r"\(\d{3,6}\)\s*[\d\s]+"))
    if tel_strings:
        phone = tel_strings[0].strip()

    expand_link = entry.select_one(f"[id*=detailsExpandEintrag] a[id]")
    entry_index = None
    if expand_link:
        m = re.search(r"arztlisteDataList:(\d+):", expand_link.get("id", ""))
        if m:
            entry_index = int(m.group(1))

    return {
        "name": name,
        "address": address,
        "distance": distance,
        "phone": phone,
        "entry_index": entry_index,
    }


def parse_ft_table(ft_soup) -> list[dict]:
    """Parse the Freie Therapieplätze table from a BeautifulSoup fragment."""
    ft_table = ft_soup.select_one(".ases-leistungsort-ft-table")
    if not ft_table:
        return []

    available_slots = []
    rows = ft_table.select("tbody tr")
    current_therapy = ""

    for row in rows:
        therapy_block = row.select_one("td:first-child div[style]")
        if therapy_block:
            style = therapy_block.get("style", "")
            if "display: block" in style or "display:block" in style:
                enabled = therapy_block.select_one(".ases-enabled")
                if enabled:
                    current_therapy = enabled.get_text(strip=True)

        subtype_div = row.select_one("td:nth-child(2) .ases-enabled")
        if not subtype_div:
            continue

        subtype = subtype_div.get_text(strip=True)
        if "Einzel" not in subtype or "Erw" not in subtype:
            continue

        sitz_cells = row.select(".ases-leistungsort-ft-sitz")
        slot_values = [parse_int(c.get_text(strip=True)) for c in sitz_cells]

        if not any(v is not None and v > 0 for v in slot_values):
            continue

        total = sum(v for v in slot_values if v is not None)
        available_slots.append({
            "therapy": current_therapy,
            "subtype": subtype,
            "vormittags": slot_values[0] if len(slot_values) > 0 else None,
            "nachmittags": slot_values[1] if len(slot_values) > 1 else None,
            "abends": slot_values[2] if len(slot_values) > 2 else None,
            "total": total,
        })

    return available_slots


def extract_detail_info(detail_soup) -> dict:
    """Extract fachgebiet, website, phone hours from expanded detail panel."""
    fachgebiet_el = detail_soup.select_one("[data-test='leistungsort-fachgebiet']")
    fachgebiet = fachgebiet_el.get_text(strip=True) if fachgebiet_el else ""

    website = ""
    for link in detail_soup.find_all("a", href=True):
        href = link["href"]
        if href.startswith("http") and "kvbb.de" not in href and "ases" not in href:
            website = href
            break

    phone_hours = []
    for row in detail_soup.select(".ases-te-data-table tbody tr"):
        day_el = row.select_one(".ases-lo-te-day-entry-day")
        times = [td.get_text(strip=True) for td in row.select(".ases-te-data-table-te-time") if td.get_text(strip=True)]
        if day_el and times:
            phone_hours.append(f"{day_el.get_text(strip=True)}: {', '.join(times)}")

    return {"fachgebiet": fachgebiet, "website": website, "phone_hours": phone_hours}


def _make_session_with_viewstate(params: dict) -> tuple:
    """
    Open a fresh session, load the KVBB search page, and return
    (session, view_state, referer_url, soup).
    Each worker thread calls this to get its own isolated session.
    """
    session = requests.Session()
    resp = session.get(KVBB_BASE, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    vs_el = soup.select_one("[name='javax.faces.ViewState']")
    view_state = vs_el.get("value", "") if vs_el else ""
    return session, view_state, resp.url


def fetch_entry_details(session, view_state, entry_index, referer_url) -> Optional[BeautifulSoup]:
    """Fire the JSF AJAX expand call for a single entry. Returns parsed soup or None."""
    prefix = f"arztlisteDataList:{entry_index}"
    source = f"{prefix}:{EXPAND_COMPONENT}"
    render_targets = (
        f"{prefix}:detailsPanel "
        f"{prefix}:detailsTabView "
        f"{prefix}:detailsExpandEintrag "
        f"{prefix}:detailsCollapseEintrag"
    )
    data = {
        "javax.faces.partial.ajax": "true",
        "javax.faces.source": source,
        "javax.faces.partial.execute": source,
        "javax.faces.partial.render": render_targets,
        source: source,
        "javax.faces.ViewState": view_state,
    }
    headers = {**AJAX_HEADERS, "Referer": referer_url}
    try:
        resp = session.post(KVBB_BASE, data=data, headers=headers, timeout=10)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        logger.warning(f"AJAX fetch failed for entry {entry_index}: {e}")
        return None


def scrape_kvbb(
    location: str,
    range_km: float,
    lat: float,
    lng: float,
    size: int = 500,
    blacklist: list[str] | None = None,
) -> list[dict]:
    """
    1. Fetch the KVBB search page once to extract all entry metadata and indices.
    2. Split entries into N batches, each processed by a worker thread with its own
       independent HTTP session (avoids JSF server-side session race conditions).
    3. Each worker sequentially AJAX-expands its assigned entries.
    4. Aggregate results: Einzel Erw. slots > 0, excluding blacklisted names.
    """
    if blacklist is None:
        blacklist = []
    blacklist_lower = [b.lower().strip() for b in blacklist]

    params = {
        "t": "pt",
        "sort-by": "auto",
        "size": size,
        "from": 0,
        "w": location,
        "range": f"{range_km:.1f}km",
        "lng": lng,
        "lat": lat,
    }

    logger.info(f"Fetching KVBB: location={location}, range={range_km}km")
    init_session = requests.Session()
    resp = init_session.get(KVBB_BASE, params=params, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    referer_url = resp.url
    soup = BeautifulSoup(resp.text, "lxml")

    entries = soup.select(".ases-arzt-eintrag")
    logger.info(f"Found {len(entries)} therapist entries")

    entry_metas = []
    for entry in entries:
        meta = extract_entry_meta(entry)
        if meta["entry_index"] is None:
            continue
        name_lower = meta["name"].lower()
        if any(b in name_lower for b in blacklist_lower):
            logger.info(f"Skipping blacklisted: {meta['name']}")
            continue
        entry_metas.append(meta)

    logger.info(f"Processing {len(entry_metas)} entries across {MAX_WORKERS} workers...")

    def process_batch(batch):
        """Each worker gets its own fresh session+ViewState and sequentially expands its batch."""
        try:
            worker_session, view_state, worker_referer = _make_session_with_viewstate(params)
        except Exception as e:
            logger.error(f"Worker failed to init session: {e}")
            return []

        batch_results = []
        for meta in batch:
            detail_soup = fetch_entry_details(
                worker_session, view_state, meta["entry_index"], worker_referer
            )
            if detail_soup is None:
                continue
            available_slots = parse_ft_table(detail_soup)
            if not available_slots:
                continue
            extra = extract_detail_info(detail_soup)
            batch_results.append({
                "name": meta["name"],
                "fachgebiet": extra["fachgebiet"],
                "address": meta["address"],
                "distance": meta["distance"],
                "phone": meta["phone"],
                "phone_hours": extra["phone_hours"],
                "website": extra["website"],
                "available_slots": available_slots,
                "source": "KVBB",
                "source_url": referer_url,
                "timestamp": datetime.now().isoformat(),
            })
        return batch_results

    batch_size = max(1, (len(entry_metas) + MAX_WORKERS - 1) // MAX_WORKERS)
    batches = [entry_metas[i:i + batch_size] for i in range(0, len(entry_metas), batch_size)]

    results = []
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(process_batch, batch) for batch in batches]
        for future in as_completed(futures):
            results.extend(future.result())

    results.sort(key=lambda r: r["name"])
    logger.info(f"Found {len(results)} therapists with available Einzel Erw. slots")
    return results


@app.route("/api/kvbb", methods=["GET"])
def kvbb_search():
    location = request.args.get("location", "Potsdam")
    range_km = float(request.args.get("range", "20.0"))
    lat = float(request.args.get("lat", "52.4009309"))
    lng = float(request.args.get("lng", "13.0591397"))
    size = int(request.args.get("size", "500"))
    blacklist_raw = request.args.get("blacklist", "")
    blacklist = [b.strip() for b in blacklist_raw.split(",") if b.strip()] if blacklist_raw else []

    try:
        results = scrape_kvbb(location, range_km, lat, lng, size, blacklist)
        return jsonify({
            "success": True,
            "count": len(results),
            "alerts": results,
            "timestamp": datetime.now().isoformat(),
            "query": {
                "location": location,
                "range_km": range_km,
                "lat": lat,
                "lng": lng,
                "blacklist": blacklist,
            },
        })
    except requests.RequestException as e:
        logger.error(f"Request error: {e}")
        return jsonify({"success": False, "error": str(e), "alerts": []}), 502
    except Exception as e:
        logger.error(f"Scraping error: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e), "alerts": []}), 500


ETERMIN_HOME = "https://www.eterminservice.de/terminservice"
ETERMIN_BASE = "https://www.eterminservice.de/terminservice/suche"
ETERMIN_DEFAULT_CODES = "W981"


def _etermin_build_url(code: str, plz: str) -> str:
    """Build the search URL from a Vermittlungscode + PLZ.
    - Full URL passthrough (starts with http)
    - Short code XXXX-XXXX-XXXX -> append PLZ + W981 (Psychotherapeutische Sprechstunde)
    - Full path CODE/PLZ/CODES -> prepend base
    User can always paste the full browser URL to get exact EBM codes.
    """
    code = code.strip()
    if code.startswith("http"):
        return code
    parts = code.split("/")
    if len(parts) >= 3:
        return f"{ETERMIN_BASE}/{code}"
    clean_code = parts[0].upper()
    plz = (plz or "").strip() or "14471"
    return f"{ETERMIN_BASE}/{clean_code}/{plz}/{ETERMIN_DEFAULT_CODES}"


def parse_etermin_results(html: str) -> list[dict]:
    """Parse the Angular-rendered search results HTML from eterminservice.de."""
    soup = BeautifulSoup(html, "lxml")
    appointments = []

    current_date = ""
    for el in soup.find_all(True, recursive=True):
        if "ets-search-results-header" in (el.get("class") or []):
            current_date = el.get_text(strip=True)
            continue

        if "ets-search-results-item" not in (el.get("class") or []):
            continue

        item = el
        name_el = item.select_one(".search-results-item-content strong")
        if not name_el:
            continue
        raw_name = name_el.get_text(strip=True)
        m = re.match(r"PT.?Sprechstunde[^:]*:\s*(?:\.\.\.\s*)?(.+?)(?:\s+\(\d{5,}\).*)?$", raw_name)
        name = m.group(1).strip() if m else raw_name

        addr_el = item.select_one("address")
        practice = ""
        street = ""
        city_plz = ""
        city = ""
        if addr_el:
            spans = [s.get_text(strip=True) for s in addr_el.find_all("span") if s.get_text(strip=True)]
            if len(spans) >= 1:
                practice = spans[0]
            if len(spans) >= 2:
                street = spans[1]
            if len(spans) >= 3:
                city_plz = spans[2]
            if len(spans) >= 4:
                city = spans[3]

        dist_el = item.select_one("address + div p strong, address ~ div p strong")
        distance = dist_el.get_text(strip=True) if dist_el else ""

        slots = [s.get_text(strip=True) for s in item.select(".ets-slot-button") if s.get_text(strip=True)]

        address = ", ".join(filter(None, [street, f"{city_plz} {city}".strip()]))

        appointments.append({
            "date": current_date,
            "name": name,
            "practice": practice,
            "address": address,
            "distance": distance,
            "slots": slots,
            "source": "eTerminservice",
        })

    return appointments


def scrape_etermin_stream(code: str, plz: str, distance_km: int = 20) -> Generator:
    """Generator that yields SSE progress events and finally the result.

    Playwright navigates the eterminservice homepage like a real user:
    1. Opens /terminservice, clicks 'Ja' for Vermittlungscode
    2. Fills the 3-part code inputs + PLZ
    3. Submits -> site redirects to real results URL with correct EBM codes
    4. Sets distance filter
    5. Parses results
    """
    def _evt(step: str, pct: int, detail: str = "") -> str:
        return f"data: {json.dumps({'step': step, 'pct': pct, 'detail': detail})}\n\n"

    if not PLAYWRIGHT_AVAILABLE:
        yield _evt("error", 0, "Playwright nicht installiert.")
        return

    result_url = ETERMIN_HOME
    yield _evt("start", 5, "Browser wird gestartet…")

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ],
            )
            context = browser.new_context(
                locale="de-DE",
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                viewport={"width": 1280, "height": 800},
                extra_http_headers={"Accept-Language": "de-DE,de;q=0.9"},
            )
            page = context.new_page()
            page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

            yield _evt('navigate', 15, 'Startseite wird geladen…')
            page.goto(ETERMIN_HOME, timeout=120000, wait_until='domcontentloaded')
            page.wait_for_timeout(3000)

            yield _evt("enter_code", 30, "Vermittlungscode wird eingegeben…")
            page.locator(".ets-radio-control").filter(has_text="Ja").click()
            page.wait_for_timeout(400)

            parts = code.strip().upper().split("-")
            for i, part in enumerate(parts[:3]):
                inp = page.locator(f"input[data-index='{i}']")
                inp.wait_for(state="visible", timeout=5000)
                inp.fill(part)
                page.wait_for_timeout(100)

            yield _evt("enter_plz", 42, "PLZ wird eingegeben…")
            plz_inp = page.locator("input[formcontrolname='zip']").first
            plz_inp.wait_for(state="visible", timeout=5000)
            plz_inp.fill((plz or '14471').strip())
            page.wait_for_timeout(100)

            yield _evt("submit", 55, "Suche wird gestartet…")
            submit = page.locator("button[type='submit']").first
            submit.wait_for(state="visible", timeout=5000)
            page.evaluate("document.querySelector('button[type=submit]').removeAttribute('disabled')")
            submit.click()

            yield _evt('wait', 68, 'Warte auf Suchergebnisse…')
            page.wait_for_load_state('domcontentloaded', timeout=60000)
            try:
                page.wait_for_selector('ets-search-results, .ets-search-results-item, .ets-no-results', timeout=20000)
            except Exception:
                pass
            page.wait_for_timeout(800)
            result_url = page.url
            logger.info(f"eTerminservice navigated to: {result_url}")

            if distance_km != 5:
                yield _evt("filter", 78, f"Umkreis auf {distance_km} km setzen…")
                try:
                    filter_btn = page.locator(".ets-search-filter-distance").first
                    filter_btn.wait_for(state="visible", timeout=8000)
                    filter_btn.click()
                    page.wait_for_timeout(400)
                    label = page.locator('label').filter(has_text=str(distance_km)).first
                    label.wait_for(state='visible', timeout=5000)
                    label.click()
                    page.wait_for_load_state('domcontentloaded', timeout=15000)
                    page.wait_for_timeout(800)
                    logger.info(f"Distance filter set to {distance_km} km")
                except Exception as dist_err:
                    logger.warning(f"Distance selection failed (using site default): {dist_err}")

            yield _evt("parse", 90, "Ergebnisse werden ausgelesen…")
            html = page.content()
            browser.close()

        appointments = parse_etermin_results(html)
        yield _evt("done", 100, f"{len(appointments)} Termine gefunden")
        yield f"data: {json.dumps({'done': True, 'success': True, 'count': len(appointments), 'appointments': appointments, 'url': result_url, 'timestamp': datetime.now().isoformat()})}\n\n"

    except Exception as e:
        logger.error(f"eTerminservice scrape failed: {e}", exc_info=True)
        yield _evt("error", 0, str(e))
        yield f"data: {json.dumps({'done': True, 'success': False, 'error': str(e), 'appointments': [], 'url': result_url})}\n\n"


def scrape_etermin(code: str, plz: str, distance_km: int = 20) -> dict:
    """Synchronous wrapper around the streaming scraper (used for direct JSON endpoint)."""
    result = {"success": False, "appointments": [], "url": ETERMIN_HOME}
    for chunk in scrape_etermin_stream(code, plz, distance_km):
        raw = chunk.replace("data: ", "").strip()
        if not raw:
            continue
        try:
            obj = json.loads(raw)
            if obj.get("done"):
                result = obj
        except Exception:
            pass
    return result


@app.route("/api/etermin", methods=["GET"])
def etermin_check():
    code = request.args.get("code", "").strip()
    plz = request.args.get("plz", "").strip()
    distance_km = int(request.args.get("distance", "20"))

    if not code:
        return jsonify({"success": False, "error": "Kein Vermittlungscode angegeben.", "appointments": []})

    result = scrape_etermin(code, plz, distance_km)
    status = 200 if result["success"] else 502
    return jsonify(result), status


@app.route("/api/etermin/stream", methods=["GET"])
def etermin_stream():
    code = request.args.get("code", "").strip()
    plz = request.args.get("plz", "").strip()
    distance_km = int(request.args.get("distance", "20"))

    if not code:
        def _err():
            yield f"data: {json.dumps({'done': True, 'success': False, 'error': 'Kein Code angegeben.', 'appointments': []})}\n\n"
        return Response(stream_with_context(_err()), mimetype="text/event-stream",
                        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    return Response(
        stream_with_context(scrape_etermin_stream(code, plz, distance_km)),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )



@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "timestamp": datetime.now().isoformat()})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=True)
