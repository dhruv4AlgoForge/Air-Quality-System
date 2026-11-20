import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
import requests
import uvicorn
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env", encoding="utf-8-sig")

API_KEY = os.getenv("WAQI_TOKEN")
if not API_KEY:
    raise RuntimeError("WAQI_TOKEN is not set. Create a .env file with WAQI_TOKEN=your_token")

TEMPLATES_DIR = BASE_DIR / "templates"
FEATURED_CITIES = ["Delhi", "Mumbai", "Bengaluru", "Kolkata", "Chennai", "London"]

app = FastAPI(title="AeroVision")
app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

session = requests.Session()
session.trust_env = False
CITY_HISTORY = defaultdict(list)
MAX_HISTORY = 12


def safe_value(payload, key):
    try:
        return float(payload.get(key, {}).get("v", 0))
    except (TypeError, ValueError):
        return 0.0


def scale_range(value, low_in, high_in, low_out, high_out):
    if value <= low_in:
        return low_out
    if value >= high_in:
        return high_out
    ratio = (value - low_in) / (high_in - low_in)
    return low_out + ratio * (high_out - low_out)


def pollutant_subindex(value, breakpoints):
    for low_in, high_in, low_out, high_out in breakpoints:
        if low_in <= value <= high_in:
            return scale_range(value, low_in, high_in, low_out, high_out)
    if value > breakpoints[-1][1]:
        low_in, high_in, low_out, high_out = breakpoints[-1]
        return scale_range(min(value, high_in * 1.4), low_in, high_in * 1.4, low_out, 500)
    return 0.0


def estimate_aqi(data):
    pm25 = pollutant_subindex(data["pm25"], [(0.0, 12.0, 0, 50), (12.1, 35.4, 51, 100), (35.5, 55.4, 101, 150), (55.5, 150.4, 151, 200), (150.5, 250.4, 201, 300), (250.5, 350.4, 301, 400)])
    pm10 = pollutant_subindex(data["pm10"], [(0, 54, 0, 50), (55, 154, 51, 100), (155, 254, 101, 150), (255, 354, 151, 200), (355, 424, 201, 300), (425, 504, 301, 400)])
    no2 = pollutant_subindex(data["no2"], [(0, 53, 0, 50), (54, 100, 51, 100), (101, 360, 101, 150), (361, 649, 151, 200), (650, 1249, 201, 300)])
    so2 = pollutant_subindex(data["so2"], [(0, 35, 0, 50), (36, 75, 51, 100), (76, 185, 101, 150), (186, 304, 151, 200), (305, 604, 201, 300)])
    co = pollutant_subindex(data["co"], [(0.0, 4.4, 0, 50), (4.5, 9.4, 51, 100), (9.5, 12.4, 101, 150), (12.5, 15.4, 151, 200), (15.5, 30.4, 201, 300)])
    o3 = pollutant_subindex(data["o3"], [(0, 54, 0, 50), (55, 70, 51, 100), (71, 85, 101, 150), (86, 105, 151, 200), (106, 200, 201, 300)])
    return round(max(pm25, pm10, no2, so2, co, o3), 2)


def classify_aqi(value):
    if value <= 50:
        return "Good", "#3ddc97"
    if value <= 100:
        return "Moderate", "#fbbf24"
    if value <= 150:
        return "Sensitive", "#fb923c"
    if value <= 200:
        return "Unhealthy", "#f87171"
    if value <= 300:
        return "Very Unhealthy", "#c084fc"
    return "Hazardous", "#f43f5e"


def build_health_recommendations(aqi, dominant):
    level, _ = classify_aqi(aqi)
    advice = {
        "Good": [
            "Outdoor activity is generally safe for most people.",
            "A good window for walking, cycling, and open-air exercise.",
            f"Keep an eye on {dominant} if conditions shift later in the day.",
        ],
        "Moderate": [
            "Sensitive people should reduce long outdoor exertion.",
            "Balance indoor ventilation if nearby traffic is heavy.",
            f"Watch the dominant pollutant {dominant} for irritation symptoms.",
        ],
        "Sensitive": [
            "Children, elderly people, and asthma patients should limit outdoor activity.",
            "Prefer shorter trips and keep rescue medication nearby if needed.",
            "Closing windows during peak traffic can reduce indoor exposure.",
        ],
        "Unhealthy": [
            "Avoid strenuous outdoor exercise and cut prolonged exposure.",
            "Use a well-fitted mask outside if travel is necessary.",
            "Keep indoor air cleaner with filtration or closed windows.",
        ],
        "Very Unhealthy": [
            "Stay indoors as much as possible, especially sensitive groups.",
            "Avoid outdoor workouts and unnecessary travel.",
            "Use air purification and monitor symptoms closely.",
        ],
        "Hazardous": [
            "Avoid outdoor exposure unless absolutely necessary.",
            "Keep vulnerable family members indoors with cleaner air support.",
            "Seek medical help if breathing difficulty or chest discomfort appears.",
        ],
    }
    return {"level": level, "items": advice[level]}


