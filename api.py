"""
Trajector REST API
Fetches live TLE data from Space-Track.org and runs the conjunction assessment pipeline.
Start with: python api.py  (or ./start_api.sh)
"""

import sys, os, time
from datetime import datetime, timezone, timedelta
from functools import wraps
import numpy as np
import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.physics.converter import propagate_orbit
from src.physics.conjunction import ConjunctionAssessment
from src.physics.maneuver import SimpleReinforcementLearner

# torch is only needed for ML training — wrap so the API starts without it
try:
    from src.ai.residual_predictor import SpaceWeatherDataManager
    _HAS_TORCH = True
except (ImportError, ModuleNotFoundError):
    SpaceWeatherDataManager = None
    _HAS_TORCH = False

FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend")
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)

# ── Credentials (set ST_USER / ST_PASS env vars in production) ────────────────
ST_USER  = os.environ.get("ST_USER", "prabhuchinmayeework@gmail.com")
ST_PASS  = os.environ.get("ST_PASS", "MajorProject2410")
ST_LOGIN = "https://www.space-track.org/ajaxauth/login"
ST_BASE  = "https://www.space-track.org/basicspacedata/query"

# ── Tracked satellites ─────────────────────────────────────────────────────────
# 104 satellites across 10 categories. NORAD IDs verified against Space-Track.org.
# Expandable at runtime via POST /api/satellites/add.
SATELLITES: dict = {
    # ── Space Stations ──────────────────────────────────────────────────────
    25544: {"name": "ISS",              "type": "space_station",     "color": "#ef4444"},
    48274: {"name": "CSS (Tiangong)",   "type": "space_station",     "color": "#f87171"},

    # ── Starlink — Gen1 / Gen2 mix (16 shells) ───────────────────────────────
    44235: {"name": "STARLINK-23",      "type": "starlink",          "color": "#06b6d4"},
    44713: {"name": "STARLINK-1142",    "type": "starlink",          "color": "#06b6d4"},
    44714: {"name": "STARLINK-1008",    "type": "starlink",          "color": "#06b6d4"},
    44715: {"name": "STARLINK-1009",    "type": "starlink",          "color": "#06b6d4"},
    45178: {"name": "STARLINK-1507",    "type": "starlink",          "color": "#06b6d4"},
    47622: {"name": "STARLINK-2158",    "type": "starlink",          "color": "#06b6d4"},
    49052: {"name": "STARLINK-3023",    "type": "starlink",          "color": "#06b6d4"},
    53544: {"name": "STARLINK-4807",    "type": "starlink",          "color": "#06b6d4"},
    54800: {"name": "STARLINK-5428",    "type": "starlink",          "color": "#06b6d4"},
    55736: {"name": "STARLINK-5064",    "type": "starlink",          "color": "#06b6d4"},
    57045: {"name": "STARLINK-5974",    "type": "starlink",          "color": "#06b6d4"},
    57088: {"name": "STARLINK-6257",    "type": "starlink",          "color": "#06b6d4"},
    58836: {"name": "STARLINK-6404",    "type": "starlink",          "color": "#06b6d4"},
    59643: {"name": "STARLINK-6849",    "type": "starlink",          "color": "#06b6d4"},
    60092: {"name": "STARLINK-32044",   "type": "starlink",          "color": "#06b6d4"},
    61244: {"name": "STARLINK-11276",   "type": "starlink",          "color": "#06b6d4"},

    # ── OneWeb (LEO broadband, ~1200 km) ────────────────────────────────────
    44059: {"name": "ONEWEB-0008",      "type": "oneweb",            "color": "#67e8f9"},
    48971: {"name": "ONEWEB-0253",      "type": "oneweb",            "color": "#67e8f9"},
    54916: {"name": "ONEWEB-0458",      "type": "oneweb",            "color": "#67e8f9"},
    55765: {"name": "ONEWEB-0544",      "type": "oneweb",            "color": "#67e8f9"},
    56069: {"name": "ONEWEB-0581",      "type": "oneweb",            "color": "#67e8f9"},

    # ── Iridium NEXT (LEO, 780 km polar) ────────────────────────────────────
    41917: {"name": "IRIDIUM-106",      "type": "communications",    "color": "#0ea5e9"},
    41918: {"name": "IRIDIUM-103",      "type": "communications",    "color": "#0ea5e9"},
    41919: {"name": "IRIDIUM-109",      "type": "communications",    "color": "#0ea5e9"},
    41920: {"name": "IRIDIUM-102",      "type": "communications",    "color": "#0ea5e9"},
    41921: {"name": "IRIDIUM-111",      "type": "communications",    "color": "#0ea5e9"},
    41922: {"name": "IRIDIUM-104",      "type": "communications",    "color": "#0ea5e9"},
    43069: {"name": "IRIDIUM-117",      "type": "communications",    "color": "#0ea5e9"},
    43070: {"name": "IRIDIUM-118",      "type": "communications",    "color": "#0ea5e9"},
    43249: {"name": "IRIDIUM-130",      "type": "communications",    "color": "#0ea5e9"},

    # ── GEO Communications ───────────────────────────────────────────────────
    37820: {"name": "INTELSAT-18",      "type": "communications",    "color": "#6366f1"},
    39305: {"name": "ASTRA-2E",         "type": "communications",    "color": "#6366f1"},
    40258: {"name": "INTELSAT-30",      "type": "communications",    "color": "#6366f1"},
    41741: {"name": "SES-10",           "type": "communications",    "color": "#6366f1"},
    37214: {"name": "TDRS-11",          "type": "communications",    "color": "#6366f1"},
    44393: {"name": "AEHF-5",           "type": "communications",    "color": "#6366f1"},

    # ── Weather — polar + geostationary ─────────────────────────────────────
    25338: {"name": "NOAA-15",          "type": "weather",           "color": "#f97316"},
    28654: {"name": "NOAA-18",          "type": "weather",           "color": "#f97316"},
    33591: {"name": "NOAA-19",          "type": "weather",           "color": "#f97316"},
    43013: {"name": "NOAA-20",          "type": "weather",           "color": "#f97316"},
    37849: {"name": "SUOMI NPP",        "type": "weather",           "color": "#fb923c"},
    29499: {"name": "METOP-A",          "type": "weather",           "color": "#fdba74"},
    38771: {"name": "METOP-B",          "type": "weather",           "color": "#fdba74"},
    43689: {"name": "METOP-C",          "type": "weather",           "color": "#fdba74"},
    41866: {"name": "GOES-16",          "type": "weather",           "color": "#fbbf24"},
    43226: {"name": "GOES-17",          "type": "weather",           "color": "#fbbf24"},
    51850: {"name": "GOES-18",          "type": "weather",           "color": "#fbbf24"},
    40267: {"name": "HIMAWARI-8",       "type": "weather",           "color": "#fbbf24"},
    43751: {"name": "HIMAWARI-9",       "type": "weather",           "color": "#fbbf24"},

    # ── Earth Observation ───────────────────────────────────────────────────
    25994: {"name": "TERRA",            "type": "earth_observation", "color": "#22c55e"},
    27424: {"name": "AQUA",             "type": "earth_observation", "color": "#22c55e"},
    28376: {"name": "AURA",             "type": "earth_observation", "color": "#22c55e"},
    39084: {"name": "LANDSAT-8",        "type": "earth_observation", "color": "#16a34a"},
    49260: {"name": "LANDSAT-9",        "type": "earth_observation", "color": "#16a34a"},
    39634: {"name": "SENTINEL-1A",      "type": "earth_observation", "color": "#4ade80"},
    60989: {"name": "SENTINEL-2C",      "type": "earth_observation", "color": "#4ade80"},
    41335: {"name": "SENTINEL-3A",      "type": "earth_observation", "color": "#4ade80"},
    43437: {"name": "SENTINEL-3B",      "type": "earth_observation", "color": "#4ade80"},
    66514: {"name": "SENTINEL-6B",      "type": "earth_observation", "color": "#4ade80"},
    36508: {"name": "CRYOSAT-2",        "type": "earth_observation", "color": "#86efac"},
    33105: {"name": "JASON-2",          "type": "earth_observation", "color": "#86efac"},
    43613: {"name": "ICESAT-2",         "type": "earth_observation", "color": "#86efac"},
    40059: {"name": "OCO-2",            "type": "earth_observation", "color": "#86efac"},
    29108: {"name": "CALIPSO",          "type": "earth_observation", "color": "#86efac"},
    36605: {"name": "TANDEM-X",         "type": "earth_observation", "color": "#86efac"},
    32382: {"name": "RADARSAT-2",       "type": "earth_observation", "color": "#86efac"},
    38012: {"name": "PLEIADES-1A",      "type": "earth_observation", "color": "#16a34a"},
    40010: {"name": "PLEIADES-1B",      "type": "earth_observation", "color": "#16a34a"},
    40799: {"name": "WORLDVIEW-3",      "type": "earth_observation", "color": "#16a34a"},
    41240: {"name": "CARTOSAT-2C",      "type": "earth_observation", "color": "#16a34a"},
    43115: {"name": "GAOFEN-6",         "type": "earth_observation", "color": "#16a34a"},
    47948: {"name": "SENTINEL-6A",      "type": "earth_observation", "color": "#4ade80"},

    # ── Science & Telescopes ────────────────────────────────────────────────
    20580: {"name": "HST",              "type": "telescope",         "color": "#a855f7"},
    43435: {"name": "TESS",             "type": "science",           "color": "#c084fc"},
    44935: {"name": "CHEOPS",           "type": "science",           "color": "#c084fc"},
    43476: {"name": "GRACE-FO 1",       "type": "science",           "color": "#c084fc"},
    43477: {"name": "GRACE-FO 2",       "type": "science",           "color": "#c084fc"},
    39452: {"name": "SWARM-A",          "type": "science",           "color": "#d8b4fe"},
    39451: {"name": "SWARM-B",          "type": "science",           "color": "#d8b4fe"},
    39453: {"name": "SWARM-C",          "type": "science",           "color": "#d8b4fe"},
    57320: {"name": "EUCLID",           "type": "telescope",         "color": "#a855f7"},

    # ── Navigation: GPS/NAVSTAR ──────────────────────────────────────────────
    22657: {"name": "NAVSTAR-32",       "type": "navigation",        "color": "#facc15"},
    25933: {"name": "NAVSTAR-46",       "type": "navigation",        "color": "#facc15"},
    28474: {"name": "NAVSTAR-56",       "type": "navigation",        "color": "#facc15"},
    40730: {"name": "NAVSTAR-74",       "type": "navigation",        "color": "#facc15"},
    43873: {"name": "NAVSTAR-76",       "type": "navigation",        "color": "#facc15"},

    # ── Navigation: Galileo (EU GNSS, MEO ~23222 km) ────────────────────────
    37846: {"name": "GALILEO-FM1",      "type": "navigation",        "color": "#3b82f6"},
    38857: {"name": "GALILEO-FM2",      "type": "navigation",        "color": "#3b82f6"},
    40128: {"name": "GALILEO-FM3",      "type": "navigation",        "color": "#3b82f6"},
    40129: {"name": "GALILEO-FM4",      "type": "navigation",        "color": "#3b82f6"},
    40544: {"name": "GALILEO-FM5",      "type": "navigation",        "color": "#3b82f6"},
    41174: {"name": "GALILEO-FM7",      "type": "navigation",        "color": "#3b82f6"},
    41175: {"name": "GALILEO-FM8",      "type": "navigation",        "color": "#3b82f6"},

    # ── Navigation: GLONASS (Russian GNSS, MEO ~19100 km) ───────────────────
    32276: {"name": "GLONASS-M 730",    "type": "navigation",        "color": "#a855f7"},
    33436: {"name": "GLONASS-M 732",    "type": "navigation",        "color": "#a855f7"},
    36111: {"name": "GLONASS-M 733",    "type": "navigation",        "color": "#a855f7"},
    37372: {"name": "GLONASS-M 737",    "type": "navigation",        "color": "#a855f7"},
    40315: {"name": "GLONASS-M 746",    "type": "navigation",        "color": "#a855f7"},
    41330: {"name": "GLONASS-K1 751",   "type": "navigation",        "color": "#a855f7"},

    # ── Navigation: BeiDou MEO (Chinese GNSS, ~21528 km) ────────────────────
    40748: {"name": "BEIDOU-3 M1",      "type": "navigation",        "color": "#f59e0b"},
    40749: {"name": "BEIDOU-3 M2",      "type": "navigation",        "color": "#f59e0b"},
    43001: {"name": "BEIDOU-3 M9",      "type": "navigation",        "color": "#f59e0b"},
    43002: {"name": "BEIDOU-3 M10",     "type": "navigation",        "color": "#f59e0b"},
    44204: {"name": "BEIDOU-3 M21",     "type": "navigation",        "color": "#f59e0b"},
    44205: {"name": "BEIDOU-3 M22",     "type": "navigation",        "color": "#f59e0b"},
}

