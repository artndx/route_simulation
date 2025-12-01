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
let isCompleteControlledRoute = false;
let isCompleteOptionalRoute = false;
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
  if (playTimeoutOptional) { clearTimeout(playTimeoutOptional); playTimeoutOptional = null; }
  if (playTimeoutControlled) { clearTimeout(playTimeoutControlled); playTimeoutControlled = null; }
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
  document.getElementById('cur_elapsed').innerText = '00:00:00';

  document.getElementById('opt_speed').innerText = '0';
  document.getElementById('opt_distance').innerText = '0';
  document.getElementById('opt_fuel').innerText = '0';
  document.getElementById('opt_elapsed').innerText = '00:00:00';
  
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
    html: '<div style="background:#bd1818ff;width:20px;height:20px;border-radius:50%;border:2px solid #bd1818ff;"></div>',
    iconSize: [20, 20],
    className: '' // пустой, чтобы Leaflet не добавлял стандартный
  });

  carMarker = L.marker([state.latitude, state.longitude], { icon: carIcon }).addTo(map);
  ghostMarker = L.marker([state.latitude, state.longitude], { icon: ghostIcon }).addTo(map);
  traveledLine = L.polyline([[state.latitude, state.longitude]], { color: 'red', weight: 4 }).addTo(map);
  initCharts();

  async function animateOptimizedCar(i) {
    if (isFinish || i >= states.length) {
      isCompleteOptionalRoute = true;
      return;
    }
    if (isPaused) { playTimeoutOptional = setTimeout(() => animateOptimizedCar(i), 200); return; }

    optimized_state = states[i];

    ghostMarker.setLatLng([optimized_state.latitude, optimized_state.longitude]);
    traveledLine.addLatLng([optimized_state.latitude, optimized_state.longitude]);

    document.getElementById('opt_speed').innerText = kmh(optimized_state.speed_m_s);
    document.getElementById('opt_distance').innerText = (optimized_state.distance_km).toFixed(2);
    document.getElementById('opt_fuel').innerText = (optimized_state.fuel_l).toFixed(3);
    document.getElementById('opt_elapsed').innerText = formatElapsed(Math.round(optimized_state.time_s * 1000));

    if (i + 1 < states.length) {
      const wait_ms = Math.max(10, (time_step * 1000) / Math.max(0.01, speedMultiplier));
      playTimeoutOptional = setTimeout(() => animateOptimizedCar(i+1), wait_ms);
    }
  }

  async function animateControlledCar() {
    if (isFinish) {
      isCompleteControlledRoute = true;
      return;
    }
    if (isPaused) { playTimeoutOptional = setTimeout(() => animateControlledCar(), 200); return; }

    current_speed = 0.0;
    if(isOptimalSpeed){
      current_speed = parseFloat(document.getElementById('opt_speed').innerText) || 20;
    } else{
      current_speed = parseFloat(document.getElementById('cur_speed').value) || 20;
    }

    current_speed /= 3.6;

    current_state = null;
    try {
      const resp = await fetch('/drive_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_speed: current_speed })
      });
      if (!resp.ok) throw new Error('Ошибка сервера /drive_route');
      const data = await resp.json();
      current_state = data.state;
      if(current_state.is_finished){
        isCompleteControlledRoute = true;
      }
    } catch (err) {
      alert(err);
    }

    if(isCompleteControlledRoute)
    {
      current_speed = 0.0
    }

    carMarker.setLatLng([current_state.latitude, current_state.longitude]);

    document.getElementById('cur_speed').value = kmh(current_state.speed_m_s);
    document.getElementById('cur_distance').innerText = (current_state.distance_km).toFixed(2);
    document.getElementById('cur_fuel').innerText = (current_state.fuel_l).toFixed(3);
    document.getElementById('cur_elapsed').innerText = formatElapsed(Math.round(current_state.time_s * 1000));

    chartData.times.push(Math.floor(current_state.time_s));
    chartData.altitudes.push(current_state.altitude || 0);
    chartData.slopes.push(current_state.slope || 0);
    updateCharts();

    if (!isCompleteControlledRoute) {
        const wait_ms = Math.max(10, (time_step * 1000) / Math.max(0.01, speedMultiplier));
        playTimeoutOptional = setTimeout(() => animateControlledCar(), wait_ms);
    }
  }

  async function animateFuelRateDiff() {
    if (isCompleteControlledRoute || isCompleteOptionalRoute) {
      return;
    }
    if (isPaused) { playTimeout = setTimeout(() => animateFuelRateDiff(), 200); return; }

    const curFuel = parseFloat(document.getElementById('cur_fuel').innerText);
    const optFuel = parseFloat(document.getElementById('opt_fuel').innerText);

    const curDiffSpan = document.getElementById('cur_fuel_diff');
    const optDiffSpan = document.getElementById('opt_fuel_diff');

    if (curFuel > 0 && optFuel > 0) {
        const curFuelDiff = (curFuel - optFuel) / optFuel * 100; 
        const curFuelSign = curFuelDiff >= 0 ? "+" : "–";
        const curFuelDiffAbs = Math.abs(curFuelDiff).toFixed(1) + "%";
        if(curFuelSign == "+"){
          curDiffSpan.style.color = "red";
        } else {
          curDiffSpan.style.color = "green";
        }
        curDiffSpan.style.display = "inline";
        curDiffSpan.innerText = `${curFuelSign}${curFuelDiffAbs}`;

        const optFuelDiff = (optFuel - curFuel) / curFuel * 100; 
        const optFuelSign = optFuelDiff >= 0 ? "+" : "–";
        const optFuelDiffAbs = Math.abs(optFuelDiff).toFixed(1) + "%";
        optDiffSpan.innerText = `${optFuelSign}${optFuelDiffAbs}`;
        optDiffSpan.style.display = "inline";
        if(optFuelSign == "+"){
          optDiffSpan.style.color = "red";
        } else {
          optDiffSpan.style.color = "green";
        }
    } else {
        curDiffSpan.style.display = "none";
        optDiffSpan.style.display = "none";
    }

    if (!isCompleteControlledRoute && !isCompleteOptionalRoute) {
        const wait_ms = Math.max(10, (time_step * 1000) / Math.max(0.01, speedMultiplier));
        playTimeoutControlled = setTimeout(() => animateFuelRateDiff(), wait_ms);
    }
  }

  try{
    animateOptimizedCar(0);
    animateControlledCar();
    // animateFuelRateDiff();
  } catch(err){
    alert(err);
  }
}
