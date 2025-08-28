// js/chart.js

function renderChart(revenue, expenses, burn) {
  const ctx = document.getElementById('financialChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Revenue', 'Expenses', 'Burn'],
      datasets: [{
        label: 'Amount (USD)',
        data: [revenue, expenses, burn],
        backgroundColor: ['#2563eb', '#ef4444', '#f59e0b']
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `$${ctx.raw.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: value => '$' + value.toLocaleString()
          }
        }
      }
    }
  });
}