# ── In-memory cache ────────────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL = 900  # 15 minutes

def get_cached(key):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None

def set_cached(key, data):
    _cache[key] = {"data": data, "ts": time.time()}

# ── Skyfield timescale — loaded once ──────────────────────────────────────────
_ts = None
def get_ts():
    global _ts
    if _ts is None:
        from skyfield.api import Loader
        _ts = Loader("data").timescale()
    return _ts

# ── Space-Track session ────────────────────────────────────────────────────────
_st_session = None
_st_session_ts = 0

def get_st_session():
    global _st_session, _st_session_ts
    if _st_session and (time.time() - _st_session_ts) < 3600:
        return _st_session
    s = requests.Session()
    s.post(ST_LOGIN, data={"identity": ST_USER, "password": ST_PASS}, timeout=15).raise_for_status()
    _st_session, _st_session_ts = s, time.time()
    return s

# ── Fetch all TLEs in ONE batch request ───────────────────────────────────────
def fetch_all_tles() -> dict:
    """Fetch TLEs for all tracked satellites in a single Space-Track call."""
    cached = get_cached("all_tles")
    if cached:
        return cached

    id_str = ",".join(str(i) for i in SATELLITES)
    try:
        session = get_st_session()
        url = (f"{ST_BASE}/class/gp/NORAD_CAT_ID/{id_str}"
               f"/orderby/EPOCH%20desc/limit/{len(SATELLITES)+10}/format/json/emptyresult/show")
        resp = session.get(url, timeout=20)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        app.logger.warning(f"Space-Track batch fetch failed: {e}. Falling back to local TLEs.")
        raw = []

    GM = 398600.4418
    seen = set()
    result = {}
    for gp in raw:
        nid = int(gp.get("NORAD_CAT_ID", 0))
        if nid not in SATELLITES or nid in seen:
            continue
        seen.add(nid)
        period = float(gp.get("PERIOD") or 0)
        if period > 0:
            n_rad = 2 * np.pi / (period * 60)
            alt_km = round((GM / n_rad**2) ** (1/3) - 6371, 1)
        else:
            alt_km = 0.0
        result[nid] = {
            "norad_id":    nid,
            "name":        gp.get("OBJECT_NAME", SATELLITES[nid]["name"]),
            "tle_line1":   gp.get("TLE_LINE1", ""),
            "tle_line2":   gp.get("TLE_LINE2", ""),
            "epoch":       gp.get("EPOCH", ""),
            "altitude_km": alt_km,
            "inclination": round(float(gp.get("INCLINATION") or 0), 4),
            "eccentricity":round(float(gp.get("ECCENTRICITY") or 0), 6),
            "period_min":  round(period, 3),
            "type":        SATELLITES[nid]["type"],
            "color":       SATELLITES[nid]["color"],
            "source":      "spacetrack",
        }

    # Fill any missing from local TLE files
    for nid in SATELLITES:
        if nid not in result:
            fb = _local_tle(nid)
            if fb:
                result[nid] = fb

    set_cached("all_tles", result)
    return result