def pollution_meanings(data):
    return [
        {"name": "PM2.5", "value": data["pm25"], "color": "#58c7ff", "meaning": "Very fine particulate matter from smoke, dust, fuel burning, and industry.", "harm": "Can go deep into the lungs and may enter the bloodstream, increasing heart and breathing risks."},
        {"name": "PM10", "value": data["pm10"], "color": "#51e3b0", "meaning": "Larger inhalable particles from roads, construction, and open dust sources.", "harm": "Irritates the nose, throat, and lungs and can worsen asthma or breathing discomfort."},
        {"name": "NO2", "value": data["no2"], "color": "#ffb84d", "meaning": "Nitrogen dioxide linked mostly to vehicle exhaust and combustion.", "harm": "Inflames airways, reduces lung function, and can trigger respiratory symptoms."},
        {"name": "SO2", "value": data["so2"], "color": "#ff7d93", "meaning": "Sulfur dioxide often produced by coal and industrial fuel burning.", "harm": "Can quickly irritate the lungs and is especially harmful for people with asthma."},
        {"name": "CO", "value": data["co"], "color": "#bb86fc", "meaning": "Carbon monoxide from incomplete fuel burning in vehicles and machinery.", "harm": "Reduces oxygen delivery in the body and may cause headache, weakness, and serious danger at high exposure."},
        {"name": "O3", "value": data["o3"], "color": "#4ade80", "meaning": "Ground-level ozone formed when sunlight reacts with traffic and industrial emissions.", "harm": "Can cause chest irritation, coughing, and breathing stress during outdoor exposure."},
    ]


def record_history(city_key, data):
    stamp = datetime.now().strftime("%H:%M")
    CITY_HISTORY[city_key].append({"time": stamp, "aqi": round(data["aqi"], 2), "estimate": round(data["estimate"], 2)})
    if len(CITY_HISTORY[city_key]) > MAX_HISTORY:
        CITY_HISTORY[city_key] = CITY_HISTORY[city_key][-MAX_HISTORY:]


def normalize_city_name(city: str) -> str:
    return unquote(city).replace("-", " ").strip()


def render_page(name: str, replacements: dict[str, str]) -> str:
    page_html = (TEMPLATES_DIR / name).read_text(encoding="utf-8")
    base_html = (TEMPLATES_DIR / "base.html").read_text(encoding="utf-8")
    html = base_html.replace("__PAGE_CONTENT__", page_html)
    for key, value in replacements.items():
        html = html.replace(key, value)
    return html


def featured_city_links() -> str:
    return "".join(f'<a class="city-chip" href="/city/{city.replace(" ", "%20")}">{city}</a>' for city in FEATURED_CITIES)


def featured_compare_chips() -> str:
    return "".join(f'<button class="city-chip button-chip" type="button" data-compare-chip="{city}">{city}</button>' for city in FEATURED_CITIES[:4])


def fetch_data(city):
    city = normalize_city_name(city)
    try:
        response = session.get(f"https://api.waqi.info/feed/{city}/?token={API_KEY}", timeout=12)
        response.raise_for_status()
        payload = response.json()
    except requests.RequestException as error:
        raise HTTPException(status_code=502, detail=f"WAQI request failed: {error}") from error

    if payload.get("status") != "ok":
        raise HTTPException(status_code=404, detail="City not found in WAQI")

    data = payload["data"]
    iaqi = data.get("iaqi", {})
    result = {
        "city": data.get("city", {}).get("name", city.title()),
        "aqi": float(data.get("aqi", 0)),
        "time": data.get("time", {}).get("s", "N/A"),
        "dominant": data.get("dominentpol", "unknown").upper(),
        "geo": data.get("city", {}).get("geo", []),
        "pm25": safe_value(iaqi, "pm25"),
        "pm10": safe_value(iaqi, "pm10"),
        "no2": safe_value(iaqi, "no2"),
        "so2": safe_value(iaqi, "so2"),
        "co": safe_value(iaqi, "co"),
        "o3": safe_value(iaqi, "o3"),
        "forecast": data.get("forecast", {}).get("daily", {}).get("pm25", [])[:4],
    }
    result["estimate"] = estimate_aqi(result)
    result["live_label"], result["live_color"] = classify_aqi(result["aqi"])
    result["estimate_label"], result["estimate_color"] = classify_aqi(result["estimate"])
    result["health"] = build_health_recommendations(result["aqi"], result["dominant"])
    result["meanings"] = pollution_meanings(result)
    city_key = result["city"].lower()
    record_history(city_key, result)
    result["history"] = CITY_HISTORY[city_key]
    return result


@app.get("/", response_class=HTMLResponse)
def index():
    return render_page(
        "index.html",
        {
            "__PAGE_TITLE__": "AeroVision",
            "__PAGE_ID__": "home",
            "__FEATURED_CITY_LINKS__": featured_city_links(),
        },
    )


@app.get("/city")
def city_redirect(city: str = Query(..., min_length=1)):
    return RedirectResponse(url=f"/city/{city.strip()}", status_code=302)


@app.get("/city/{city_name}", response_class=HTMLResponse)
def city_page(city_name: str):
    name = normalize_city_name(city_name)
    return render_page(
        "city.html",
        {
            "__PAGE_TITLE__": f"{name.title()} Air Quality",
            "__PAGE_ID__": "city",
            "__CITY_NAME__": name,
        },
    )


@app.get("/compare", response_class=HTMLResponse)
def compare_page(cities: str = "Delhi,Mumbai,Bengaluru"):
    compare_cities = [normalize_city_name(city) for city in cities.split(",") if city.strip()][:4]
    if not compare_cities:
        compare_cities = FEATURED_CITIES[:3]
    return render_page(
        "compare.html",
        {
            "__PAGE_TITLE__": "Compare Cities",
            "__PAGE_ID__": "compare",
            "__COMPARE_CITIES__": ", ".join(compare_cities),
            "__COMPARE_CITY_ATTR__": ",".join(compare_cities),
            "__FEATURED_COMPARE_CHIPS__": featured_compare_chips(),
        },
    )


@app.get("/api/aqi")
def api_aqi(city: str):
    return fetch_data(city)


@app.get("/api/compare")
def api_compare(cities: str):
    parsed = [normalize_city_name(city) for city in cities.split(",") if city.strip()][:4]
    if not parsed:
        raise HTTPException(status_code=400, detail="At least one city is required")
    return {"cities": [fetch_data(city) for city in parsed]}


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8080)

