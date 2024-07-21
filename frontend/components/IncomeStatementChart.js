import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-plugin-zoom';

ChartJS.register(
  BarElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

const IncomeStatementChart = ({ data }) => {
  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Total Revenue',
        data: data.map(d => d.data['Total Revenue']),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Net Income',
        data: data.map(d => d.data['Net Income']),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
      },
      {
        label: 'EBIT',
        data: data.map(d => d.data['EBIT']),
        backgroundColor: 'rgba(255, 159, 64, 0.6)',
      }
    ]
  };

  const options = {
    scales: {
      x: {
        type: 'category',
      },
      y: {
        beginAtZero: true,
      }
    },
    plugins: {
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true
          },
          mode: 'x',
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
};

export default IncomeStatementChart;