def _local_tle(norad_id: int) -> dict | None:
    path = os.path.join("data", f"tle_{norad_id}.txt")
    if not os.path.exists(path):
        return None
    with open(path) as f:
        lines = [l.strip() for l in f if l.strip()]
    if len(lines) < 2:
        return None
    l0 = lines[0]
    l1 = lines[1] if not l0.startswith("1 ") else lines[0]
    l2 = lines[2] if len(lines) > 2 and not l0.startswith("1 ") else lines[1]
    name = l0 if not l0.startswith("1 ") else SATELLITES.get(norad_id, {}).get("name", str(norad_id))
    n = float(l2[52:63])
    period = 1440.0 / n if n else 0
    GM = 398600.4418
    alt = round((GM / (2 * np.pi / (period * 60))**2)**(1/3) - 6371, 1) if period > 0 else 0
    return {
        "norad_id":    norad_id,
        "name":        name,
        "tle_line1":   l1,
        "tle_line2":   l2,
        "epoch":       "local",
        "altitude_km": alt,
        "inclination": round(float(l2[8:16]), 4),
        "eccentricity":round(float("0." + l2[26:33]), 6),
        "period_min":  round(period, 3),
        "type":        SATELLITES.get(norad_id, {}).get("type", "unknown"),
        "color":       SATELLITES.get(norad_id, {}).get("color", "#6b7280"),
        "source":      "local",
    }

