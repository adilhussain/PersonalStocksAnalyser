import React, { useState } from 'react';
import styles from '../../styles/stockscreener.module.css';

const StockScreener = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [criteria, setCriteria] = useState([]);
  const [indicatorType, setIndicatorType] = useState('ma');
  const [period, setPeriod] = useState(20);
  const [value, setValue] = useState(60);

  const addCriterion = () => {
    setCriteria([...criteria, { type: indicatorType, period, value }]);
    setIndicatorType('ma');
    setPeriod(20);
    setValue(60);
  };

  const resetCriteria = () => {
    setCriteria([]);
    setData([]);
  };

  const fetchData = async () => {
    setLoading(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/screener`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ criteria }),
    });
    const result = await response.json();
    setData(result.data);
    setLoading(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Stock Screener</h1>
      <div className={styles.controls}>
        <label>
          Indicator Type:
          <select value={indicatorType} onChange={(e) => setIndicatorType(e.target.value)}>
            <option value="ma">Moving Average</option>
            <option value="rsi">RSI</option>
            <option value="momentum">Momentum</option>
            {/* Add more indicators as needed */}
          </select>
        </label>
        {indicatorType === 'ma' && (
          <label>
            Period:
            <input type="number" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
        )}
        {(indicatorType === 'rsi' || indicatorType === 'momentum') && (
          <label>
            Value:
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <button onClick={addCriterion}>Add Criterion</button>
      </div>
      <div className={styles.criteriaList}>
        <h3>Selected Criteria:</h3>
        <ul>
          {criteria.map((criterion, index) => (
            <li key={index}>
              {criterion.type.toUpperCase()} - {criterion.type === 'ma' ? `Period: ${criterion.period}` : `Value: ${criterion.value}`}
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.buttons}>
        <button onClick={fetchData}>OK</button>
        <button onClick={resetCriteria}>Reset</button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Market Cap</th>
              <th>20d MA</th>
              <th>50d MA</th>
              <th>100d MA</th>
              <th>200d MA</th>
              <th>Close</th>
              <th>RSI</th>
              <th>Momentum</th>
            </tr>
          </thead>
          <tbody>
            {data.map((stock, index) => (
              <tr key={index}>
                <td>{stock.ticker}</td>
                <td>{stock.market_cap?.toLocaleString('en-IN') || 'N/A'}</td>
                <td>{stock.ma_20d?.toFixed(2) || 'N/A'}</td>
                <td>{stock.ma_50d?.toFixed(2) || 'N/A'}</td>
                <td>{stock.ma_100d?.toFixed(2) || 'N/A'}</td>
                <td>{stock.ma_200d?.toFixed(2) || 'N/A'}</td>
                <td>{stock.close?.toFixed(2) || 'N/A'}</td>
                <td>{stock.rsi?.toFixed(2) || 'N/A'}</td>
                <td>{stock.momentum?.toFixed(2) || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default StockScreener;
