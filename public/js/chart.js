// chart.js

document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById('financialChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  const data = {
    labels: ['Revenue', 'Expenses', 'Burn Rate'],
    datasets: [{
      label: 'Financial Overview',
      data: [12000, 8000, 4000], // TEMP: Replace with dynamic values later
      backgroundColor: [
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 99, 132, 0.7)',
        'rgba(255, 206, 86, 0.7)'
      ],
      borderColor: [
        'rgba(54, 162, 235, 1)',
        'rgba(255, 99, 132, 1)',
        'rgba(255, 206, 86, 1)'
      ],
      borderWidth: 1
    }]
  };

  new Chart(ctx, {
    type: 'bar',
    data: data,
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: 'Burn Rate Breakdown'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
});
