import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Analysis = () => {
  const [data, setData] = useState([]);
  const [topN, setTopN] = useState(10);
  const [metric, setMetric] = useState('marketCap');
  const [aggregatedData, setAggregatedData] = useState({
    totalMarketCap: 0,
    totalProfit: {},
    combinedEPS: 0,
    combinedDebt: 0,
    totalRevenue: 0,
    avgProfitPerMCap: 0,
    avgProfitPerRevenue: 0,
    avgDebtPerMCap: 0,
    avgDebtPerRevenue: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/analysis`);
        setData(result.data);
        calculateAggregatedData(result.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  const calculateAggregatedData = (data) => {
    let totalMarketCap = 0;
    let combinedEPS = 0;
    let combinedDebt = 0;
    let totalRevenue = 0;
    const totalProfit = {};

    data.forEach(stock => {
      const latestFundamentals = stock.fundamentals[0] || {};
      const latestFinancials = stock.financials[0] || {};

      totalMarketCap += latestFundamentals.market_cap || 0;
      combinedEPS += latestFundamentals.eps || 0;
      combinedDebt += latestFinancials.debt || 0;
      totalRevenue += latestFinancials.revenue || 0;

      stock.financials.forEach(f => {
        const year = new Date(f.date).getFullYear();
        totalProfit[year] = (totalProfit[year] || 0) + (f.profit || 0);
      });
    });

    const avgProfitPerMCap = (Object.values(totalProfit).reduce((a, b) => a + b, 0) / totalMarketCap) * 1000;
    const avgProfitPerRevenue = (Object.values(totalProfit).reduce((a, b) => a + b, 0) / totalRevenue) * 1000;
    const avgDebtPerMCap = (combinedDebt / totalMarketCap) * 1000;
    const avgDebtPerRevenue = (combinedDebt / totalRevenue) * 1000;

    setAggregatedData({
      totalMarketCap,
      totalProfit,
      combinedEPS,
      combinedDebt,
      totalRevenue,
      avgProfitPerMCap,
      avgProfitPerRevenue,
      avgDebtPerMCap,
      avgDebtPerRevenue,
    });
  };

  const getTopNStocks = (metric) => {
    return data
      .map(stock => {
        const latestFundamentals = stock.fundamentals[0] || {};
        const latestFinancials = stock.financials[0] || {};

        return {
          id: stock.id,
          ticker: stock.ticker,
          marketCap: latestFundamentals.market_cap || 0,
          grossProfit: latestFinancials.gross_profit || 0,
          revenue: latestFinancials.revenue || 0,
          debt: latestFinancials.debt || 0,
        };
      })
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, topN);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Stock Analysis</h1>
      <div>
        <h2>Aggregated Data</h2>
        <p>Total Market Cap: {aggregatedData.totalMarketCap.toFixed(2)} Cr</p>
        <p>Total Profit (year wise): {JSON.stringify(aggregatedData.totalProfit, null, 2)}</p>
        <p>Combined EPS: {aggregatedData.combinedEPS.toFixed(2)}</p>
        <p>Combined Debt: {aggregatedData.combinedDebt.toFixed(2)} Cr</p>
        <p>Total Revenue: {aggregatedData.totalRevenue.toFixed(2)} Cr</p>
        <p>Average Profit per 1000 Cr Market Cap: {aggregatedData.avgProfitPerMCap.toFixed(2)}</p>
        <p>Average Profit per 1000 Cr Revenue: {aggregatedData.avgProfitPerRevenue.toFixed(2)}</p>
        <p>Average Debt per 1000 Cr Market Cap: {aggregatedData.avgDebtPerMCap.toFixed(2)}</p>
        <p>Average Debt per 1000 Cr Revenue: {aggregatedData.avgDebtPerRevenue.toFixed(2)}</p>
      </div>
      <div>
        <h2>Top N Stocks</h2>
        <label>
          Number of Stocks:
          <input type="number" value={topN} onChange={(e) => setTopN(e.target.value)} />
        </label>
        <label>
          Metric:
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="marketCap">Market Cap</option>
            <option value="grossProfit">Gross Profit</option>
            <option value="revenue">Revenue</option>
            <option value="debt">Debt</option>
          </select>
        </label>
        <ul>
          {getTopNStocks(metric).map(stock => (
            <li key={stock.id}>{stock.ticker} - {stock[metric]}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Analysis;
