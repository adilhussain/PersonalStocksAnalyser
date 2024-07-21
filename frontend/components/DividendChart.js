import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
);

const DividendChart = ({ data }) => {
  const chartData = {
    labels: data.map((entry) => entry.date),
    datasets: [
      {
        label: 'Dividends',
        data: data.map((entry) => entry.dividends),
        backgroundColor: 'rgba(75,192,192,1)',
      },
    ],
  };

  const options = {
    plugins: {
      legend: {
        labels: {
          color: '#000000',
        },
      },
      title: {
        display: true,
        text: 'Dividends Over Time',
        color: '#000000',
      },
      tooltip: {
        backgroundColor: '#ffffff',
        titleColor: '#000000',
        bodyColor: '#000000',
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'x',
        },
        zoom: {
          wheel: {
            enabled: true,
          },
          pinch: {
            enabled: true,
          },
          mode: 'x',
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#000000',
        },
      },
      y: {
        ticks: {
          color: '#000000',
        },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default DividendChart;
