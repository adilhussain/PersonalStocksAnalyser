const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');
const redis = require('redis');
const http = require('http');
const WebSocket = require('ws');
const { promisify } = require('util');

const app = express();
app.use(bodyParser.json());
app.use(cors());

const pool = new Pool({
  user: process.env.DB_USER,
  host: 'postgres',
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: '5432',
});

// Redis Client Initialization
// const redisClient = redis.createClient({
//   url: process.env.REDIS_URL,
// });

// redisClient.on('error', (err) => {
//   console.error('Redis client error', err);
// });

// redisClient.on('connect', () => {
//   console.log('Redis client connected');
// });

// redisClient.connect().catch(console.error);

// Function to fetch data in batches and calculate aggregates incrementally
const fetchFinancialDataInBatches = async (stockIds, batchSize = 50) => {
  console.log("fetchFinancialDataInBatches");
  let totalMarketCap = 0;
  let totalProfit = 0;
  let totalRevenue = 0;
  let combinedEPS = 0;
  let totalDebt = 0;
  let numEPS = 0; // To calculate average EPS later

  for (let i = 0; i < stockIds.length; i += batchSize) {
    console.log("doing for batch, ", i / batchSize);
    const batchIds = stockIds.slice(i, i + batchSize);

    const { rows } = await pool.query(`
        SELECT stock_id, date, statement_type, data
        FROM Financials
        WHERE stock_id = ANY($1::int[])
      `, [batchIds]);
    let batchData = rows;

    // Incrementally calculate aggregates
    let batchTotalMarketCap = 0;
    let batchTotalProfit = 0;
    let batchTotalRevenue = 0;
    let batchCombinedEPS = 0;
    let batchTotalDebt = 0;
    let batchNumEPS = 0;

    batchData.forEach(item => {
      if (item.statement_type === 'income_statement') {
        batchTotalProfit += item.data['Net Income'] || 0;
        batchTotalRevenue += item.data['Total Revenue'] || 0;
        batchCombinedEPS += item.data['Basic EPS'] || 0;
        batchNumEPS++;
      } else if (item.statement_type === 'balance_sheet') {
        batchTotalDebt += item.data['Total Debt'] || 0;
      }
    });

    totalMarketCap += batchTotalMarketCap;
    totalProfit += batchTotalProfit;
    totalRevenue += batchTotalRevenue;
    combinedEPS += batchCombinedEPS;
    totalDebt += batchTotalDebt;
    numEPS += batchNumEPS;

    console.log("local batch data ", i, " - ")
    console.log({
      totalMarketCap,
      totalProfit,
      totalRevenue,
      combinedEPS,
      totalDebt,
      numEPS,
    })
  }

  const data = {
    totalMarketCap,
    totalProfit,
    totalRevenue,
    combinedEPS,
    totalDebt,
    numEPS,
  };
  console.log("dd", data)
  return data;
};

const handleFinancialSummary2 = async (ws, marketCapCategory) => {
  try {
    console.log("starting");

    // Add market cap category filter
    let marketCapCondition0 = '';
    switch (marketCapCategory) {
      case 'largecap':
        marketCapCondition0 = 'where market_cap >= 200000000000';
        break;
      case 'midcap':
        marketCapCondition0 = 'where market_cap >= 50000000000 AND market_cap < 200000000000';
        break;
      case 'smallcap':
        marketCapCondition0 = 'where market_cap >= 10000000000 AND market_cap < 50000000000';
        break;
      case 'microcap':
        marketCapCondition0 = 'where market_cap < 10000000000';
        break;
      default:
        marketCapCondition0 = '';
    }

    const { rows: stocks } = await pool.query(`
      SELECT s.id, s.ticker
      FROM Stock s
      JOIN Fundamentals f ON s.id = f.stock_id
      ${marketCapCondition0}
      GROUP BY s.id, s.ticker
      HAVING MAX(f.date) = (SELECT MAX(date) FROM Fundamentals WHERE stock_id = s.id)
    `);
    const stockIds = stocks.map(stock => stock.id);
    console.log("got stocks");

    // Add market cap category filter
    let marketCapCondition = '';
    switch (marketCapCategory) {
      case 'largecap':
        marketCapCondition = 'AND market_cap >= 200000000000';
        break;
      case 'midcap':
        marketCapCondition = 'AND market_cap >= 50000000000 AND market_cap < 200000000000';
        break;
      case 'smallcap':
        marketCapCondition = 'AND market_cap >= 10000000000 AND market_cap < 50000000000';
        break;
      case 'microcap':
        marketCapCondition = 'AND market_cap < 10000000000';
        break;
      default:
        marketCapCondition = '';
    }

    // Fetch financial data in batches and calculate aggregates incrementally
    const {
      totalMarketCap,
      totalProfit,
      totalRevenue,
      combinedEPS,
      totalDebt,
      numEPS,
    } = await fetchFinancialDataInBatches(stockIds);

    console.log("fetching fundamental")

    const fundamentalsDataResult = await pool.query(`
  WITH ranked_fundamentals AS (
    SELECT 
      stock_id, 
      date, 
      market_cap, 
      trailing_pe, 
      price_to_book,
      ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) AS rnk
    FROM Fundamentals
    WHERE stock_id = ANY($1::int[]) ${marketCapCondition}
  )
  SELECT 
    stock_id, 
    date, 
    market_cap, 
    trailing_pe, 
    price_to_book
  FROM ranked_fundamentals
  WHERE rnk = 1
`, [stockIds]);
    const fundamentalsData = fundamentalsDataResult.rows;

    console.log("GOT fundamental")
    console.log("TORA ", fundamentalsData[0])
    // Calculate remaining aggregates
    const totalMarketCapFromFundamentals = fundamentalsData.reduce((sum, item) => sum + (item.market_cap / 10000000 || 0), 0);
    const avgProfitPerMcap = totalProfit / (totalMarketCapFromFundamentals / 1000);
    const avgProfitPerRevenue = totalProfit / (totalRevenue / 1000);
    const avgDebtPerMcap = totalDebt / (totalMarketCapFromFundamentals / 1000);
    const avgDebtPerRevenue = totalDebt / (totalRevenue / 1000);

    const responseData = {
      totalMarketCap: totalMarketCapFromFundamentals,
      totalProfit: totalProfit / 10000000,
      combinedEPS: combinedEPS, // Average EPS
      totalDebt: totalDebt / 10000000,
      totalRevenue: totalRevenue / 10000000,
      avgProfitPerMcap: avgProfitPerMcap / 10000000,
      avgProfitPerRevenue: avgProfitPerRevenue / 10000000,
      avgDebtPerMcap: avgDebtPerMcap / 10000000,
      avgDebtPerRevenue: avgDebtPerRevenue / 10000000,
    };
    console.log(responseData);
    ws.send(JSON.stringify(responseData));
  } catch (error) {
    console.log("financial summary 2 error ", error);
    ws.send(JSON.stringify({ error: 'Server error' }));
  }
}
// Create HTTP server
const server = http.createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });

// WebSocket message handler
wss.on('connection', (ws) => {
  console.log("WS conn");
  ws.on('message', async (message) => {
    console.log("WWW: ", message);
    try {
      const parsedMessage = JSON.parse(message);
      const marketCapCategory = parsedMessage.marketCapCategory || 'all';

      switch (parsedMessage.type) {
        case 'financialSummary':
          console.log("crunching numbers for financialsummary");
          await handleFinancialSummary2(ws, marketCapCategory);
          break;
        // Add other message types here
        default:
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ error: 'Error handling message' }));
    }
  });
});

// Start the server
const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Express endpoint to get the stock data
app.get('/api/stocks', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, ticker FROM Stock');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Error fetching stocks' });
  }
});

app.post('/api/stocks/screener', async (req, res) => {
  const { criteria } = req.body;

  try {
    // Fetch all relevant data from your database
    const result = await pool.query(`
      WITH recent_stock_data AS (
        SELECT 
          sd.stock_id,
          sd.date,
          sd.close,
          sd.open,
          sd.high,
          sd.low,
          sd.volume,
          sd.dividends,
          sd.stock_splits,
          ROW_NUMBER() OVER (PARTITION BY sd.stock_id ORDER BY sd.date DESC) AS rnk
        FROM StockData sd
        WHERE sd.date >= (CURRENT_DATE - INTERVAL '200 days')
      ),
      latest_stock_data AS (
        SELECT * FROM recent_stock_data WHERE rnk = 1
      ),
      latest_fundamentals AS (
        SELECT DISTINCT ON (f.stock_id) 
          f.stock_id,
          f.market_cap,
          f.trailing_pe,
          f.price_to_book,
          f.date
        FROM Fundamentals f
        ORDER BY f.stock_id, f.date DESC
      ),
      moving_averages AS (
        SELECT 
          lsd.stock_id,
          s.ticker,
          lf.market_cap,
          (SELECT AVG(sd.close) 
           FROM StockData sd 
           WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '20 days')) AS ma_20d,
          (SELECT AVG(sd.close) 
           FROM StockData sd 
           WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '50 days')) AS ma_50d,
          (SELECT AVG(sd.close) 
           FROM StockData sd 
           WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '100 days')) AS ma_100d,
          (SELECT AVG(sd.close) 
           FROM StockData sd 
           WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '200 days')) AS ma_200d,
          lsd.close,
          (SELECT 100 - (100 / (1 + AVG(gain) / NULLIF(AVG(loss), 0))) 
           FROM (SELECT 
                        sd.close, 
                        LAG(sd.close) OVER (ORDER BY sd.date) AS prev_close, 
                        GREATEST(sd.close - LAG(sd.close) OVER (ORDER BY sd.date), 0) AS gain, 
                        GREATEST(LAG(sd.close) OVER (ORDER BY sd.date) - sd.close, 0) AS loss 
                 FROM StockData sd 
                 WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '14 days')) subquery) AS rsi,
          (lsd.close - LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC)) / NULLIF(LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC), 0) * 100 AS momentum
        FROM latest_stock_data lsd
        JOIN Stock s ON lsd.stock_id = s.id
        JOIN latest_fundamentals lf ON lsd.stock_id = lf.stock_id
      )
      SELECT 
        stock_id, 
        ticker, 
        market_cap, 
        ma_20d, 
        ma_50d, 
        ma_100d, 
        ma_200d,
        close,
        rsi,
        momentum
      FROM moving_averages
      ORDER BY ticker;
    `);

    const allStockData = result.rows;

    // Process data based on criteria
    const filteredData = allStockData.filter((stock) => {
      return criteria.every((criterion) => {
        if (criterion.type === 'ma') {
          const ma = stock[`ma_${criterion.period}d`];
          return ma && stock.close < ma;
        }
        if (criterion.type === 'rsi') {
          const rsi = stock.rsi;
          return rsi && rsi < criterion.value;
        }
        if (criterion.type === 'momentum') {
          const momentum = stock.momentum;
          return momentum && momentum > criterion.value;
        }
        return false;
      });
    });

    res.json({ data: filteredData });
  } catch (error) {
    console.error('Error fetching screener data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/stocks/granular-screener', async (req, res) => {
  const { criteria } = req.body;

  try {
    const requestedMovingAverages = criteria.filter(c => c.type === 'ma').map(c => c.period);
    const hasRSI = criteria.some(c => c.type === 'rsi');
    const hasMomentum = criteria.some(c => c.type === 'momentum');

    const maColumns = requestedMovingAverages.map(period => `
      (SELECT AVG(sd.close) 
       FROM StockData sd 
       WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '${period} days')) AS ma_${period}d
    `).join(',');

    const query = `
      WITH recent_stock_data AS (
        SELECT 
          sd.stock_id,
          sd.date,
          sd.close,
          sd.open,
          sd.high,
          sd.low,
          sd.volume,
          sd.dividends,
          sd.stock_splits,
          ROW_NUMBER() OVER (PARTITION BY sd.stock_id ORDER BY sd.date DESC) AS rnk
        FROM StockData sd
        WHERE sd.date >= (CURRENT_DATE - INTERVAL '200 days')
      ),
      latest_stock_data AS (
        SELECT * FROM recent_stock_data WHERE rnk = 1
      )
      SELECT 
        lsd.stock_id,
        s.ticker,
        ${maColumns ? maColumns + ',' : ''}
        lsd.close
        ${hasRSI ? `, (SELECT 100 - (100 / (1 + AVG(gain) / NULLIF(AVG(loss), 0))) 
          FROM (SELECT 
                  sd.close, 
                  LAG(sd.close) OVER (ORDER BY sd.date) AS prev_close, 
                  GREATEST(sd.close - LAG(sd.close) OVER (ORDER BY sd.date), 0) AS gain, 
                  GREATEST(LAG(sd.close) OVER (ORDER BY sd.date) - sd.close, 0) AS loss 
                FROM StockData sd 
                WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '14 days')) subquery) AS rsi` : ''}
        ${hasMomentum ? `, (lsd.close - LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC)) / NULLIF(LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC), 0) * 100 AS momentum` : ''}
      FROM latest_stock_data lsd
      JOIN Stock s ON lsd.stock_id = s.id
    `;

    const result = await pool.query(query);
    const allStockData = result.rows;

    const filteredData = allStockData.filter(stock => {
      return criteria.every(criterion => {
        if (criterion.type === 'ma') {
          const ma = stock[`ma_${criterion.period}d`];
          return ma && evaluateOperator(stock.close, ma, criterion.operator);
        }
        if (criterion.type === 'rsi') {
          const rsi = stock.rsi;
          return rsi && evaluateOperator(rsi, criterion.value, criterion.operator);
        }
        if (criterion.type === 'momentum') {
          const momentum = stock.momentum;
          return momentum && evaluateOperator(momentum, criterion.value, criterion.operator);
        }
        return false;
      });
    });

    const filteredStockIds = filteredData.map(stock => stock.stock_id);

    const fundamentalsQuery = `
      SELECT DISTINCT ON (f.stock_id) 
        f.stock_id,
        f.market_cap,
        f.trailing_pe,
        f.price_to_book,
        f.date
      FROM Fundamentals f
      WHERE f.stock_id = ANY($1::int[])
      ORDER BY f.stock_id, f.date DESC
    `;
    const fundamentalsResult = await pool.query(fundamentalsQuery, [filteredStockIds]);
    const fundamentalsData = fundamentalsResult.rows;

    const finalData = filteredData.map(stock => {
      const fundamentals = fundamentalsData.find(f => f.stock_id === stock.stock_id);
      return { ...stock, ...fundamentals };
    });

    res.json({ data: finalData });
  } catch (error) {
    console.error('Error fetching granular screener data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const evaluateOperator = (a, b, operator) => {
  if (operator === 'greater_than') return a > b;
  if (operator === 'less_than') return a < b;
  if (operator === 'equal_to') return a === b;
  return false;
};


app.get('/api/stocks/top/:metric/:order/:limit', async (req, res) => {
  const { metric, order, limit } = req.params;
  const { marketCapCategory } = req.query; // Get the market cap category from query params
  const validMetrics = ['market_cap', 'eps', 'trailing_pe', 'price_to_book', 'gross_profit', 'debt', 'revenue'];
  const validOrders = ['top', 'last'];
  const validCategories = ['all', 'largecap', 'midcap', 'smallcap', 'microcap'];

  if (!validMetrics.includes(metric) || !validOrders.includes(order) || isNaN(limit) || !validCategories.includes(marketCapCategory)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }

  const sortOrder = order === 'top' ? 'DESC' : 'ASC';

  let metricQueryPart = '';
  if (metric === 'market_cap' || metric === 'trailing_pe' || metric === 'price_to_book') {
    metricQueryPart = `lf.${metric}`;
  } else {
    if (metric == 'debt')
      metricQueryPart = `fin.data->>'Total Debt'`;
    if (metric == 'gross_profit')
      metricQueryPart = `fin.data->>'Gross Profit'`;
    if (metric == 'revenue')
      metricQueryPart = `fin.data->>'Total Revenue'`;
    if (metric == 'eps')
      metricQueryPart = `fin.data->>'Basic EPS'`;
  }

  // Add market cap category filter
  let marketCapCondition = '';
  switch (marketCapCategory) {
    case 'largecap':
      marketCapCondition = 'AND lf.market_cap >= 200000000000';
      break;
    case 'midcap':
      marketCapCondition = 'AND lf.market_cap >= 50000000000 AND lf.market_cap < 200000000000';
      break;
    case 'smallcap':
      marketCapCondition = 'AND lf.market_cap >= 10000000000 AND lf.market_cap < 50000000000';
      break;
    case 'microcap':
      marketCapCondition = 'AND lf.market_cap < 10000000000';
      break;
    default:
      marketCapCondition = '';
  }

  try {
    const query = `
      WITH latest_stock_data AS (
        SELECT 
          stock_id,
          close AS last_close_price,
          ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) AS rnk
        FROM StockData
      ),
      latest_fundamentals AS (
        SELECT 
          stock_id,
          market_cap,
          trailing_pe,
          price_to_book,
          ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) AS rnk
        FROM Fundamentals
        WHERE market_cap IS NOT NULL AND market_cap > 0
      ),
      latest_financials AS (
        SELECT 
          stock_id,
          statement_type,
          data,
          ROW_NUMBER() OVER (PARTITION BY stock_id, statement_type ORDER BY date DESC) AS rnk
        FROM Financials
      ),
      ranked_stocks AS (
        SELECT 
          lf.stock_id,
          s.ticker AS stock_name,
          lsd.last_close_price,
          lf.market_cap,
          lf.trailing_pe AS pe,
          lf.price_to_book AS pb,
          (fin.data->>'Basic EPS')::numeric AS eps,
          (fin.data->>'Gross Profit')::numeric AS gross_profit,
          (fin.data->>'Total Debt')::numeric AS debt,
          (fin.data->>'Total Revenue')::numeric AS revenue,
          ROW_NUMBER() OVER (ORDER BY ${metricQueryPart} ${sortOrder}) AS rnk
        FROM latest_fundamentals lf
        JOIN Stock s ON lf.stock_id = s.id
        JOIN latest_stock_data lsd ON lf.stock_id = lsd.stock_id AND lsd.rnk = 1
        LEFT JOIN latest_financials fin ON lf.stock_id = fin.stock_id AND fin.rnk = 1
        WHERE lf.rnk = 1 AND (fin.statement_type = 'income_statement' OR fin.statement_type IS NULL)
        ${marketCapCondition}
      )
      SELECT 
        stock_name,
        last_close_price,
        pe AS latest_pe,
        pb AS latest_pb,
        market_cap AS latest_mcap,
        eps AS latest_eps,
        gross_profit AS latest_gross_profit,
        debt AS latest_debt,
        revenue AS latest_revenue
      FROM ranked_stocks
      WHERE rnk <= $1;
    `;
    const result = await pool.query(query, [parseInt(limit)]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching stocks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// moving average filtered by market cap

// WITH filtered_stocks AS(
//   SELECT 
//         f.stock_id,
//   f.market_cap
//     FROM
//         Fundamentals f
//     WHERE
//         f.market_cap > 100000000000  -- 10,000 crores in the smallest currency unit
// ),
//   recent_stock_data AS(
//     SELECT 
//         sd.stock_id,
//     stk.ticker,
//     sd.date,
//     sd.close,
//     ROW_NUMBER() OVER(PARTITION BY sd.stock_id ORDER BY sd.date DESC) AS rnk
//     FROM 
//         StockData sd
// 	join stock stk on sd.stock_id = stk.id
//     WHERE 
//         sd.stock_id IN(SELECT stock_id FROM filtered_stocks)
//   )
// --SELECT
// --COUNT(DISTINCT rsd.stock_id) AS stock_count
// Select rsd.stock_id, rsd.ticker, rsd.close, ma.moving_average_200
// FROM 
//     recent_stock_data rsd
// JOIN
//   (
//     SELECT 
//             stock_id,
//     AVG(close) AS moving_average_200
//         FROM 
//             StockData
//         WHERE 
//             date >= (CURRENT_DATE - INTERVAL '200 days')
//         GROUP BY
// stock_id
//     ) ma ON rsd.stock_id = ma.stock_id
// WHERE
// rsd.rnk = 1 AND-- Ensures only the most recent closing price is considered
// rsd.close < ma.moving_average_200;

// percentiles
// WITH latest_fundamentals AS(
//   SELECT 
//         stock_id,
//   trailing_pe,
//   date,
//   ROW_NUMBER() OVER(PARTITION BY stock_id ORDER BY date DESC) AS rn
//     FROM 
//         Fundamentals
//     WHERE 
//         trailing_pe IS NOT NULL
// ),
//   RecentDates AS(
//     SELECT DISTINCT date
//     FROM latest_fundamentals
//     ORDER BY date DESC
//     LIMIT 10
//   ),
//     percentiles AS(
//       SELECT 
//         date,
//       PERCENTILE_CONT(0.10) WITHIN GROUP(ORDER BY trailing_pe) AS p10,
//       PERCENTILE_CONT(0.20) WITHIN GROUP(ORDER BY trailing_pe) AS p20,
//       PERCENTILE_CONT(0.30) WITHIN GROUP(ORDER BY trailing_pe) AS p30,
//       PERCENTILE_CONT(0.40) WITHIN GROUP(ORDER BY trailing_pe) AS p40,
//       PERCENTILE_CONT(0.50) WITHIN GROUP(ORDER BY trailing_pe) AS p50,
//       PERCENTILE_CONT(0.60) WITHIN GROUP(ORDER BY trailing_pe) AS p60,
//       PERCENTILE_CONT(0.70) WITHIN GROUP(ORDER BY trailing_pe) AS p70,
//       PERCENTILE_CONT(0.75) WITHIN GROUP(ORDER BY trailing_pe) AS p75,
//       PERCENTILE_CONT(0.80) WITHIN GROUP(ORDER BY trailing_pe) AS p80,
//       PERCENTILE_CONT(0.95) WITHIN GROUP(ORDER BY trailing_pe) AS p95,
//       PERCENTILE_CONT(0.99) WITHIN GROUP(ORDER BY trailing_pe) AS p99
//     FROM 
//         latest_fundamentals
//     WHERE
//         date IN(SELECT date FROM RecentDates)
//     GROUP BY 
//         date
//     ),
//       counts AS(
//         SELECT
//         lf.date,
//         COUNT(*) AS total_stocks,
//         SUM(CASE WHEN lf.trailing_pe <= p.p10 THEN 1 ELSE 0 END) AS count_p10,
//         SUM(CASE WHEN lf.trailing_pe <= p.p20 THEN 1 ELSE 0 END) AS count_p20,
//         SUM(CASE WHEN lf.trailing_pe <= p.p30 THEN 1 ELSE 0 END) AS count_p30,
//         SUM(CASE WHEN lf.trailing_pe <= p.p40 THEN 1 ELSE 0 END) AS count_p40,
//         SUM(CASE WHEN lf.trailing_pe <= p.p50 THEN 1 ELSE 0 END) AS count_p50,
//         SUM(CASE WHEN lf.trailing_pe <= p.p60 THEN 1 ELSE 0 END) AS count_p60,
//         SUM(CASE WHEN lf.trailing_pe <= p.p70 THEN 1 ELSE 0 END) AS count_p70,
//         SUM(CASE WHEN lf.trailing_pe <= p.p75 THEN 1 ELSE 0 END) AS count_p75,
//         SUM(CASE WHEN lf.trailing_pe <= p.p80 THEN 1 ELSE 0 END) AS count_p80,
//         SUM(CASE WHEN lf.trailing_pe <= p.p95 THEN 1 ELSE 0 END) AS count_p95,
//         SUM(CASE WHEN lf.trailing_pe <= p.p99 THEN 1 ELSE 0 END) AS count_p99
//     FROM
//         latest_fundamentals lf
//     JOIN
//         percentiles p ON lf.date = p.date
//     WHERE
//         lf.date IN(SELECT date FROM RecentDates)
//     GROUP BY
//         lf.date, p.p10, p.p20, p.p30, p.p40, p.p50, p.p60, p.p70, p.p75, p.p80, p.p95, p.p99
//       )
// SELECT
// p.date,
//   p.p10,
//   p.p20,
//   p.p30,
//   p.p40,
//   p.p50,
//   p.p60,
//   p.p70,
//   p.p75,
//   p.p80,
//   p.p95,
//   p.p99,
//   c.total_stocks,
//   c.count_p10,
//   c.count_p20,
//   c.count_p30,
//   c.count_p40,
//   c.count_p50,
//   c.count_p60,
//   c.count_p70,
//   c.count_p75,
//   c.count_p80,
//   c.count_p95,
//   c.count_p99
// FROM 
//     percentiles p
// JOIN
//     counts c ON p.date = c.date
// ORDER BY
// p.date DESC;


app.post('/api/stocks/top-n-individual', async (req, res) => {
  const { criteria, n, orderDirection = 'DESC' } = req.body;

  const queries = {
    revenue: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Revenue')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Revenue')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    gross_profit: `
      SELECT f.stock_id, s.ticker, (f.data->>'Gross Profit')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Gross Profit')::NUMERIC IS NOT NULL
      AND (f.data->>'Gross Profit')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    debt: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Debt')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    free_cash_flow: `
      SELECT f.stock_id, s.ticker, (f.data->>'Free Cash Flow')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'cash_flow'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'cash_flow')
      AND (f.data->>'Free Cash Flow')::NUMERIC IS NOT NULL
      AND (f.data->>'Free Cash Flow')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    market_cap: `
      SELECT f.stock_id, s.ticker, lf.market_cap AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    market_cap_revenue: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Total Revenue')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Revenue')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    market_cap_grossprofit: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Gross Profit')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Gross Profit')::NUMERIC IS NOT NULL
      AND (f.data->>'Gross Profit')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    market_cap_debt: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Total Debt')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    current_assets: `
      SELECT f.stock_id, s.ticker, (f.data->>'Current Assets')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Current Assets')::NUMERIC IS NOT NULL
      AND (f.data->>'Current Assets')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    total_tax_payable: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Tax Payable')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Tax Payable')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Tax Payable')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    total_assets: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Assets')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Assets')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Assets')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    long_term_equity_investment: `
      SELECT f.stock_id, s.ticker, (f.data->>'Long Term Equity Investment')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Long Term Equity Investment')::NUMERIC IS NOT NULL
      AND (f.data->>'Long Term Equity Investment')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    last_close_price_eps: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Basic EPS')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Basic EPS')::NUMERIC IS NOT NULL
      AND (f.data->>'Basic EPS')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    revenue_cost_revenue: `
      SELECT f.stock_id, s.ticker, ((f.data->>'Total Revenue')::NUMERIC / NULLIF((f.data->>'Cost Of Revenue')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Revenue')::NUMERIC != 0
      AND (f.data->>'Cost Of Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Cost Of Revenue')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    repayment_of_debt: `
      SELECT f.stock_id, s.ticker, (f.data->>'Repayment Of Debt')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'cash_flow'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'cash_flow')
      AND (f.data->>'Repayment Of Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Repayment Of Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`,
    total_debt_repayment_of_debt: `
      SELECT f.stock_id, s.ticker, ((f.data->>'Total Debt')::NUMERIC / NULLIF((f.data->>'Repayment Of Debt')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      AND (f.data->>'Repayment Of Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Repayment Of Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $1`
  };

  try {
    const { rows } = await pool.query(queries[criteria], [n]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching top N stocks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/stocks/granularandtopn', async (req, res) => {
  const { criteria: granularCriteria, n, orderDirection = 'DESC', topNCriteria } = req.body;

  const granularQueryParts = granularCriteria.map((criterion, index) => {
    if (criterion.type === 'ma') {
      return `(SELECT AVG(sd.close) 
               FROM StockData sd 
               WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '${criterion.period} days')) AS ma_${criterion.period}d`;
    }
    if (criterion.type === 'rsi') {
      return `(SELECT 100 - (100 / (1 + AVG(gain) / NULLIF(AVG(loss), 0))) 
               FROM (SELECT 
                       sd.close, 
                       LAG(sd.close) OVER (ORDER BY sd.date) AS prev_close, 
                       GREATEST(sd.close - LAG(sd.close) OVER (ORDER BY sd.date), 0) AS gain, 
                       GREATEST(LAG(sd.close) OVER (ORDER BY sd.date) - sd.close, 0) AS loss 
                     FROM StockData sd 
                     WHERE sd.stock_id = lsd.stock_id AND sd.date >= (CURRENT_DATE - INTERVAL '14 days')) subquery) AS rsi`;
    }
    if (criterion.type === 'momentum') {
      return `(lsd.close - LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC)) / NULLIF(LAG(lsd.close) OVER (PARTITION BY lsd.stock_id ORDER BY lsd.date DESC), 0) * 100 AS momentum`;
    }
    return '';
  }).filter(part => part !== '').join(',');

  const evaluateOperator = (a, b, operator) => {
    if (operator === 'greater_than') return a > b;
    if (operator === 'less_than') return a < b;
    if (operator === 'equal_to') return a === b;
    return false;
  };

  try {
    const recentStockDataQuery = `
      WITH recent_stock_data AS (
        SELECT 
          sd.stock_id,
          sd.date,
          sd.close,
          sd.open,
          sd.high,
          sd.low,
          sd.volume,
          sd.dividends,
          sd.stock_splits,
          ROW_NUMBER() OVER (PARTITION BY sd.stock_id ORDER BY sd.date DESC) AS rnk
        FROM StockData sd
        WHERE sd.date >= (CURRENT_DATE - INTERVAL '200 days')
      ),
      latest_stock_data AS (
        SELECT * FROM recent_stock_data WHERE rnk = 1
      )
      SELECT 
        lsd.stock_id,
        s.ticker,
        ${granularQueryParts ? granularQueryParts + ',' : ''}
        lsd.close
      FROM latest_stock_data lsd
      JOIN Stock s ON lsd.stock_id = s.id
    `;

    const recentStockDataResult = await pool.query(recentStockDataQuery);
    const recentStockData = recentStockDataResult.rows;

    const filteredStocks = recentStockData.filter(stock => {
      return granularCriteria.every(criterion => {
        if (criterion.type === 'ma') {
          const ma = stock[`ma_${criterion.period}d`];
          return ma && evaluateOperator(stock.close, ma, criterion.operator);
        }
        if (criterion.type === 'rsi') {
          const rsi = stock.rsi;
          return rsi && evaluateOperator(rsi, criterion.value, criterion.operator);
        }
        if (criterion.type === 'momentum') {
          const momentum = stock.momentum;
          return momentum && evaluateOperator(momentum, criterion.value, criterion.operator);
        }
        return false;
      });
    });

    const filteredStockIds = filteredStocks.map(stock => stock.stock_id);

    const topNQuery = {
      revenue: `
        SELECT f.stock_id, s.ticker, (f.data->>'Total Revenue')::NUMERIC AS value
        FROM financials f
        JOIN Stock s ON f.stock_id = s.id
        WHERE f.statement_type = 'income_statement'
        AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
        AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
        AND (f.data->>'Total Revenue')::NUMERIC != 0
        AND f.stock_id = ANY($1::int[])
        ORDER BY value ${orderDirection}
        LIMIT $2`,
      gross_profit: `
        SELECT f.stock_id, s.ticker, (f.data->>'Gross Profit')::NUMERIC AS value
        FROM financials f
        JOIN Stock s ON f.stock_id = s.id
        WHERE f.statement_type = 'income_statement'
        AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
        AND (f.data->>'Gross Profit')::NUMERIC IS NOT NULL
        AND (f.data->>'Gross Profit')::NUMERIC != 0
        AND f.stock_id = ANY($1::int[])
        ORDER BY value ${orderDirection}
        LIMIT $2`,
      debt: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Debt')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      free_cash_flow: `
      SELECT f.stock_id, s.ticker, (f.data->>'Free Cash Flow')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      WHERE f.statement_type = 'cash_flow'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'cash_flow')
      AND (f.data->>'Free Cash Flow')::NUMERIC IS NOT NULL
      AND (f.data->>'Free Cash Flow')::NUMERIC != 0
      AND f.stock_id = ANY($1::int[])
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      market_cap: `
      SELECT f.stock_id, s.ticker, lf.market_cap AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      market_cap_revenue: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Total Revenue')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Revenue')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      market_cap_grossprofit: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Gross Profit')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Gross Profit')::NUMERIC IS NOT NULL
      AND (f.data->>'Gross Profit')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      market_cap_debt: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Total Debt')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      current_assets: `
      SELECT f.stock_id, s.ticker, (f.data->>'Current Assets')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Current Assets')::NUMERIC IS NOT NULL
      AND (f.data->>'Current Assets')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      total_tax_payable: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Tax Payable')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Tax Payable')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Tax Payable')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      total_assets: `
      SELECT f.stock_id, s.ticker, (f.data->>'Total Assets')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Assets')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Assets')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      long_term_equity_investment: `
      SELECT f.stock_id, s.ticker, (f.data->>'Long Term Equity Investment')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Long Term Equity Investment')::NUMERIC IS NOT NULL
      AND (f.data->>'Long Term Equity Investment')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      last_close_price_eps: `
      SELECT f.stock_id, s.ticker, (lf.market_cap / NULLIF((f.data->>'Basic EPS')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      JOIN (SELECT f.stock_id, f.market_cap, f.date
            FROM Fundamentals f
            WHERE f.date = (SELECT MAX(f2.date) FROM Fundamentals f2 WHERE f2.stock_id = f.stock_id)
            AND f.market_cap IS NOT NULL
            AND f.market_cap != 0) lf ON lf.stock_id = f.stock_id
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Basic EPS')::NUMERIC IS NOT NULL
      AND (f.data->>'Basic EPS')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      revenue_cost_revenue: `
      SELECT f.stock_id, s.ticker, ((f.data->>'Total Revenue')::NUMERIC / NULLIF((f.data->>'Cost Of Revenue')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'income_statement'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'income_statement')
      AND (f.data->>'Total Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Revenue')::NUMERIC != 0
      AND (f.data->>'Cost Of Revenue')::NUMERIC IS NOT NULL
      AND (f.data->>'Cost Of Revenue')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      repayment_of_debt: `
      SELECT f.stock_id, s.ticker, (f.data->>'Repayment Of Debt')::NUMERIC AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'cash_flow'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'cash_flow')
      AND (f.data->>'Repayment Of Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Repayment Of Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`,
      total_debt_repayment_of_debt: `
      SELECT f.stock_id, s.ticker, ((f.data->>'Total Debt')::NUMERIC / NULLIF((f.data->>'Repayment Of Debt')::NUMERIC, 0)) AS value
      FROM financials f
      JOIN Stock s ON f.stock_id = s.id
      AND f.stock_id = ANY($1::int[])
      WHERE f.statement_type = 'balance_sheet'
      AND f.date = (SELECT MAX(f2.date) FROM financials f2 WHERE f2.stock_id = f.stock_id AND f2.statement_type = 'balance_sheet')
      AND (f.data->>'Total Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Total Debt')::NUMERIC != 0
      AND (f.data->>'Repayment Of Debt')::NUMERIC IS NOT NULL
      AND (f.data->>'Repayment Of Debt')::NUMERIC != 0
      ORDER BY value ${orderDirection}
      LIMIT $2`
    };

    const { rows } = await pool.query(topNQuery[topNCriteria], [filteredStockIds, n]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching granular and top N stocks:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Express endpoint to fetch advances and declines for all stocks
app.get('/api/stocks/advances-declines', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT date,
              SUM(CASE WHEN close > open THEN 1 ELSE 0 END) AS advances,
              SUM(CASE WHEN close < open THEN 1 ELSE 0 END) AS declines
       FROM StockData
       GROUP BY date
       ORDER BY date`
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching advances and declines data:', error);
    res.status(500).json({ error: 'Error fetching advances and declines data' });
  }
});

app.get('/api/stocks/financialsummary', async (req, res) => {
  try {
    console.log("starting");
    const { rows: stocks } = await pool.query('SELECT id, ticker FROM Stock');
    const stockIds = stocks.map(stock => stock.id);
    console.log("got stocks");
    // Fetch financial data in batches and calculate aggregates incrementally
    const {
      totalMarketCap,
      totalProfit,
      totalRevenue,
      combinedEPS,
      totalDebt,
      numEPS,
    } = await fetchFinancialDataInBatches(stockIds);

    console.log("fetching fundamental")

    const fundamentalsDataResult = await pool.query(`
  WITH ranked_fundamentals AS (
    SELECT 
      stock_id, 
      date, 
      market_cap, 
      trailing_pe, 
      price_to_book,
      ROW_NUMBER() OVER (PARTITION BY stock_id ORDER BY date DESC) AS rnk
    FROM Fundamentals
    WHERE stock_id = ANY($1::int[])
  )
  SELECT 
    stock_id, 
    date, 
    market_cap, 
    trailing_pe, 
    price_to_book
  FROM ranked_fundamentals
  WHERE rnk = 1
`, [stockIds]);
    const fundamentalsData = fundamentalsDataResult.rows;

    console.log("GOT fundamental")
    console.log("TORA ", fundamentalsData[0])
    // Calculate remaining aggregates
    const totalMarketCapFromFundamentals = fundamentalsData.reduce((sum, item) => sum + (item.market_cap / 10000000 || 0), 0);
    const avgProfitPerMcap = totalProfit / (totalMarketCapFromFundamentals / 1000);
    const avgProfitPerRevenue = totalProfit / (totalRevenue / 1000);
    const avgDebtPerMcap = totalDebt / (totalMarketCapFromFundamentals / 1000);
    const avgDebtPerRevenue = totalDebt / (totalRevenue / 1000);

    const responseData = {
      totalMarketCap: totalMarketCapFromFundamentals,
      totalProfit: totalProfit / 10000000,
      combinedEPS: numEPS ? combinedEPS / numEPS : 0, // Average EPS
      totalDebt: totalDebt / 10000000,
      totalRevenue: totalRevenue / 10000000,
      avgProfitPerMcap,
      avgProfitPerRevenue,
      avgDebtPerMcap,
      avgDebtPerRevenue,
    };
    console.log(responseData);
    res.status(200).json(responseData);
  } catch (error) {
    console.log("errored while calculating financial summary: ", error);
    res.status(500).json({ error: 'Error fetching financial summary data' });
  }
});


// Express endpoint to get stock by ID
app.get('/api/stocks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM Stock WHERE id = $1', [id]);
    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0]);
    } else {
      res.status(404).json({ error: 'Stock not found' });
    }
  } catch (error) {
    console.error('Error fetching stock:', error);
    res.status(500).json({ error: 'Error fetching stock' });
  }
});

// Endpoint to fetch daily stock data
app.get('/api/stocks/:id/daily', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM StockData WHERE stock_id = $1 ORDER BY date DESC', [id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching daily stock data:', error);
    res.status(500).json({ error: 'Error fetching daily stock data' });
  }
});

// Endpoint to fetch fundamentals data
app.get('/api/stocks/:id/fundamentals', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM Fundamentals WHERE stock_id = $1 ORDER BY date DESC', [id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching fundamentals data:', error);
    res.status(500).json({ error: 'Error fetching fundamentals data' });
  }
});

// Endpoint to fetch financials data
app.get('/api/stocks/:id/financials', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM Financials WHERE stock_id = $1 ORDER BY date DESC', [id]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching financials data:', error);
    res.status(500).json({ error: 'Error fetching financials data' });
  }
});