# ── SGP4 propagation (single epoch) ───────────────────────────────────────────
def get_position_velocity(tle_line1: str, tle_line2: str):
    """Return position (km) and velocity (km/s) at the current epoch."""
    from skyfield.api import EarthSatellite
    ts  = get_ts()
    sat = EarthSatellite(tle_line1, tle_line2, ts=ts)
    t   = ts.now()
    astrometric = sat.at(t)
    pos = astrometric.position.km
    vel = astrometric.velocity.km_per_s
    return np.array(pos), np.array(vel)

# ── Frontend routes ────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/pages/<path:filename>")
def pages(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "pages"), filename)

@app.route("/css/<path:filename>")
def css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "css"), filename)

@app.route("/js/<path:filename>")
def js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, "js"), filename)

# ── API routes ─────────────────────────────────────────────────────────────────
@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat(),
                    "tracked_satellites": len(SATELLITES)})


@app.route("/api/satellites")
def get_satellites():
    tles = fetch_all_tles()
    return jsonify({
        "satellites":         list(tles.values()),
        "total_tracked":      len(tles),
        "fetched_at":         datetime.utcnow().isoformat(),
    })


@app.route("/api/conjunctions")
def get_conjunctions():
    cached = get_cached("conjunctions")
    if cached:
        return jsonify(cached)

    tles = fetch_all_tles()
    iss = tles.get(25544)
    if not iss or not iss.get("tle_line1"):
        return jsonify({"error": "ISS TLE unavailable"}), 503

    try:
        iss_pos, iss_vel = get_position_velocity(iss["tle_line1"], iss["tle_line2"])
    except Exception as e:
        return jsonify({"error": f"ISS propagation failed: {e}"}), 500

    ca      = ConjunctionAssessment()
    iss_cov = np.eye(3) * 0.01
    # 24-hour linear assessment window
    time_sec = np.linspace(0, 86400, 50)

    conjunctions = []
    for nid, sat in tles.items():
        if nid == 25544 or not sat.get("tle_line1"):
            continue
        try:
            sat_pos, sat_vel = get_position_velocity(sat["tle_line1"], sat["tle_line2"])
            dca, tca, _ = ca.compute_distance_of_closest_approach(
                iss_pos, iss_vel, sat_pos, sat_vel, time_sec
            )
            rel_vel = iss_vel - sat_vel
            pc = ca.compute_probability_of_collision(dca, iss_cov, np.eye(3) * 0.02, rel_vel)

            if not (np.isfinite(dca) and np.isfinite(pc)):
                continue

            conjunctions.append({
                "primary":     "ISS (25544)",
                "secondary":   sat["name"],
                "norad_id":    nid,
                "dca_km":      round(float(dca), 3),
                "tca_utc":     (datetime.utcnow() + timedelta(seconds=float(tca))).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "pc":          float(pc),
                "risk":        _risk_level(pc),
                "altitude_km": sat.get("altitude_km", 0),
                "inclination": sat.get("inclination", 0),
                "rel_vel_kms": round(float(np.linalg.norm(rel_vel)), 3),
                "epoch":       sat.get("epoch", "")[:10],
            })
        except Exception as e:
            app.logger.warning(f"Conjunction {nid} failed: {e}")

    conjunctions.sort(key=lambda x: x["pc"], reverse=True)
    payload = {
        "conjunctions":    conjunctions,
        "total_pairs":     len(conjunctions),
        "high_risk_count": sum(1 for c in conjunctions if c["pc"] > 1e-4),
        "critical_count":  sum(1 for c in conjunctions if c["pc"] > 1e-3),
        "min_dca_km":      round(min((c["dca_km"] for c in conjunctions), default=0), 3),
        "iss_epoch":       iss.get("epoch", "")[:10],
        "computed_at":     datetime.utcnow().isoformat(),
    }
    set_cached("conjunctions", payload)
    return jsonify(payload)


