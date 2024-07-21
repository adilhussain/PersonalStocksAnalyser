import React, { useState, useEffect } from 'react';
import axios from 'axios';

const TopNStocks = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [N, setN] = useState(10); // Default top 10
  const [metric, setMetric] = useState('marketCap'); // Default metric

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/financial-summary`);
        setData(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching financial summary:', error);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  const getTopNStocks = (metric) => {
    return [...data.fundamentalsData]
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, N);
  };

  const topStocks = getTopNStocks(metric);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Top {N} Stocks by {metric}</h1>
      <label>
        Number of Stocks:
        <input type="number" value={N} onChange={e => setN(Number(e.target.value))} />
      </label>
      <label>
        Metric:
        <select value={metric} onChange={e => setMetric(e.target.value)}>
          <option value="marketCap">Market Cap</option>
          <option value="trailing_pe">PE Ratio</option>
          <option value="price_to_book">PB Ratio</option>
          <option value="Gross Profit">Gross Profit</option>
          <option value="Total Revenue">Total Revenue</option>
          <option value="Total Debt">Total Debt</option>
        </select>
      </label>
      <ul>
        {topStocks.map(stock => (
          <li key={stock.stock_id}>
            {stock.ticker} - {metric}: {(stock[metric] / 10000000).toFixed(2)} Cr
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TopNStocks;
