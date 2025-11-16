// animate.js
// Animate a car marker along a route with interactive controls.
// Graphs show altitude/slope vs elapsed time.
// Telemetry: speed, time, distance, fuel, optimal speed.

let carMarker = null;
let traveledLine = null;
let animTimer = null;
let animIndex = 0;
let elapsedMs = 0;
let totalFuel = 0;
let totalDistance = 0;
let speedMultiplier = 1.0;
let isPaused = false;

let baseSpeed = 15; // m/s baseline
let updateInterval = 200; // ms

// For time-based graphs
let chartData = {
  times: [],        // elapsed time in seconds
  altitudes: [],    // altitude at each time point
  slopes: []        // slope at each time point
};

function deg2rad(deg) { return deg * Math.PI / 180; }
function haversine_m(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function kmh(v) { return (v * 3.6).toFixed(1); }

// Simple fuel model: fuel consumption per second (liters/s) = baseFuel*(v/baseSpeed)^2 * (1 + slope*0.02)
// baseFuel tuned so that at baseSpeed fuel use ~0.001 L/s (approx 3.6 L/100km) - small scale to show numbers
function computeFuelRate(v, slopePercent) {
  const baseFuel = 0.0008; // L/s for baseSpeed
  const factor = Math.max(0.1, (v / baseSpeed));
  return baseFuel * factor * factor * (1 + (slopePercent * 0.02));
}

// Compute "optimal" speed for given slope: we'll use simple model: lower speed uphill, higher downhill up to limits
function computeOptimalSpeed(slopePercent) {
  // baseline 15 m/s (54 km/h). Each percent of slope reduces recommended speed by 1.2%.
  const v = baseSpeed * (1 - slopePercent * 0.012);
  const minV = 2; const maxV = 40;
  return Math.min(Math.max(v, minV), maxV);
}

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// Time-based charts: X-axis = elapsed time (seconds), Y-axis = altitude/slope
let altitudeChart = null, slopeChart = null;

function initCharts() {
  chartData = { times: [], altitudes: [], slopes: [] };
  
  const altCtx = document.getElementById('altitudeChart');
  const slopeCtx = document.getElementById('slopeChart');

  if (altitudeChart) altitudeChart.destroy();
  if (slopeChart) slopeChart.destroy();

  altitudeChart = new Chart(altCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Высота (м)',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Время (сек)' } },
        y: { title: { display: true, text: 'Высота (м)' } }
      }
    }
  });

  slopeChart = new Chart(slopeCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Уклон (%)',
        data: [],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        fill: false,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: { legend: { display: true } },
      scales: {
        x: { title: { display: true, text: 'Время (сек)' } },
        y: { title: { display: true, text: 'Уклон (%)' } }
      }
    }
  });
}

function updateCharts() {
  if (!altitudeChart || !slopeChart) return;

  const timeInSec = Math.floor(elapsedMs / 1000);
  
  altitudeChart.data.labels = chartData.times;
  altitudeChart.data.datasets[0].data = chartData.altitudes;
  altitudeChart.update('none');

  slopeChart.data.labels = chartData.times;
  slopeChart.data.datasets[0].data = chartData.slopes;
  slopeChart.update('none');
}

function resetAnimation() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  if (carMarker) { map.removeLayer(carMarker); carMarker = null; }
  if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
  
  animIndex = 0; elapsedMs = 0; totalFuel = 0; totalDistance = 0; isPaused = false;
  speedMultiplier = 1.0;
  
  document.getElementById('speed').innerText = '0';
  document.getElementById('elapsed').innerText = '00:00:00';
  document.getElementById('distance').innerText = '0';
  document.getElementById('fuel').innerText = '0';
  document.getElementById('opt_speed').innerText = '—';
  
  document.getElementById('animControls').style.display = 'none';
  document.getElementById('pauseBtn').style.display = 'inline-block';
  document.getElementById('resumeBtn').style.display = 'none';
  document.getElementById('speedMult').value = '1';
  
  chartData = { times: [], altitudes: [], slopes: [] };
}

