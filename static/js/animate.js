let carMarker = null;
let traveledLine = null;
let animTimer = null;
let animIndex = 0;
let elapsedMs = 0;
let totalFuel = 0;
let totalDistance = 0;
let minSpeedMultiplier = 0.1;
let maxSpeedMultiplier = 200;
let speedMultiplier = 1.0;
let isPaused = false;
let isFinish = false;
let currentStepIndex = 0;

let baseSpeed = 15;                           // m/s baseline
let updateInterval = speedMultiplier / 0.02;  // ms

let chartData = {
  times: [],        // elapsed time in seconds
  altitudes: [],    // altitude at each time point
  slopes: []        // slope at each time point
};

function kmh(v) { return (v * 3.6).toFixed(1); }

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
  if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
  if (carMarker) { map.removeLayer(carMarker); carMarker = null; }
  if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
  
  animIndex = 0; elapsedMs = 0; totalFuel = 0; totalDistance = 0; isPaused = false; isFinish = false;
  currentStepIndex = 0;
  speedMultiplier = 1.0;
  
  document.getElementById('speed').innerText = '0';
  document.getElementById('elapsed').innerText = '00:00:00';
  document.getElementById('distance').innerText = '0';
  document.getElementById('fuel').innerText = '0';
  
  document.getElementById('animControls').style.display = 'none';
  document.getElementById('pauseBtn').style.display = 'inline-block';
  document.getElementById('resumeBtn').style.display = 'none';
  document.getElementById('speedMult').value = '1';
  
  chartData = { times: [], altitudes: [], slopes: [] };
}
// Play server-provided simulation states (array of {time_s, latitude, longitude, altitude, slope, speed_m_s, distance_km, fuel_l})
let simStates = null;
let playTimeout = null;

function playSimulation(states) {
  if (!states || states.length === 0) return;
  resetAnimation();
  simStates = states;

  document.getElementById("sidebar").style.display = 'inline-block';
  const p0 = states[0];
  carMarker = L.marker([p0.latitude, p0.longitude]).addTo(map);
  traveledLine = L.polyline([[p0.latitude, p0.longitude]], { color: 'red', weight: 4 }).addTo(map);
  initCharts();

  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'block';
  document.getElementById('animControls').style.display = 'block';

  // recursive stepper using server timestamps; playback speed controlled by speedMultiplier
  function step(i) {
    if (isFinish || i >= states.length) {
      return;
    }
    if (isPaused) { playTimeout = setTimeout(() => step(i), 200); return; }

    const s = states[i];
    carMarker.setLatLng([s.latitude, s.longitude]);
    traveledLine.addLatLng([s.latitude, s.longitude]);

    // Telemetry from server state (simulated time)
    document.getElementById('speed').innerText = kmh(s.speed_m_s);
    document.getElementById('elapsed').innerText = formatElapsed(Math.round(s.time_s * 1000));
    document.getElementById('distance').innerText = (s.distance_km).toFixed(2);
    document.getElementById('fuel').innerText = (s.fuel_l).toFixed(3);

    // Charts update (by simulated time)
    chartData.times.push(Math.floor(s.time_s));
    chartData.altitudes.push(s.altitude || 0);
    chartData.slopes.push(s.slope || 0);
    updateCharts();

    // schedule next frame according to simulated dt and playback multiplier
    if (i + 1 < states.length) {
      const dt_sec = states[i+1].time_s - s.time_s;
      const wait_ms = Math.max(10, (dt_sec * 1000) / Math.max(0.01, speedMultiplier));
      playTimeout = setTimeout(() => step(i+1), wait_ms);
    }
  }

  step(0);
}

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    if (!window.routePoints || window.routePoints.length === 0) {
      alert('Постройте маршрут прежде чем запускать');
      return;
    }
    // Request server-side simulation
    try {
      const resp = await fetch('/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: window.routePoints, dt: 0.05 })
      });
      if (!resp.ok) throw new Error('Ошибка сервера при симуляции');
      const data = await resp.json();
      const sim = data.sim || data;
      if (!sim || sim.length === 0) { alert('Симуляция вернула пустой ряд'); return; }
      playSimulation(sim);
    } catch (err) {
      console.error(err);
      alert('Не удалось получить симуляцию с сервера');
    }
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
const finishBtn = document.getElementById('finishBtn');
if (finishBtn) {
  finishBtn.addEventListener('click', () => {
    // Cancel all pending timeouts to stop playback immediately
    if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
    // Jump to last state and display it
    if (simStates && simStates.length > 0) {
      const lastState = simStates[simStates.length - 1];
      carMarker.setLatLng([lastState.latitude, lastState.longitude]);
      traveledLine.addLatLng([lastState.latitude, lastState.longitude]);
      document.getElementById('speed').innerText = kmh(lastState.speed_m_s);
      document.getElementById('elapsed').innerText = formatElapsed(Math.round(lastState.time_s * 1000));
      document.getElementById('distance').innerText = (lastState.distance_km).toFixed(2);
      document.getElementById('fuel').innerText = (lastState.fuel_l).toFixed(3);
      // Optionally update charts with all remaining data
      for (let j = currentStepIndex; j < simStates.length; j++) {
        const st = simStates[j];
        if (chartData.times.length === 0 || chartData.times[chartData.times.length - 1] !== Math.floor(st.time_s)) {
          chartData.times.push(Math.floor(st.time_s));
          chartData.altitudes.push(st.altitude || 0);
          chartData.slopes.push(st.slope || 0);
        }
      }
      updateCharts();
      // Mark as finished
      isFinish = true;
      // Optionally hide controls
      document.getElementById('finishBtn').style.display = 'none';
      document.getElementById('animControls').style.display = 'none';
    }
  });
}

const slowBtn = document.getElementById('slowBtn');
const fastBtn = document.getElementById('fastBtn');
const speedMultInput = document.getElementById('speedMult');

if (slowBtn) {
  slowBtn.addEventListener('click', () => {
    speedMultiplier = Math.max(minSpeedMultiplier, speedMultiplier - 0.5);
    speedMultInput.value = speedMultiplier.toFixed(1);
  });
}

if (fastBtn) {
  fastBtn.addEventListener('click', () => {
    speedMultiplier = Math.min(maxSpeedMultiplier, speedMultiplier + 0.5);
    speedMultInput.value = speedMultiplier.toFixed(1);
  });
}

if (speedMultInput) {
  speedMultInput.addEventListener('change', () => {
    const val = parseFloat(speedMultInput.value) || 1;
    speedMultiplier = Math.min(maxSpeedMultiplier, Math.max(minSpeedMultiplier, val));
    speedMultInput.value = speedMultiplier.toFixed(1);
  });
}