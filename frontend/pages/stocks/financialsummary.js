import React, { useEffect, useState } from 'react';
import styles from '../../styles/financialsummary.module.css';

const FinancialSummary = () => {
  const [data, setData] = useState({});
  const [stocksData, setStocksData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState('market_cap');
  const [order, setOrder] = useState('top');
  const [limit, setLimit] = useState(10);
  const [marketCapCategory, setMarketCapCategory] = useState('all'); // Add market cap category state

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:5001/api/stocks/financialsummary');

    socket.onopen = () => {
      console.log('WebSocket connection established');
      socket.send(JSON.stringify({ type: 'financialSummary', marketCapCategory })); // Send market cap category
    };

    socket.onmessage = (event) => {
      const receivedData = JSON.parse(event.data);
      console.log('Received data:', receivedData);
      setData(receivedData);
      setLoading(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      socket.close();
    };
  }, [marketCapCategory]); // Add marketCapCategory as a dependency

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/top/${metric}/${order}/${limit}?marketCapCategory=${marketCapCategory}`)
      .then((response) => response.json())
      .then((data) => setStocksData(data))
      .catch((error) => console.error('Error fetching stocks:', error));
  }, [metric, order, limit, marketCapCategory]);

  const formatNumber = (num) => {
    return num !== null ? num.toLocaleString('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }) : 'N/A';
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Financial Summary</h1>
      <div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Total Market Cap:</span>
          <span className={styles.value}>{formatNumber(data.totalMarketCap)} Cr</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Total Profit:</span>
          <span className={styles.value}>{formatNumber(data.totalProfit)} Cr</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Combined EPS:</span>
          <span className={styles.value}>{formatNumber(data.combinedEPS)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Total Debt:</span>
          <span className={styles.value}>{formatNumber(data.totalDebt)} Cr</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Total Revenue:</span>
          <span className={styles.value}>{formatNumber(data.totalRevenue)} Cr</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Average Profit per 1000 Cr Market Cap:</span>
          <span className={styles.value}>{formatNumber(data.avgProfitPerMcap)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Average Profit per 1000 Cr Revenue:</span>
          <span className={styles.value}>{formatNumber(data.avgProfitPerRevenue)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Average Debt per 1000 Cr Market Cap:</span>
          <span className={styles.value}>{formatNumber(data.avgDebtPerMcap)}</span>
        </div>
        <div className={styles.dataItem}>
          <span className={styles.label}>Average Debt per 1000 Cr Revenue:</span>
          <span className={styles.value}>{formatNumber(data.avgDebtPerRevenue)}</span>
        </div>
      </div>
      <h2 className={styles.header}>Top/Last N Stocks</h2>
      <div className={styles.controls}>
        <label>
          Market Cap Category:
          <select value={marketCapCategory} onChange={(e) => setMarketCapCategory(e.target.value)}>
            <option value="all">All</option>
            <option value="largecap">Large Cap</option>
            <option value="midcap">Mid Cap</option>
            <option value="smallcap">Small Cap</option>
            <option value="microcap">Micro Cap</option>
          </select>
        </label>
        <label>
          Metric:
          <select value={metric} onChange={(e) => setMetric(e.target.value)}>
            <option value="market_cap">Market Cap</option>
            <option value="eps">EPS</option>
            <option value="trailing_pe">PE</option>
            <option value="price_to_book">PB</option>
            <option value="gross_profit">Gross Profit</option>
            <option value="debt">Debt</option>
            <option value="revenue">Revenue</option>
          </select>
        </label>
        <label>
          Order:
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="top">Top</option>
            <option value="last">Last</option>
          </select>
        </label>
        <label>
          Limit:
          <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Stock Name</th>
            <th>Last Close Price</th>
            <th>Latest PE</th>
            <th>Latest PB</th>
            <th>Latest Market Cap</th>
            <th>Latest EPS</th>
            <th>Latest Gross Profit</th>
            <th>Latest Debt</th>
            <th>Latest Revenue</th>
          </tr>
        </thead>
        <tbody>
          {stocksData.map((stock, index) => (
            <tr key={index}>
              <td>{stock.stock_name}</td>
              <td>{formatNumber(stock.last_close_price)}</td>
              <td>{formatNumber(stock.latest_pe)}</td>
              <td>{formatNumber(stock.latest_pb)}</td>
              <td>{formatNumber(stock.latest_mcap)}</td>
              <td>{formatNumber(stock.latest_eps)}</td>
              <td>{formatNumber(stock.latest_gross_profit)}</td>
              <td>{formatNumber(stock.latest_debt)}</td>
              <td>{formatNumber(stock.latest_revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default FinancialSummary;
