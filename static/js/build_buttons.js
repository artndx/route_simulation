const pickStartBtn = document.getElementById("pickStartBtn");
const pickEndBtn = document.getElementById("pickEndBtn");
var routePoints = [];

function deactivatePickMode() {
  pickMode = null;
  pickStartBtn.classList.remove("active");
  pickEndBtn.classList.remove("active");
}

pickStartBtn.addEventListener("click", () => {
  pickMode = pickMode === "start" ? null : "start";
  pickStartBtn.classList.toggle("active");
  pickEndBtn.classList.remove("active");
});

pickEndBtn.addEventListener("click", () => {
  pickMode = pickMode === "end" ? null : "end";
  pickEndBtn.classList.toggle("active");
  pickStartBtn.classList.remove("active");
});

map.on("click", e => {
  if (!pickMode) return;
  const { lat, lng } = e.latlng;
  const latStr = lat.toFixed(6), lonStr = lng.toFixed(6);
  if (pickMode === "start") {
    document.getElementById("startPnt").value = latStr + ', '+ lonStr;
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker([lat, lng]).addTo(map).bindPopup("Начало").openPopup();
  } else {
    document.getElementById("endPnt").value = latStr + ', '+ lonStr;
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker([lat, lng]).addTo(map).bindPopup("Конец").openPopup();
  }
  deactivatePickMode();
});

// Кнопки построения и очистки
document.getElementById("clearBtn").addEventListener("click", () => {
  if (startMarker) map.removeLayer(startMarker);
  if (endMarker) map.removeLayer(endMarker);
  if (routeLine) map.removeLayer(routeLine);
  routePoints = [];
  const startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.style.display = 'none';
  document.querySelectorAll("#startPnt, #endPnt")
    .forEach(inp => inp.value = "");
    resetAnimation();
    document.getElementById("sidebar").style.display = 'none';
});

document.getElementById("buildBtn").addEventListener("click", async () => {
  const sPnt = document.getElementById("startPnt").value.split(",");         
  const sLat = parseFloat(sPnt[0]);     
  const sLon = parseFloat(sPnt[1]);    

  const ePnt = document.getElementById("endPnt").value.split(",");         
  const eLat = parseFloat(ePnt[0]);     
  const eLon = parseFloat(ePnt[1]); 

  if (isNaN(sLat) || isNaN(sLon) || isNaN(eLat) || isNaN(eLon)) {
    alert("Укажите координаты начала и конца маршрута.");
    return;
  }
  const resp = await fetch("/build_route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start: [sLat, sLon], end: [eLat, eLon] })
  });
  const data = await resp.json();
  if (routeLine) map.removeLayer(routeLine);
  // Ожидаем объект {latitude, longitude, altitude, slope}
  routePoints = data.route;
  const coords = routePoints.map(pt => [pt.latitude, pt.longitude]);
  routeLine = L.polyline(coords, { color: "blue", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds());
  const startBtn = document.getElementById("startBtn");
  if (startBtn) startBtn.style.display = "inline-block";
});