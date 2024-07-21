import React, { useState } from 'react';
import styles from '../../styles/combinedgranularandtopn.module.css';
import { useRouter } from 'next/router';

const CombinedGranularAndTopN = () => {
  const [indicatorType, setIndicatorType] = useState('ma');
  const [operator, setOperator] = useState('greater_than');
  const [period, setPeriod] = useState(20);
  const [value, setValue] = useState(0);
  const [granularCriteria, setGranularCriteria] = useState([]);
  const [topNCriteria, setTopNCriteria] = useState('revenue');
  const [n, setN] = useState(10);
  const [orderDirection, setOrderDirection] = useState('DESC');
  const [granularData, setGranularData] = useState([]);
  const [topNData, setTopNData] = useState([]);
  const [loadingGranular, setLoadingGranular] = useState(false);
  const [loadingTopN, setLoadingTopN] = useState(false);

  const handleAddGranularCriterion = () => {
    const newCriterion = { type: indicatorType, operator, period, value };
    setGranularCriteria([...granularCriteria, newCriterion]);
  };

  const handleRemoveGranularCriterion = (index) => {
    const newCriteria = granularCriteria.filter((_, i) => i !== index);
    setGranularCriteria(newCriteria);
  };

  const handleFetchGranularData = async () => {
    setLoadingGranular(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/granularandtopn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria: granularCriteria, n, orderDirection, topNCriteria }),
    });
    const result = await response.json();
    setGranularData(result.data);
    setLoadingGranular(false);
  };

  const handleFetchTopNData = async () => {
    setLoadingTopN(true);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/granularandtopn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria: granularCriteria, n, orderDirection, topNCriteria }),
    });
    const result = await response.json();
    setTopNData(result.data);
    setLoadingTopN(false);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Combined Granular and Top N Stock Screener</h1>
      <div className={styles.granularControls}>
        {/* Granular Criteria Controls */}
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
        <button onClick={handleAddGranularCriterion}>Add Criterion</button>
      </div>
      <div className={styles.selectedCriteria}>
        <h2>Selected Granular Criteria:</h2>
        <ul>
          {granularCriteria.map((criterion, index) => (
            <li key={index}>
              {criterion.type.toUpperCase()} - Period: {criterion.period}, Operator: {criterion.operator.replace('_', ' ')}, Value: {criterion.value}
              <button onClick={() => handleRemoveGranularCriterion(index)}>X</button>
            </li>
          ))}
        </ul>
        <button onClick={handleFetchGranularData}>Fetch Granular Data</button>
      </div>
      <div className={styles.topNControls}>
        <h2>Top N Criteria</h2>
        <label>
          Criteria:
          <select value={topNCriteria} onChange={(e) => setTopNCriteria(e.target.value)}>
            <option value="revenue">Revenue</option>
            <option value="gross_profit">Gross Profit</option>
            {/* Add other criteria options */}
          </select>
        </label>
        <label>
          N:
          <input type="number" value={n} onChange={(e) => setN(e.target.value)} />
        </label>
        <label>
          Order Direction:
          <select value={orderDirection} onChange={(e) => setOrderDirection(e.target.value)}>
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
        </label>
        <button onClick={handleFetchTopNData}>Fetch Top N Data</button>
      </div>
      <div className={styles.resultContainer}>
        <div className={styles.granularResult}>
          <h2>Granular Data</h2>
          {loadingGranular ? <div>Loading...</div> : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Close</th>
                  <th>Market Cap</th>
                  <th>Trailing P/E</th>
                  <th>Price to Book</th>
                </tr>
              </thead>
              <tbody>
                {granularData.map((stock, index) => (
                  <tr key={index}>
                    <td>{stock.ticker}</td>
                    <td>{stock.close?.toFixed(2) || 'N/A'}</td>
                    <td>{stock.market_cap?.toLocaleString('en-IN') || 'N/A'}</td>
                    <td>{stock.trailing_pe?.toFixed(2) || 'N/A'}</td>
                    <td>{stock.price_to_book?.toFixed(2) || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className={styles.topNResult}>
          <h2>Top N Data</h2>
          {loadingTopN ? <div>Loading...</div> : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {topNData.map((stock, index) => (
                  <tr key={index}>
                    <td>{stock.ticker}</td>
                    <td>{stock.value?.toLocaleString('en-IN') || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default CombinedGranularAndTopN;
