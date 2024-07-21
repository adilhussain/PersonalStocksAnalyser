import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Accordion, Card } from 'react-bootstrap';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import "react-datepicker/dist/react-datepicker-cssmodules.css";
import styles from '../../styles/Stock.module.css';

const StockChart = dynamic(() => import('../../components/StockChart'), { ssr: false });
const DividendChart = dynamic(() => import('../../components/DividendChart'), { ssr: false });
const PEChart = dynamic(() => import('../../components/PEChart'), { ssr: false });
const IncomeStatementChart = dynamic(() => import('../../components/IncomeStatementChart'), { ssr: false });
const CashFlowChart = dynamic(() => import('../../components/CashFlowChart'), { ssr: false });
const BalanceSheetChart = dynamic(() => import('../../components/BalanceSheetChart'), { ssr: false });
const ConsolidatedFinancialChart = dynamic(() => import('../../components/ConsolidatedFinancialChart'), { ssr: false });

const Stock = ({ id }) => {
  const [data, setData] = useState([]);
  const [fundamentals, setFundamentals] = useState([]);
  const [financials, setFinancials] = useState([]);
  const [totalDividends, setTotalDividends] = useState(0);
  const [filteredData, setFilteredData] = useState([]);
  const [filteredFundamentals, setFilteredFundamentals] = useState([]);
  const [stockInfo, setStockInfo] = useState({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(new Date(new Date().setFullYear(new Date().getFullYear() - 1)));
  const [endDate, setEndDate] = useState(new Date());
  const [fundamentalsJson, setFundamentalsJson] = useState({});
  const [financialsJson, setFinancialsJson] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const stockInfoResult = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/${id}`);
        console.log('Stock Info:', stockInfoResult.data);

        const result = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/${id}/daily`);
        console.log('Daily Data:', result.data);
        setData(result.data);
        setFilteredData(result.data);

        const fundamentalsResult = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/${id}/fundamentals`);
        console.log('Fundamentals Data:', fundamentalsResult.data);
        setFundamentals(fundamentalsResult.data);
        setFilteredFundamentals(fundamentalsResult.data);
        setFundamentalsJson(fundamentalsResult.data);

        const financialsResult = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/${id}/financials`);
        console.log('Financials Data:', financialsResult.data);
        setFinancials(financialsResult.data);
        setFinancialsJson(financialsResult.data);

        // Calculate total dividends
        const totalDividends = result.data.reduce((acc, entry) => acc + (entry.dividends || 0), 0);
        setTotalDividends(totalDividends);

        // Extract necessary data for stock details
        const latestFundamentals = fundamentalsResult.data[0] || {};
        const latestFinancials = financialsResult.data[0] || {};
        const latestDaily = result.data[0] || {};

        const formatValue = (value) => (value / 10000000).toFixed(2); // Convert to Crores

        setStockInfo({
          ticker: stockInfoResult.data.ticker,
          currentPrice: latestDaily.close,
          lastClose: latestDaily.close,
          open: latestDaily.open,
          high: latestDaily.high,
          marketCap: formatValue(latestFundamentals.market_cap),
          pe: latestFundamentals.trailing_pe,
          pb: latestFundamentals.price_to_book
        });

        setLoading(false);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, [id]);

  useEffect(() => {
    const filtered = data.filter(
      (entry) => new Date(entry.date) >= startDate && new Date(entry.date) <= endDate
    );
    setFilteredData(filtered);

    const filteredFund = fundamentals.filter(
      (entry) => new Date(entry.date) >= startDate && new Date(entry.date) <= endDate
    );
    setFilteredFundamentals(filteredFund);
  }, [startDate, endDate, data, fundamentals]);

  const handleZoomIn = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setMonth(newStartDate.getMonth() + 1);
    setStartDate(newStartDate);
  };

  const handleZoomOut = () => {
    const newStartDate = new Date(startDate);
    newStartDate.setMonth(newStartDate.getMonth() - 1);
    setStartDate(newStartDate);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.header}>Stock Data for {stockInfo.ticker}</h1>
      <div className={styles.stockDetails}>
        <p>Current Price: {stockInfo.currentPrice}</p>
        <p>Last Close: {stockInfo.lastClose}</p>
        <p>Open: {stockInfo.open}</p>
        <p>High: {stockInfo.high}</p>
        <p>Market Cap: {stockInfo.marketCap} Cr</p>
        <p>PE: {stockInfo.pe}</p>
        <p>PB: {stockInfo.pb}</p>
      </div>
      <div className={styles.controls}>
        <DatePicker selected={startDate} onChange={date => setStartDate(date)} />
        <DatePicker selected={endDate} onChange={date => setEndDate(date)} />
        <button onClick={handleZoomIn}>Zoom In</button>
        <button onClick={handleZoomOut}>Zoom Out</button>
      </div>
      <Accordion defaultActiveKey="0" className={styles.accordion}>
        <Card>
          <Accordion.Item eventKey="0">
            <Accordion.Header>Stock Chart</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <StockChart data={filteredData} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="1">
            <Accordion.Header>Dividends (Total: {totalDividends.toFixed(2)})</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <DividendChart data={filteredData.filter(entry => entry.dividends > 0)} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="2">
            <Accordion.Header>PE Ratio</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <PEChart data={filteredFundamentals.map(f => ({ date: f.date, pe_ratio: f.trailing_pe }))} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="3">
            <Accordion.Header>Income Statement</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <IncomeStatementChart data={financials.filter(f => f.statement_type === 'income_statement')} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="4">
            <Accordion.Header>Cash Flow</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <CashFlowChart data={financials.filter(f => f.statement_type === 'cash_flow')} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="5">
            <Accordion.Header>Balance Sheet</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <BalanceSheetChart data={financials.filter(f => f.statement_type === 'balance_sheet')} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="6">
            <Accordion.Header>Consolidated Financials</Accordion.Header>
            <Accordion.Body>
              <div className={styles.chartContainer}>
                <ConsolidatedFinancialChart data={financials} />
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="7">
            <Accordion.Header>Fundamentals JSON Data</Accordion.Header>
            <Accordion.Body>
              <pre>{JSON.stringify(fundamentalsJson, null, 2)}</pre>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
        <Card>
          <Accordion.Item eventKey="8">
            <Accordion.Header>Financials JSON Data</Accordion.Header>
            <Accordion.Body>
              <pre>{JSON.stringify(financialsJson, null, 2)}</pre>
            </Accordion.Body>
          </Accordion.Item>
        </Card>
      </Accordion>
    </div>
  );
};

export const getServerSideProps = async (context) => {
  const { id } = context.params;
  return {
    props: {
      id,
    },
  };
};

export default Stock;
