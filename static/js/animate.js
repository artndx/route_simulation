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

function kmh(v) { return (v * 3.6).toFixed(1); }

function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function resetAnimation() {
  if (animTimer) { clearInterval(animTimer); animTimer = null; }
  if (playTimeout) { clearTimeout(playTimeout); playTimeout = null; }
  if (carMarker) { map.removeLayer(carMarker); carMarker = null; }
  if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
  
  animIndex = 0; 
  elapsedMs = 0; 
  totalFuel = 0; 
  totalDistance = 0; 
  isPaused = false; 
  isFinish = false;
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

let simStates = null;
let playTimeout = null;

function playSimulation(states) {
  if (!states || states.length === 0) return;
  resetAnimation();
  document.getElementById('animControls').style.display = 'inline-block';
  document.getElementById("sidebar").style.display = 'inline-block';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'inline-block';
  simStates = states;

  const p0 = states[0];
  carMarker = L.marker([p0.latitude, p0.longitude]).addTo(map);
  traveledLine = L.polyline([[p0.latitude, p0.longitude]], { color: 'red', weight: 4 }).addTo(map);
  initCharts();

  function step(i) {
    if (isFinish || i >= states.length) {
      return;
    }
    if (isPaused) { playTimeout = setTimeout(() => step(i), 200); return; }

    const s = states[i];
    carMarker.setLatLng([s.latitude, s.longitude]);
    traveledLine.addLatLng([s.latitude, s.longitude]);

    document.getElementById('speed').innerText = kmh(s.speed_m_s);
    document.getElementById('elapsed').innerText = formatElapsed(Math.round(s.time_s * 1000));
    document.getElementById('distance').innerText = (s.distance_km).toFixed(2);
    document.getElementById('fuel').innerText = (s.fuel_l).toFixed(3);

    chartData.times.push(Math.floor(s.time_s));
    chartData.altitudes.push(s.altitude || 0);
    chartData.slopes.push(s.slope || 0);
    updateCharts();

    if (i + 1 < states.length) {
      const dt_sec = states[i+1].time_s - s.time_s;
      const wait_ms = Math.max(10, (dt_sec * 1000) / Math.max(0.01, speedMultiplier));
      playTimeout = setTimeout(() => step(i+1), wait_ms);
    }
  }

  step(0);
}
