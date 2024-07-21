import React, { useState } from 'react';
import styles from '../../styles/topnstocks.module.css';

const TopNStocks = () => {
  const [indicatorType, setIndicatorType] = useState('ma');
  const [operator, setOperator] = useState('greater_than');
  const [period, setPeriod] = useState(20);
  const [value, setValue] = useState(0);
  const [granularCriteria, setGranularCriteria] = useState([]);

  const [nValues, setNValues] = useState({
    revenue: 10,
    gross_profit: 10,
    debt: 10,
    free_cash_flow: 10,
    market_cap: 10,
    market_cap_revenue: 10,
    market_cap_grossprofit: 10,
    market_cap_debt: 10,
    current_assets: 10,
    total_tax_payable: 10,
    total_assets: 10,
    long_term_equity_investment: 10,
    last_close_price_eps: 10,
    revenue_cost_revenue: 10,
    repayment_of_debt: 10,
    total_debt_repayment_of_debt: 10
  });

  const [orderDirections, setOrderDirections] = useState({
    revenue: 'DESC',
    gross_profit: 'DESC',
    debt: 'DESC',
    free_cash_flow: 'DESC',
    market_cap: 'DESC',
    market_cap_revenue: 'DESC',
    market_cap_grossprofit: 'DESC',
    market_cap_debt: 'DESC',
    current_assets: 'DESC',
    total_tax_payable: 'DESC',
    total_assets: 'DESC',
    long_term_equity_investment: 'DESC',
    last_close_price_eps: 'DESC',
    revenue_cost_revenue: 'DESC',
    repayment_of_debt: 'DESC',
    total_debt_repayment_of_debt: 'DESC'
  });

  const [data, setData] = useState({
    revenue: [],
    gross_profit: [],
    debt: [],
    free_cash_flow: [],
    market_cap: [],
    market_cap_revenue: [],
    market_cap_grossprofit: [],
    market_cap_debt: [],
    current_assets: [],
    total_tax_payable: [],
    total_assets: [],
    long_term_equity_investment: [],
    last_close_price_eps: [],
    revenue_cost_revenue: [],
    repayment_of_debt: [],
    total_debt_repayment_of_debt: []
  });

  const [loading, setLoading] = useState({
    revenue: false,
    gross_profit: false,
    debt: false,
    free_cash_flow: false,
    market_cap: false,
    market_cap_revenue: false,
    market_cap_grossprofit: false,
    market_cap_debt: false,
    current_assets: false,
    total_tax_payable: false,
    total_assets: false,
    long_term_equity_investment: false,
    last_close_price_eps: false,
    revenue_cost_revenue: false,
    repayment_of_debt: false,
    total_debt_repayment_of_debt: false
  });

  const handleAddGranularCriterion = () => {
    const newCriterion = { type: indicatorType, operator, period, value };
    setGranularCriteria([...granularCriteria, newCriterion]);
  };

  const handleRemoveGranularCriterion = (index) => {
    const newCriteria = granularCriteria.filter((_, i) => i !== index);
    setGranularCriteria(newCriteria);
  };

  const fetchTopN = async (criteria) => {
    setLoading({ ...loading, [criteria]: true });
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/granularandtopn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria: granularCriteria, n: nValues[criteria], orderDirection: orderDirections[criteria], topNCriteria: criteria })
      });
      const result = await response.json();
      setData({ ...data, [criteria]: result });
    } catch (error) {
      console.error(`Error fetching top N ${criteria}:`, error);
    }
    setLoading({ ...loading, [criteria]: false });
  };

  const handleInputChange = (e, criteria) => {
    setNValues({ ...nValues, [criteria]: e.target.value });
  };

  const handleOrderChange = (e, criteria) => {
    setOrderDirections({ ...orderDirections, [criteria]: e.target.value });
  };

  const renderTable = (criteria) => (
    <div className={styles.tableContainer}>
      <div className={styles.tableHeader}>
        <h3>{criteria.replace(/_/g, ' ').toUpperCase()}</h3>
        <div className={styles.controls}>
          <input
            type="number"
            value={nValues[criteria]}
            onChange={(e) => handleInputChange(e, criteria)}
            className={styles.input}
            placeholder="N value"
          />
          <select
            value={orderDirections[criteria]}
            onChange={(e) => handleOrderChange(e, criteria)}
            className={styles.select}
          >
            <option value="DESC">DESC</option>
            <option value="ASC">ASC</option>
          </select>
          <button onClick={() => fetchTopN(criteria)} className={styles.button}>OK</button>
        </div>
      </div>
      {loading[criteria] ? (
        <div>Loading...</div>
      ) : (
        <div className={styles.scrollableTable}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {data[criteria].map((stock) => (
                <tr key={stock.stock_id}>
                  <td>
                    <a href={`/stocks/${stock.stock_id}`} className={styles.link}>{stock.ticker}</a>
                  </td>
                  <td>{stock.value ? stock.value.toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Top N Stocks</h1>
      <div className={styles.granularControls}>
        <label>
          Indicator Type:
          <select value={indicatorType} onChange={(e) => setIndicatorType(e.target.value)} className={styles.select}>
            <option value="ma">Moving Average</option>
            <option value="rsi">RSI</option>
            <option value="momentum">Momentum</option>
          </select>
        </label>
        {indicatorType === 'ma' && (
          <label>
            Period:
            <input type="number" value={period} onChange={(e) => setPeriod(e.target.value)} className={styles.input} />
          </label>
        )}
        <label>
          Operator:
          <select value={operator} onChange={(e) => setOperator(e.target.value)} className={styles.select}>
            <option value="greater_than">Greater Than</option>
            <option value="less_than">Less Than</option>
            <option value="equal_to">Equal To</option>
          </select>
        </label>
        {indicatorType !== 'ma' && (
          <label>
            Value:
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className={styles.input} />
          </label>
        )}
        <button onClick={handleAddGranularCriterion} className={styles.button}>Add Criterion</button>
      </div>
      <div className={styles.selectedCriteria}>
        <h2>Selected Granular Criteria:</h2>
        <ul>
          {granularCriteria.map((criterion, index) => (
            <li key={index}>
              {criterion.type.toUpperCase()} - Period: {criterion.period}, Operator: {criterion.operator.replace('_', ' ')}, Value: {criterion.value}
              <button onClick={() => handleRemoveGranularCriterion(index)} className={styles.removeButton}>X</button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles.tablesContainer}>
        {Object.keys(nValues).map((criteria) => (
          <div key={criteria} className={styles.tableWrapper}>
            {renderTable(criteria)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopNStocks;
