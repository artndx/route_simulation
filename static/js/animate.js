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
let isRouteComplete = false;  // Track if route is actually complete
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
  
  animIndex = 0; elapsedMs = 0; totalFuel = 0; totalDistance = 0; isPaused = false; isFinish = false; isRouteComplete = false;
  currentStepIndex = 0;
  speedMultiplier = 1.0;
  
  document.getElementById('speed').value = '20';
  document.getElementById('elapsed').innerText = '00:00:00';
  document.getElementById('distance').innerText = '0';
  document.getElementById('fuel').innerText = '0';
  document.getElementById('opt_speed').innerText = '0';
  document.getElementById('opt_distance').innerText = '0';
  document.getElementById('opt_fuel').innerText = '0';
  
  document.getElementById('animControls').style.display = 'none';
  document.getElementById('pauseBtn').style.display = 'inline-block';
  document.getElementById('resumeBtn').style.display = 'none';
  document.getElementById('speedMult').value = '1';
  
  chartData = { times: [], altitudes: [], slopes: [] };
}

// Play live simulation: each frame requests /update_state with current speed
let simRoute = null;
let playTimeout = null;
let frameIndex = 0;
let lastState = null;

function playLiveSimulation(route) {
  if (!route || route.length === 0) return;
  resetAnimation();
  simRoute = route;
  frameIndex = 0;
  lastState = null;

  document.getElementById("sidebar").style.display = 'inline-block';
  const p0 = route[0];
  carMarker = L.marker([p0.latitude, p0.longitude]).addTo(map);
  traveledLine = L.polyline([[p0.latitude, p0.longitude]], { color: 'red', weight: 4 }).addTo(map);
  initCharts();

  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'block';
  document.getElementById('animControls').style.display = 'block';

  // Frame-by-frame loop
  async function frame() {
    if (isFinish || isRouteComplete) return;
    if (isPaused) { playTimeout = setTimeout(frame, 50); return; }

    try {
      currentStepIndex = frameIndex;
      
      // Determine current speed (from user input in km/h, convert to m/s for physics)
      let speedKmh = parseFloat(document.getElementById('speed').value) || 20;
      let current_speed = speedKmh / 3.6;  // convert km/h to m/s
      
      // Update server state
      const dt = 0.05 / Math.max(0.01, speedMultiplier);  // time step scaled by playback speed
      const resp = await fetch('/update_state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_speed, dt })
      });
      
      if (!resp.ok) {
        console.error('Update state failed');
        return;
      }
      
      const state = await resp.json();
      lastState = state;
      
      // Update marker position
      carMarker.setLatLng([state.latitude, state.longitude]);
      traveledLine.addLatLng([state.latitude, state.longitude]);
      
      // Update telemetry
      document.getElementById('elapsed').innerText = formatElapsed(Math.round(state.elapsed_time * 1000));
      document.getElementById('distance').innerText = (state.distance_km).toFixed(2);
      document.getElementById('fuel').innerText = (state.fuel_l).toFixed(3);
      
      // Update optimal speed display (comparison)
      document.getElementById('opt_speed').innerText = kmh(state.optimal_speed);
      document.getElementById('opt_distance').innerText = (state.optimal_distance_km).toFixed(2);
      document.getElementById('opt_fuel').innerText = (state.optimal_fuel_l).toFixed(3);
      
      // Update charts (altitude and slope vs time)
      const timeInSec = Math.floor(state.elapsed_time);
      if (chartData.times.length === 0 || chartData.times[chartData.times.length - 1] !== timeInSec) {
        chartData.times.push(timeInSec);
        chartData.altitudes.push(state.altitude || 0);
        chartData.slopes.push(state.slope || 0);
        updateCharts();
      }
      
      // Check if route complete
      if (state.is_complete) {
        isRouteComplete = true;
        isFinish = true;
        document.getElementById('finishBtn').style.display = 'none';
        document.getElementById('animControls').style.display = 'none';
        return;
      }
      
      frameIndex++;
      
      // Schedule next frame (scaled by playback multiplier)
      const frame_delay = 50 / Math.max(0.01, speedMultiplier);
      playTimeout = setTimeout(frame, Math.max(10, frame_delay));
      
    } catch (err) {
      console.error('Frame error:', err);
      playTimeout = setTimeout(frame, 100);
    }
  }

  frame();
}

const startBtn = document.getElementById('startBtn');
if (startBtn) {
  startBtn.addEventListener('click', async () => {
    if (!window.routePoints || window.routePoints.length === 0) {
      alert('Постройте маршрут прежде чем запускать');
      return;
    }
    // Request server-side simulation initialization
    try {
      const resp = await fetch('/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ route: window.routePoints, dt: 0.05 })
      });
      if (!resp.ok) throw new Error('Ошибка сервера при симуляции');
      // Start live animation
      playLiveSimulation(window.routePoints);
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
  finishBtn.addEventListener('click', async () => {
    // Cancel animation loop
    if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
    isFinish = true;
    
    // Get current speed from input
    let speedKmh = parseFloat(document.getElementById('speed').value) || 20;
    let current_speed = speedKmh / 3.6;  // convert km/h to m/s
    
    try {
      // Call server to fast-forward to end
      const resp = await fetch('/finish_simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_speed })
      });
      
      if (!resp.ok) {
        console.error('Finish simulation failed');
        return;
      }
      
      const finalState = await resp.json();
      
      // Update marker to final position
      carMarker.setLatLng([finalState.latitude, finalState.longitude]);
      traveledLine.addLatLng([finalState.latitude, finalState.longitude]);
      
      // Update all telemetry with final values
      document.getElementById('elapsed').innerText = formatElapsed(Math.round(finalState.elapsed_time * 1000));
      document.getElementById('distance').innerText = (finalState.distance_km).toFixed(2);
      document.getElementById('fuel').innerText = (finalState.fuel_l).toFixed(3);
      
      // Update optimal metrics
      document.getElementById('opt_speed').innerText = kmh(finalState.optimal_speed);
      document.getElementById('opt_distance').innerText = (finalState.optimal_distance_km).toFixed(2);
      document.getElementById('opt_fuel').innerText = (finalState.optimal_fuel_l).toFixed(3);
      
      // Update charts with complete data
      if (finalState.chart_data) {
        chartData.times = finalState.chart_data.times;
        chartData.altitudes = finalState.chart_data.altitudes;
        chartData.slopes = finalState.chart_data.slopes;
        updateCharts();
      }
      
      isRouteComplete = true;
    } catch (err) {
      console.error('Error finishing simulation:', err);
    }
    
    // Hide controls
    document.getElementById('finishBtn').style.display = 'none';
    document.getElementById('animControls').style.display = 'none';
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

// Handle optimal speed sync checkbox
const useOptimalSpeedCheckbox = document.getElementById('useOptimalSpeed');
if (useOptimalSpeedCheckbox) {
  useOptimalSpeedCheckbox.addEventListener('change', () => {
    const speedInput = document.getElementById('speed');
    if (useOptimalSpeedCheckbox.checked) {
      // When checked, sync speed input to optimal speed display
      const optSpeedText = document.getElementById('opt_speed').innerText;
      const optSpeedValue = parseFloat(optSpeedText.split(' ')[0]) || 20;
      speedInput.value = optSpeedValue;
    }
    // When unchecked, allow manual input (no action needed)
  });
}