def _fetch_f107(date):
    try:
        r = requests.get(
            "https://www.ncei.noaa.gov/data/space-weather-indices-solar-flux/data/swpc_f10_7_daily.txt",
            timeout=6)
        if r.ok:
            for line in r.text.splitlines():
                if line.startswith(':'): continue
                p = line.split()
                if len(p) >= 4 and int(p[0]) == date.year and int(p[1]) == date.month and int(p[2]) == date.day:
                    return float(p[3])
    except Exception:
        pass
    day_of_cycle = date.toordinal() % (11 * 365)
    return round(100 + 50 * np.sin(2 * np.pi * day_of_cycle / (11 * 365)), 1)

def _fetch_ap(date):
    try:
        r = requests.get(
            "https://www.ncei.noaa.gov/data/space-weather-indices-ap-index/data/ap_index.txt",
            timeout=6)
        if r.ok:
            for line in r.text.splitlines():
                if line.startswith('YY'): continue
                p = line.split()
                if len(p) >= 4:
                    try:
                        y = int(p[0]); m = int(p[1]); d = int(p[2])
                        if (y == date.year or y == date.year % 100) and m == date.month and d == date.day:
                            return float(p[3])
                    except ValueError:
                        continue
    except Exception:
        pass
    np.random.seed(date.toordinal())
    return round(float(20 + 50 * np.random.random()), 1)

