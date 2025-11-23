let carMarker = null;
let ghostMarker = null;
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
let isComplete = false;
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
  if (ghostMarker) { map.removeLayer(ghostMarker); ghostMarker = null; }
  if (traveledLine) { map.removeLayer(traveledLine); traveledLine = null; }
  
  animIndex = 0; 
  elapsedMs = 0; 
  totalFuel = 0; 
  totalDistance = 0; 
  isPaused = false; 
  isFinish = false;
  currentStepIndex = 0;
  speedMultiplier = 1.0;
  
  document.getElementById('cur_speed').innerText = '0';
  document.getElementById('cur_distance').innerText = '0';
  document.getElementById('cur_fuel').innerText = '0';

  document.getElementById('opt_speed').innerText = '0';
  document.getElementById('opt_distance').innerText = '0';
  document.getElementById('opt_fuel').innerText = '0';

  document.getElementById('elapsed').innerText = '00:00:00';
  
  document.getElementById('animControls').style.display = 'none';
  document.getElementById('pauseBtn').style.display = 'inline-block';
  document.getElementById('resumeBtn').style.display = 'none';
  document.getElementById('speedMult').value = '1';
  
  chartData = { times: [], altitudes: [], slopes: [] };
}

function playSimulation(states) {
  if (!states || states.length === 0) return;
  resetAnimation();
  document.getElementById('animControls').style.display = 'inline-block';
  document.getElementById("sidebar").style.display = 'inline-block';
  document.getElementById('startBtn').style.display = 'none';
  document.getElementById('finishBtn').style.display = 'inline-block';

  const state = states[0];
  const carIcon = L.divIcon({
    html: '<div style="background:#29bd18ff;width:20px;height:20px;border-radius:50%;border:2px solid #29bd18ff;"></div>',
    iconSize: [20, 20],
    className: '' // пустой, чтобы Leaflet не добавлял стандартный
  });

  const ghostIcon = L.divIcon({
    html: '<div style="background:#a82020ff;width:20px;height:20px;border-radius:50%;border:2px solid #a82020ff;"></div>',
    iconSize: [20, 20],
    className: '' // пустой, чтобы Leaflet не добавлял стандартный
  });

  carMarker = L.marker([state.latitude, state.longitude], { icon: carIcon }).addTo(map);
  ghostMarker = L.marker([state.latitude, state.longitude],  { icon: ghostIcon }).addTo(map);
  traveledLine = L.polyline([[state.latitude, state.longitude]], { color: 'red', weight: 4 }).addTo(map);
  initCharts();

  async function step(i) {
    if (isFinish || i >= states.length) {
      return;
    }
    if (isPaused) { playTimeout = setTimeout(() => step(i), 200); return; }


    optimized_state = states[i];
    current_speed = 0.0;
    if(isOptimalSpeed){
      current_speed = parseFloat(document.getElementById('opt_speed').innerText) || 20;
    } else{
      current_speed = parseFloat(document.getElementById('cur_speed').value) || 20;
    }

    current_speed /= 3.6;

    current_state = null;
    if(!isComplete){
      try {
        const resp = await fetch('/drive_route', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_speed: current_speed })
        });
        if (!resp.ok) throw new Error('Ошибка сервера /drive_route');
        const data = await resp.json();
        current_state = data.state;
        if(current_state.is_finish){
          isComplete = true;
          current_speed = 0.0
        }
      } catch (err) {
        alert(err);
      }
    } else {
      current_speed = 0.0
    }

    carMarker.setLatLng([current_state.latitude, current_state.longitude]);

    ghostMarker.setLatLng([optimized_state.latitude, optimized_state.longitude]);
    traveledLine.addLatLng([optimized_state.latitude, optimized_state.longitude]);

    document.getElementById('cur_speed').value = kmh(current_state.speed_m_s);
    document.getElementById('cur_distance').innerText = (current_state.distance_km).toFixed(2);
    document.getElementById('cur_fuel').innerText = (current_state.fuel_l).toFixed(3);

    document.getElementById('opt_speed').innerText = kmh(optimized_state.speed_m_s);
    document.getElementById('opt_distance').innerText = (optimized_state.distance_km).toFixed(2);
    document.getElementById('opt_fuel').innerText = (optimized_state.fuel_l).toFixed(3);

    document.getElementById('elapsed').innerText = formatElapsed(Math.round(current_state.time_s * 1000));
    chartData.times.push(Math.floor(current_state.time_s));
    chartData.altitudes.push(current_state.altitude || 0);
    chartData.slopes.push(current_state.slope || 0);
    updateCharts();

    if (i + 1 < states.length) {
      const dt_sec = states[i+1].time_s - current_state.time_s;
      const wait_ms = Math.max(10, (dt_sec * 1000) / Math.max(0.01, speedMultiplier));
      playTimeout = setTimeout(() => step(i+1), wait_ms);
    }
  }

  step(0);
}
