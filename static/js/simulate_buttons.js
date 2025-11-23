// Кнопка Запустить
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

// Кнопки Пауза/Продолжить
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

// Кнопка завершить
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

// Кнопки ускорения анимации -/+ и множителя 
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