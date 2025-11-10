// Элементы
const pickPointBtn = document.getElementById("pickPointBtn");
const buildBtn = document.getElementById("buildBtn");
const clearBtn = document.getElementById("clearBtn");

// ===== Выбор точки =====
pickPointBtn.addEventListener("click", () => {
  pickMode = !pickMode;
  pickPointBtn.classList.toggle("active");
});

map.on("click", e => {
  if (!pickMode) return;
  const { lat, lng } = e.latlng;
  document.getElementById("start_lat").value = lat.toFixed(6);
  document.getElementById("start_lon").value = lng.toFixed(6);
  if (startMarker) map.removeLayer(startMarker);
  startMarker = L.marker([lat, lng]).addTo(map).bindPopup("Стартовая точка").openPopup();
  pickMode = false;
  pickPointBtn.classList.remove("active");
});

// ===== Очистка =====
clearBtn.addEventListener("click", () => {
  if (startMarker) map.removeLayer(startMarker);
  if (routeLine) map.removeLayer(routeLine);
  document.getElementById("start_lat").value = "";
  document.getElementById("start_lon").value = "";
  document.getElementById("node_count").value = 10;
});

// ===== Построение маршрута =====
buildBtn.addEventListener("click", async () => {
  const sLat = parseFloat(document.getElementById("start_lat").value);
  const sLon = parseFloat(document.getElementById("start_lon").value);
  const nodes = parseInt(document.getElementById("node_count").value);

  if (isNaN(sLat) || isNaN(sLon)) {
    alert("Укажите начальную точку.");
    return;
  }

  if (isNaN(nodes) || nodes < 2) {
    alert("Введите корректное число узлов.");
    return;
  }

  const resp = await fetch("/build_route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      start: [sLat, sLon],
      nodes: nodes
    })
  });

  const data = await resp.json();
  if (!data.route) {
    alert("Не удалось построить маршрут.");
    return;
  }

  // Удаляем старую линию
  if (routeLine) map.removeLayer(routeLine);
  const coords = data.route.map(pt => [pt[0], pt[1]]);
  routeLine = L.polyline(coords, { color: "blue", weight: 5 }).addTo(map);
  map.fitBounds(routeLine.getBounds());
});