@app.route("/api/weather")
def get_weather():
    cached = get_cached("weather")
    if cached:
        return jsonify(cached)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if _HAS_TORCH and SpaceWeatherDataManager:
        sw      = SpaceWeatherDataManager()
        f107    = sw.get_f107_daily(now)
        ap      = sw.get_ap_index(now)
        density = sw.compute_atmospheric_density_factor(f107, ap)
    else:
        f107    = _fetch_f107(now)
        ap      = _fetch_ap(now)
        density = max(0.5, min(3.0, (f107 / 150.0) * (1 + ap / 100.0)))
    payload = {
        "f107":           round(float(f107), 1),
        "ap_index":       round(float(ap), 1),
        "density_factor": round(float(density), 4),
        "density_400km":  float(f"{1.2e-12 * density:.3e}"),
        "solar_cycle":    "25",
        "fetched_at":     datetime.utcnow().isoformat(),
    }
    set_cached("weather", payload)
    return jsonify(payload)


@app.route("/api/maneuver", methods=["POST"])
def compute_maneuver():
    body      = request.get_json() or {}
    target_id = int(body.get("norad_id", 44714))
    dv_max    = float(body.get("delta_v_max", 0.5))

    tles = fetch_all_tles()
    iss  = tles.get(25544)
    sat  = tles.get(target_id)
    if not iss or not sat:
        return jsonify({"error": "TLE unavailable"}), 503

    try:
        iss_pos, iss_vel = get_position_velocity(iss["tle_line1"], iss["tle_line2"])
        sat_pos, sat_vel = get_position_velocity(sat["tle_line1"], sat["tle_line2"])
        ca  = ConjunctionAssessment()
        dca, tca, _ = ca.compute_distance_of_closest_approach(
            iss_pos, iss_vel, sat_pos, sat_vel, np.linspace(0, 86400, 50)
        )
        pc_before = ca.compute_probability_of_collision(
            dca, np.eye(3)*0.01, np.eye(3)*0.02, iss_vel - sat_vel
        )
        rl = SimpleReinforcementLearner(max_delta_v=dv_max)
        res = rl.optimize_maneuver(iss_pos, iss_vel, sat_pos, sat_vel, dca, pc_before,
                                    n_candidates=200, top_k=3)
        m   = res["recommended_maneuver"]
        mag = float(np.sqrt(m.delta_v_x**2 + m.delta_v_y**2 + m.delta_v_z**2))
        return jsonify({
            "target":         sat["name"],
            "before_pc":      float(pc_before),
            "before_dca_km":  round(float(dca), 3),
            "delta_v":        {"x_ms": round(m.delta_v_x,5), "y_ms": round(m.delta_v_y,5),
                               "z_ms": round(m.delta_v_z,5), "magnitude_ms": round(mag,5)},
            "fuel_kg":        round(float(m.fuel_cost_kg), 3),
            "risk_reduction": round(float(m.risk_reduction)*100, 1),
            "burn_time_utc":  m.burn_time_utc,
            "computed_at":    datetime.utcnow().isoformat(),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/assessment")
def full_assessment():
    sats_r    = get_satellites().get_json()
    weather_r = get_weather().get_json()
    conj_r    = get_conjunctions().get_json()
    return jsonify({
        "tracked_satellites": sats_r.get("total_tracked", 0),
        "conjunctions":       conj_r.get("total_pairs", 0),
        "high_risk":          conj_r.get("high_risk_count", 0),
        "critical":           conj_r.get("critical_count", 0),
        "min_dca_km":         conj_r.get("min_dca_km", 0),
        "space_weather":      weather_r,
        "satellite_list":     sats_r.get("satellites", []),
        "conjunction_list":   conj_r.get("conjunctions", []),
        "computed_at":        datetime.utcnow().isoformat(),
    })


@app.route("/api/catalog/search")
def catalog_search():
    """
    Search Space-Track catalog by name fragment or NORAD ID.
    ?q=hubble  or  ?q=25544
    Returns up to 20 matches.
    """
    q = request.args.get("q", "").strip()
    if len(q) < 2:
        return jsonify({"error": "Query must be at least 2 characters"}), 400

    try:
        session = get_st_session()
        if q.isdigit():
            url = (f"{ST_BASE}/class/gp/NORAD_CAT_ID/{q}"
                   f"/orderby/EPOCH%20desc/limit/5/format/json/emptyresult/show")
        else:
            safe_q = requests.utils.quote(q.upper())
            url = (f"{ST_BASE}/class/gp/OBJECT_NAME/~~{safe_q}"
                   f"/orderby/EPOCH%20desc/limit/20/format/json/emptyresult/show")
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        return jsonify({"error": str(e)}), 503

    GM = 398600.4418
    results = []
    seen = set()
    for gp in raw:
        nid = int(gp.get("NORAD_CAT_ID", 0))
        if nid in seen:
            continue
        seen.add(nid)
        period = float(gp.get("PERIOD") or 0)
        alt = round((GM / (2*np.pi/(period*60))**2)**(1/3) - 6371, 1) if period > 0 else 0
        results.append({
            "norad_id":    nid,
            "name":        gp.get("OBJECT_NAME", ""),
            "altitude_km": alt,
            "inclination": round(float(gp.get("INCLINATION") or 0), 3),
            "period_min":  round(period, 2),
            "epoch":       (gp.get("EPOCH") or "")[:10],
            "tracked":     nid in SATELLITES,
        })

    return jsonify({"results": results, "count": len(results), "query": q})


@app.route("/api/satellites/add", methods=["POST"])
def add_satellite():
    """
    Add a satellite to the live tracking list.
    Body: { "norad_id": 12345, "name": "MY-SAT", "type": "custom", "color": "#ff0000" }
    """
    body = request.get_json() or {}
    nid  = int(body.get("norad_id", 0))
    if not nid:
        return jsonify({"error": "norad_id required"}), 400
    if nid in SATELLITES:
        return jsonify({"message": "Already tracked", "norad_id": nid}), 200

    SATELLITES[nid] = {
        "name":  body.get("name", f"SAT-{nid}"),
        "type":  body.get("type", "custom"),
        "color": body.get("color", "#94a3b8"),
    }
    # Invalidate caches so next fetch picks it up
    _cache.pop("all_tles", None)
    _cache.pop("conjunctions", None)
    return jsonify({"message": f"Now tracking {SATELLITES[nid]['name']}", "norad_id": nid}), 201


@app.route("/api/satellites/remove", methods=["POST"])
def remove_satellite():
    """Remove a satellite from tracking. Body: { "norad_id": 12345 }"""
    nid = int((request.get_json() or {}).get("norad_id", 0))
    if nid == 25544:
        return jsonify({"error": "Cannot remove ISS (primary object)"}), 400
    if nid not in SATELLITES:
        return jsonify({"error": "Not tracked"}), 404
    name = SATELLITES.pop(nid)["name"]
    _cache.pop("all_tles", None)
    _cache.pop("conjunctions", None)
    return jsonify({"message": f"Removed {name}", "norad_id": nid})


@app.route("/api/leaderboard")
def get_leaderboard():
    import csv
    csv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "leaderboard.csv")
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rows.append({
                "model":        row["Model"],
                "type":         row["Type"],
                "mae_km":       float(row["MAE (km)"]),
                "rmse_km":      float(row["RMSE (km)"]),
                "r2":           float(row["R²"]),
                "train_time_s": float(row["Train Time (s)"]),
                "mae_x":        float(row["MAE_X"]),
                "mae_y":        float(row["MAE_Y"]),
                "mae_z":        float(row["MAE_Z"]),
            })
    best = min(rows, key=lambda r: r["mae_km"])
    return jsonify({"models": rows, "best_model": best["model"], "count": len(rows)})


def _risk_level(pc: float) -> str:
    if pc > 1e-3: return "critical"
    if pc > 1e-4: return "high"
    if pc > 1e-5: return "medium"
    return "low"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Trajector API  →  http://localhost:{port}")
    print(f"Dashboard      →  http://localhost:{port}/")
    print(f"Space-Track    →  {ST_USER}")
    app.run(host="0.0.0.0", port=port, debug=False)
