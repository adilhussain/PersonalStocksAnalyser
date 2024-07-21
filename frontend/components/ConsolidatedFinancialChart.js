import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  LinearScale,
  Title,
  Tooltip,
  Legend,
  CategoryScale
} from 'chart.js';

ChartJS.register(
  BarElement,
  LinearScale,
  CategoryScale,
  Title,
  Tooltip,
  Legend
);

const ConsolidatedFinancialChart = ({ data }) => {
  // Sort data by date
  const sortedData = data.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Extract unique dates for the x-axis labels
  const labels = [...new Set(sortedData.map(d => new Date(d.date).toLocaleDateString()))];

  const totalRevenueData = labels.map(label => {
    const entry = sortedData.find(d => new Date(d.date).toLocaleDateString() === label);
    return entry ? entry.data['Total Revenue'] / 10000000 : 0;
  });

  const totalDebtData = labels.map(label => {
    const entry = sortedData.find(d => new Date(d.date).toLocaleDateString() === label && d.statement_type == 'balance_sheet');
    return entry ? entry.data['Total Debt'] / 10000000 : 0;
  });

  const grossProfitData = labels.map(label => {
    const entry = sortedData.find(d => new Date(d.date).toLocaleDateString() === label);
    return entry ? entry.data['Gross Profit'] / 10000000 : 0;
  });

  const basicEPSData = labels.map(label => {
    const entry = sortedData.find(d => new Date(d.date).toLocaleDateString() === label);
    return entry ? entry.data['Basic EPS'] : 0;
  });

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Total Revenue (Cr)',
        data: totalRevenueData,
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      },
      {
        label: 'Total Debt (Cr)',
        data: totalDebtData,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      },
      {
        label: 'Gross Profit (Cr)',
        data: grossProfitData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      },
      {
        label: 'Basic EPS',
        data: basicEPSData,
        backgroundColor: 'rgba(153, 102, 255, 0.6)',
        borderColor: 'rgba(153, 102, 255, 1)',
        borderWidth: 1
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Consolidated Financials',
      },
    },
    scales: {
      x: {
        type: 'category',
        labels: chartData.labels,
      },
      y: {
        beginAtZero: true,
      },
    },
  };

  return <Bar data={chartData} options={options} />;
};

export default ConsolidatedFinancialChart;
