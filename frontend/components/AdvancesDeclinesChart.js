import React, { useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale,
);

const AdvancesDeclinesChart = ({ data }) => {
  useEffect(() => {
    import('chartjs-plugin-zoom').then((module) => {
      ChartJS.register(module.default);
    });
  }, []);

  const chartData = {
    labels: data.map((entry) => entry.date),
    datasets: [
      {
        label: 'Advances',
        data: data.map((entry) => entry.advances),
        fill: false,
        borderColor: 'rgba(75,192,192,1)',
      },
      {
        label: 'Declines',
        data: data.map((entry) => entry.declines),
        fill: false,
        borderColor: 'rgba(192,75,75,1)',
      },
    ],
  };

  const options = {
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'day',
        },
        ticks: {
          color: '#000000',
        },
        grid: {
          color: '#e0e0e0',
        },
      },
      y: {
        ticks: {
          color: '#000000',
        },
        grid: {
          color: '#e0e0e0',
        },
      },
    },
    plugins: {
      legend: {
        labels: {
          color: '#000000',
        },
      },
      title: {
        display: true,
        text: 'Advances and Declines',
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
  };

  return <Line data={chartData} options={options} />;
};

export default AdvancesDeclinesChart;
