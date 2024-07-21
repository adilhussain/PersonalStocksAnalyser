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

const BalanceSheetChart = ({ data }) => {
  const chartData = {
    labels: data.map(d => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Total Assets',
        data: data.map(d => d.data['Total Assets']),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
      },
      {
        label: 'Total Liabilities',
        data: data.map(d => d.data['Total Liabilities']),
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
      },
      {
        label: 'Total Debt',
        data: data.map(d => d.data['Total Debt']),
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

export default BalanceSheetChart;
