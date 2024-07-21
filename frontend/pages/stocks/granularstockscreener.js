import React, { useState } from 'react';
import styles from '../../styles/stockscreener.module.css';
import { useRouter } from 'next/router';
import { FaTimes } from 'react-icons/fa';

const GranularStockScreener = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [criteria, setCriteria] = useState([]);
  const [indicatorType, setIndicatorType] = useState('ma');
  const [operator, setOperator] = useState('greater_than');
  const [period, setPeriod] = useState(20);
  const [value, setValue] = useState(60);
  const router = useRouter();

  const handleAddCriterion = () => {
    const newCriterion = { type: indicatorType, operator, period, value };
    setCriteria([...criteria, newCriterion]);
  };

  const handleRemoveCriterion = (index) => {
    const newCriteria = criteria.filter((_, i) => i !== index);
    setCriteria(newCriteria);
  };

  const handleFetchData = async () => {
    setLoading(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/granular-screener`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria }),
    });
    const result = await response.json();
    setData(result.data);
    setLoading(false);
  };

  const selectedColumns = () => {
    const columns = new Set(['ticker', 'close']);
    criteria.forEach(criterion => {
      if (criterion.type === 'ma') columns.add(`ma_${criterion.period}d`);
      if (criterion.type === 'rsi') columns.add('rsi');
      if (criterion.type === 'momentum') columns.add('momentum');
    });
    return Array.from(columns);
  };

  const columnsToDisplay = selectedColumns();

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Granular Stock Screener</h1>
      <div className={styles.controls}>
        <label>
          Indicator Type:
          <select value={indicatorType} onChange={(e) => setIndicatorType(e.target.value)}>
            <option value="ma">Moving Average</option>
            <option value="rsi">RSI</option>
            <option value="momentum">Momentum</option>
          </select>
        </label>
        {indicatorType === 'ma' && (
          <label>
            Period:
            <input type="number" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </label>
        )}
        <label>
          Operator:
          <select value={operator} onChange={(e) => setOperator(e.target.value)}>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="equal_to">Equal To</option>
          </select>
        </label>
        {indicatorType !== 'ma' && (
          <label>
            Value:
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </label>
        )}
        <button onClick={handleAddCriterion}>Add Criterion</button>
      </div>
      <div className={styles.selectedCriteria}>
        <h2>Selected Criteria:</h2>
        <ul>
          {criteria.map((criterion, index) => (
            <li key={index}>
              {criterion.type.toUpperCase()} - Period: {criterion.period}, Operator: {criterion.operator.replace('_', ' ')}, Value: {criterion.value}
              <button onClick={() => handleRemoveCriterion(index)}><FaTimes /></button>
            </li>
          ))}
        </ul>
        <button onClick={handleFetchData}>OK</button>
        <button onClick={() => setCriteria([])}>Reset</button>
      </div>
      <div className={styles.resultCount}>
        <h2>Stocks Found: {data.length}</h2>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              {columnsToDisplay.map((column, index) => (
                <th key={index}>{column.replace(/_/g, ' ').toUpperCase()}</th>
              ))}
              <th>Market Cap</th>
              <th>Trailing P/E</th>
              <th>Price to Book</th>
            </tr>
          </thead>
          <tbody>
            {data.map((stock, index) => (
              <tr key={index} onClick={() => router.push(`/stocks/${stock.stock_id}`)} style={{ cursor: 'pointer' }}>
                {columnsToDisplay.includes('ticker') && <td>{stock.ticker}</td>}
                {columnsToDisplay.includes('close') && <td>{stock.close?.toFixed(2) || 'N/A'}</td>}
                {columnsToDisplay.map(column => {
                  if (column.startsWith('ma_')) {
                    return <td key={column}>{stock[column]?.toFixed(2) || 'N/A'}</td>;
                  }
                  return null;
                })}
                {columnsToDisplay.includes('rsi') && <td>{stock.rsi?.toFixed(2) || 'N/A'}</td>}
                {columnsToDisplay.includes('momentum') && <td>{stock.momentum?.toFixed(2) || 'N/A'}</td>}
                <td>{stock.market_cap?.toLocaleString('en-IN') || 'N/A'}</td>
                <td>{stock.trailing_pe?.toFixed(2) || 'N/A'}</td>
                <td>{stock.price_to_book?.toFixed(2) || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default GranularStockScreener;