function startAnimation(points) {
  if (!points || points.length < 2) return;
  resetAnimation();

  const p0 = points[0];
  carMarker = L.marker([p0.latitude, p0.longitude], {
    icon: L.icon({
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIGZpbGw9IiMxMjM0NTYiIHJ4PSI0Ii8+PHBvbHlnb24gcG9pbnRzPSIxNiw0IDE2LDI0IDE5LDI4IDEzLDI4IiBmaWxsPSIjRkZGIi8+PHBvbHlnb24gcG9pbnRzPSIxMiwxNiAxMiwyNCAxNywyNCAxNywxNiIgZmlsbD0iI0ZGRiIgb3BhY2l0eT0iMC43Ii8+PC9zdmc+',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    })
  }).addTo(map);

  traveledLine = L.polyline([[p0.latitude, p0.longitude]], { color: 'red', weight: 4 }).addTo(map);

  initCharts();

  // Precompute segment distances and cumulative times
  const segDist = [];
  const segTime = [];
  let cumTime = 0;
  
  for (let i = 1; i < points.length; i++) {
    const d = haversine_m(points[i-1].latitude, points[i-1].longitude, points[i].latitude, points[i].longitude);
    segDist.push(d);
    
    // Estimate time for this segment using its slope to compute speed
    const slopePercent = points[i].slope || 0;
    const optV = computeOptimalSpeed(slopePercent);
    const v = optV * 0.95;
    const segmentTime = d / Math.max(v, 1);
    segTime.push(segmentTime);
    cumTime += segmentTime;
  }

  let segOffset = 0;
  animIndex = 1;

  document.getElementById('animControls').style.display = 'block';

  animTimer = setInterval(() => {
    if (isPaused) return;

    if (animIndex >= points.length) {
      clearInterval(animTimer);
      animTimer = null;
      return;
    }

    const prev = points[animIndex - 1];
    const next = points[animIndex];
    const dist = segDist[animIndex - 1];

    if (dist === 0) { animIndex++; segOffset = 0; return; }

    const slopePercent = next.slope || 0;
    const optV = computeOptimalSpeed(slopePercent);
    const v = optV * 0.95;
    
    // Apply speed multiplier
    const actualV = v * speedMultiplier;
    const stepM = actualV * (updateInterval / 1000);
    
    segOffset += stepM;
    const frac = Math.min(1, segOffset / dist);
    
    const curLat = prev.latitude + (next.latitude - prev.latitude) * frac;
    const curLon = prev.longitude + (next.longitude - prev.longitude) * frac;
    
    carMarker.setLatLng([curLat, curLon]);
    traveledLine.addLatLng([curLat, curLon]);

    // Update telemetry
    elapsedMs += updateInterval * speedMultiplier;
    totalDistance += stepM / 1000; // convert m to km
    totalFuel += computeFuelRate(actualV, slopePercent) * (updateInterval / 1000);

    document.getElementById('speed').innerText = kmh(actualV);
    document.getElementById('elapsed').innerText = formatElapsed(elapsedMs);
    document.getElementById('distance').innerText = totalDistance.toFixed(2);
    document.getElementById('fuel').innerText = totalFuel.toFixed(3);
    document.getElementById('opt_speed').innerText = kmh(optV);

    // Update chart data every second
    const timeInSec = Math.floor(elapsedMs / 1000);
    if (chartData.times.length === 0 || chartData.times[chartData.times.length - 1] !== timeInSec) {
      chartData.times.push(timeInSec);
      chartData.altitudes.push(prev.altitude);
      chartData.slopes.push(slopePercent);
      updateCharts();
    }

    if (frac >= 1) { animIndex++; segOffset = 0; }

  }, updateInterval);
}

// Hook start button
window.addEventListener('load', () => {
  const startBtn = document.getElementById('startBtn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (!window.routePoints || window.routePoints.length === 0) {
        alert('Постройте маршрут прежде чем запускать');
        return;
      }
      startAnimation(window.routePoints);
    });
  }

  // Pause button
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  if (pauseBtn && resumeBtn) {
    pauseBtn.addEventListener('click', () => {
      isPaused = true;
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'inline-block';
    });
    
    resumeBtn.addEventListener('click', () => {
      isPaused = false;
      pauseBtn.style.display = 'inline-block';
      resumeBtn.style.display = 'none';
    });
  }

  // Speed control buttons
  const slowBtn = document.getElementById('slowBtn');
  const fastBtn = document.getElementById('fastBtn');
  const speedMultInput = document.getElementById('speedMult');

  if (slowBtn) {
    slowBtn.addEventListener('click', () => {
      speedMultiplier = Math.max(0.1, speedMultiplier - 0.5);
      speedMultInput.value = speedMultiplier.toFixed(1);
    });
  }

  if (fastBtn) {
    fastBtn.addEventListener('click', () => {
      speedMultiplier = Math.min(10, speedMultiplier + 0.5);
      speedMultInput.value = speedMultiplier.toFixed(1);
    });
  }

  if (speedMultInput) {
    speedMultInput.addEventListener('change', () => {
      const val = parseFloat(speedMultInput.value) || 1;
      speedMultiplier = Math.min(10, Math.max(0.1, val));
      speedMultInput.value = speedMultiplier.toFixed(1);
    });
  }
});
