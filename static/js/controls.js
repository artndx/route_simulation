const pickStartBtn = document.getElementById("pickStartBtn");
const pickEndBtn = document.getElementById("pickEndBtn");

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
    document.getElementById("start_lat").value = latStr;
    document.getElementById("start_lon").value = lonStr;
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker([lat, lng]).addTo(map).bindPopup("Начало").openPopup();
  } else {
    document.getElementById("end_lat").value = latStr;
    document.getElementById("end_lon").value = lonStr;
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
  document.querySelectorAll("#start_lat, #start_lon, #end_lat, #end_lon")
    .forEach(inp => inp.value = "");
});

document.getElementById("buildBtn").addEventListener("click", async () => {
  const sLat = parseFloat(start_lat.value), sLon = parseFloat(start_lon.value);
  const eLat = parseFloat(end_lat.value), eLon = parseFloat(end_lon.value);
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
  const coords = data.route.map(pt => [pt[0], pt[1]]);
  routeLine = L.polyline(coords, { color: "blue", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds());
});