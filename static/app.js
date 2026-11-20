
const bodyPage = document.body.dataset.page;
let refreshHandle = null;

function byId(id) {
  return document.getElementById(id);
}

function encodeCity(city) {
  return encodeURIComponent(city.trim());
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function chipHtml(text, color) {
  return `<span class="chip" style="color:${color};background:${color}22">${escapeHtml(text)}</span>`;
}

function skeletonPanel() {
  return `<div class="skeleton-block skeleton"></div><div class="skeleton-line skeleton"></div><div class="skeleton-line skeleton" style="width:72%"></div>`;
}

function buildResponseDeck(data) {
  const aqi = Math.round(data.aqi);
  if (aqi <= 50) return { title: "Fresh-Air Window", score: "A", items: ["Best time for walking, cycling, and outdoor exercise.", "No special mask support needed for most people.", "Open windows when local traffic and dust are low."] };
  if (aqi <= 100) return { title: "Balanced Outdoor Plan", score: "B", items: ["Outdoor activity is still okay for most people, but keep it moderate.", "Sensitive groups should shorten long exposure near traffic.", "Ventilate indoors carefully during cleaner hours."] };
  if (aqi <= 150) return { title: "Caution Mode", score: "C", items: ["Reduce heavy outdoor workouts, especially for children and elderly people.", "Use a mask if you spend long time near traffic or smoke.", "Keep indoor air cleaner and avoid peak-road exposure."] };
  if (aqi <= 200) return { title: "Protection Needed", score: "D", items: ["Avoid intense outdoor exercise and limit unnecessary exposure.", "Use a well-fitted mask for commuting or roadside travel.", "Keep windows closed during polluted periods and use filtration if possible."] };
  return { title: "High-Risk Response", score: "E", items: ["Stay indoors as much as possible and cut outdoor activity sharply.", "Use mask protection when going outside is unavoidable.", "Support indoor air quality with closed windows and purifier airflow."] };
}

function pollutionMeaning(item) {
  const width = Math.min((Number(item.value) / 300) * 100, 100);
  return `<div class="pollutant"><div class="pollutant-top"><strong>${escapeHtml(item.name)}</strong><span class="soft">${Number(item.value).toFixed(2)}</span></div><div class="bar"><span style="width:${width}%;background:${item.color}"></span></div><div class="soft" style="margin-top:10px"><strong>Meaning:</strong> ${escapeHtml(item.meaning)}</div><div class="soft" style="margin-top:6px"><strong>Why harmful:</strong> ${escapeHtml(item.harm)}</div></div>`;
}

function renderPollutantChart(data) {
  const svg = byId("pollutantChart");
  if (!svg) return;
  const items = [["PM2.5", data.pm25, "#38bdf8"], ["PM10", data.pm10, "#2dd4bf"], ["NO2", data.no2, "#f59e0b"], ["SO2", data.so2, "#fb7185"], ["CO", data.co, "#a78bfa"], ["O3", data.o3, "#34d399"]];
  const maxValue = Math.max(...items.map((item) => item[1]), 1);
  const barWidth = 56;
  const gap = 28;
  let x = 34;
  let bars = "";
  for (const [, value, color] of items) {
    const h = (value / maxValue) * 150;
    const y = 182 - h;
    bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="14" fill="${color}" opacity="0.92"></rect>`;
    bars += `<text x="${x + barWidth / 2}" y="${y - 8}" fill="#dff2ff" font-size="12" text-anchor="middle">${Number(value).toFixed(1)}</text>`;
    x += barWidth + gap;
  }
  svg.innerHTML = `<line x1="20" y1="182" x2="500" y2="182" stroke="rgba(255,255,255,.2)" /><line x1="20" y1="28" x2="20" y2="182" stroke="rgba(255,255,255,.12)" />${bars}`;
}

function renderPressureBoard(data) {
  const board = byId("pressureBoard");
  if (!board) return;
  const pollutants = [
    { name: "PM2.5", value: data.pm25, color: "#38bdf8", tag: "fine particles" },
    { name: "PM10", value: data.pm10, color: "#2dd4bf", tag: "dust load" },
    { name: "NO2", value: data.no2, color: "#f59e0b", tag: "traffic gas" },
    { name: "SO2", value: data.so2, color: "#fb7185", tag: "industrial gas" },
    { name: "CO", value: data.co, color: "#a78bfa", tag: "oxygen stress" },
    { name: "O3", value: data.o3, color: "#34d399", tag: "surface ozone" }
  ].sort((a, b) => b.value - a.value);
  board.innerHTML = pollutants.slice(0, 4).map((item, index) => `<div class="pressure-card"><div class="kicker">Priority ${index + 1}</div><strong style="color:${item.color}">${item.name}</strong><div class="soft">Current load: ${Number(item.value).toFixed(2)}</div><div class="soft" style="margin-top:6px">Signal: ${item.tag}</div></div>`).join("");
}

function renderMap(data) {
  const wrap = byId("mapWrap");
  const meta = byId("mapMeta");
  if (!wrap || !meta) return;
  meta.classList.add("hidden");
  meta.innerHTML = "";
  if (!data.geo || data.geo.length !== 2) {
    wrap.innerHTML = '<div class="map-empty">Map location is not available for this station.</div>';
    return;
  }
  const [lat, lon] = data.geo;
  wrap.innerHTML = `<iframe class="map-frame" src="https://www.openstreetmap.org/export/embed.html?bbox=${lon - 0.08}%2C${lat - 0.05}%2C${lon + 0.08}%2C${lat + 0.05}&layer=mapnik&marker=${lat}%2C${lon}"></iframe>`;
  meta.classList.remove("hidden");
  meta.innerHTML = `<div class="badge">Latitude: ${lat.toFixed(4)}</div><div class="badge">Longitude: ${lon.toFixed(4)}</div>`;
}
function renderForecast(data) {
  const panel = byId("forecastPanel");
  if (!panel) return;
  if (!data.forecast || !data.forecast.length) {
    panel.innerHTML = '<div class="hint">Forecast unavailable for this station.</div>';
    return;
  }
  panel.innerHTML = data.forecast.map((item) => `<div class="forecast-card"><div class="kicker">${escapeHtml(item.day || "N/A")}</div><div class="headline" style="font-size:1.35rem">${item.avg ?? "--"}</div><div class="soft">Predicted PM2.5 average</div></div>`).join("");
}

function renderHealth(data) {
  const panel = byId("healthPanel");
  if (!panel) return;
  const health = data.health || { level: "", items: [] };
  panel.innerHTML = health.items.map((item) => `<div class="health-item"><strong>${escapeHtml(health.level)}:</strong> ${escapeHtml(item)}</div>`).join("");
}

function showLoading() {
  if (byId("pressureBoard")) byId("pressureBoard").innerHTML = skeletonPanel() + skeletonPanel();
  if (byId("forecastPanel")) byId("forecastPanel").innerHTML = skeletonPanel();
  if (byId("healthPanel")) byId("healthPanel").innerHTML = skeletonPanel();
  if (byId("pollutants")) byId("pollutants").innerHTML = skeletonPanel() + skeletonPanel();
  if (byId("mapWrap")) byId("mapWrap").innerHTML = '<div class="map-empty skeleton"></div>';
  if (byId("insight")) byId("insight").innerHTML = skeletonPanel();
  if (byId("pollutantChart")) byId("pollutantChart").innerHTML = "";
  if (byId("heroDominant")) byId("heroDominant").textContent = "Scanning...";
  if (byId("responseTitle")) byId("responseTitle").textContent = "Building response";
  if (byId("responseText")) byId("responseText").textContent = "Gathering live AQI signal and preparing quick actions.";
  if (byId("responseScore")) byId("responseScore").textContent = "..";
  if (byId("responseList")) byId("responseList").innerHTML = skeletonPanel();
}

function renderData(data) {
  byId("cityInput").value = data.city;
  byId("liveValue").textContent = Math.round(data.aqi);
  byId("liveValue").style.color = data.live_color;
  byId("liveChip").innerHTML = chipHtml(data.live_label, data.live_color);
  byId("liveText").textContent = "Current WAQI station reading";
  byId("liveBar").style.width = `${Math.min((data.aqi / 300) * 100, 100)}%`;
  byId("estimateValue").textContent = data.estimate.toFixed(2);
  byId("estimateValue").style.color = data.estimate_color;
  byId("estimateChip").innerHTML = chipHtml(data.estimate_label, data.estimate_color);
  byId("estimateText").textContent = `Difference vs live AQI: ${(data.estimate - data.aqi).toFixed(2)}`;
  byId("stationCity").textContent = data.city;
  byId("stationTime").textContent = `Updated: ${data.time}`;
  byId("stationDominant").textContent = `Dominant pollutant: ${data.dominant}`;
  byId("stationForecast").textContent = data.forecast.length ? `PM2.5 forecast: ${data.forecast.map((item) => `${item.day}: ${item.avg}`).join(" | ")}` : "PM2.5 forecast unavailable for this station.";
  const ribbon = byId("stationRibbon");
  ribbon.classList.remove("hidden");
  ribbon.innerHTML = `<div class="ribbon">Live AQI ${Math.round(data.aqi)}</div><div class="ribbon">Estimate ${data.estimate.toFixed(2)}</div><div class="ribbon">${escapeHtml(data.live_label)}</div>`;
  byId("pollutants").innerHTML = (data.meanings || []).map(pollutionMeaning).join("");
  const pollutantPairs = [["PM2.5", data.pm25], ["PM10", data.pm10], ["NO2", data.no2], ["SO2", data.so2], ["CO", data.co], ["O3", data.o3]].sort((a, b) => b[1] - a[1]);
  const response = buildResponseDeck(data);
  byId("heroDominant").textContent = `${data.dominant} lead`;
  byId("heroScope").textContent = data.forecast.length ? `${data.forecast.length}-day PM2.5 scan` : "Live station only";
  byId("responseTitle").textContent = response.title;
  byId("responseText").textContent = `Priority pollutant is ${pollutantPairs[0][0]} and the current air band is ${data.live_label.toLowerCase()}.`;
  byId("responseScore").textContent = response.score;
  byId("responseList").innerHTML = response.items.map((item) => `<div class="response-item">${escapeHtml(item)}</div>`).join("");
  byId("insight").innerHTML = `<strong>${escapeHtml(data.city)}</strong> is currently in the <strong>${escapeHtml(data.live_label.toLowerCase())}</strong> band with AQI <strong>${Math.round(data.aqi)}</strong>.<br><br>Highest pollutant right now: <strong>${pollutantPairs[0][0]}</strong> at <strong>${pollutantPairs[0][1].toFixed(2)}</strong>.<br><br>Estimate gap vs live AQI: <strong>${Math.abs(data.estimate - data.aqi).toFixed(2)}</strong>.`;
  renderPollutantChart(data);
  renderPressureBoard(data);
  renderForecast(data);
  renderHealth(data);
  renderMap(data);
}

async function loadCityDashboard(city) {
  showLoading();
  try {
    const response = await fetch(`/api/aqi?city=${encodeCity(city)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Request failed");
    renderData(data);
  } catch (error) {
    if (byId("insight")) byId("insight").textContent = error.message;
  } finally {
    if (byId("analyzeButton")) {
      byId("analyzeButton").disabled = false;
      byId("analyzeButton").textContent = "Open / Refresh City";
    }
  }
}

async function loadCompareBoard(cities) {
  const results = byId("compare-results");
  if (!results) return;
  results.innerHTML = '<div class="hint">Loading comparison...</div>';
  try {
    const response = await fetch(`/api/compare?cities=${encodeURIComponent(cities.join(","))}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Comparison failed");
    const ranked = payload.cities.sort((a, b) => b.aqi - a.aqi);
    results.innerHTML = ranked.map((item, index) => `<article class="compare-card"><div class="compare-rank">${index + 1}</div><h3>${escapeHtml(item.city)}</h3><div class="compare-meta">AQI ${Math.round(item.aqi)} | ${escapeHtml(item.live_label)}</div><div class="compare-meta">Dominant ${escapeHtml(item.dominant)} | Estimate ${item.estimate.toFixed(2)}</div><a class="compare-link" href="/city/${encodeCity(item.city)}">Open city page</a></article>`).join("");
  } catch (error) {
    results.innerHTML = `<div class="error-box">${escapeHtml(error.message)}</div>`;
  }
}
function navigateToCity(city) {
  const nextCity = city.trim();
  if (nextCity) window.location.href = `/city/${encodeCity(nextCity)}`;
}

function initHome() {
  const form = byId("city-search-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    navigateToCity(byId("city-search-input").value);
  });
  document.querySelectorAll(".quick-chip[data-city]").forEach((chip) => {
    chip.addEventListener("click", (event) => {
      event.preventDefault();
      navigateToCity(chip.dataset.city);
    });
  });
}

function initCityPage() {
  const dashboard = document.querySelector("[data-city-dashboard]");
  const currentCity = dashboard?.dataset.city;
  if (!currentCity) return;

  const analyzeButton = byId("analyzeButton");
  const input = byId("cityInput");

  loadCityDashboard(currentCity);
  clearInterval(refreshHandle);
  refreshHandle = setInterval(() => loadCityDashboard((byId("cityInput").value || currentCity)), 60000);

  analyzeButton?.addEventListener("click", () => {
    const nextCity = input.value.trim();
    if (!nextCity) return;
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Loading...";
    if (nextCity.toLowerCase() !== currentCity.toLowerCase()) {
      navigateToCity(nextCity);
      return;
    }
    loadCityDashboard(nextCity);
  });

  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      analyzeButton?.click();
    }
  });

  document.querySelectorAll(".quick-chip[data-city]").forEach((chip) => {
    chip.addEventListener("click", () => navigateToCity(chip.dataset.city));
  });
}

function initComparePage() {
  const board = document.querySelector("[data-compare-board]");
  const input = byId("compare-input");
  if (!board || !input) return;
  const initialCities = (board.dataset.cities || "").split(",").map((item) => item.trim()).filter(Boolean);
  loadCompareBoard(initialCities);
  byId("compare-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const cities = input.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 4);
    if (!cities.length) return;
    const query = encodeURIComponent(cities.join(","));
    window.history.replaceState({}, "", `/compare?cities=${query}`);
    board.dataset.cities = cities.join(",");
    loadCompareBoard(cities);
  });
  document.querySelectorAll("[data-compare-chip]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const city = chip.dataset.compareChip;
      const current = input.value.split(",").map((item) => item.trim()).filter(Boolean);
      if (!current.includes(city) && current.length < 4) {
        current.push(city);
        input.value = current.join(", ");
      }
    });
  });
}

if (bodyPage === "home") initHome();
if (bodyPage === "city") initCityPage();
if (bodyPage === "compare") initComparePage();
