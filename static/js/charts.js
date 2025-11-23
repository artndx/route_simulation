
// Time-based charts: X-axis = elapsed time (seconds), Y-axis = altitude/slope
let chartData = {
  times: [],        // elapsed time in seconds
  altitudes: [],    // altitude at each time point
  slopes: []        // slope at each time point
};

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