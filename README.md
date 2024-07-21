# PersonalStocksAnalyser

YFinance is a comprehensive financial data platform that fetches, processes, and displays financial metrics for various stocks. The platform consists of a backend API server, a frontend application, and a data fetcher component to scrape and store financial data.

## Setup

To set up the project, follow these steps:

### Prerequisites

- Node.js
- Python
- Docker
- PostgreSQL

### Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/YFinance.git
   cd YFinance

2. **Set up environment variables**

Create a .env file in the root directory and add the following environment variables:

  env
  ```
  DB_USER=your_database_user
  DB_PASSWORD=your_database_password
  DB_NAME=your_database_name
  REDIS_URL=your_redis_url
  ```

3. **Install dependencies**

Navigate to the backend and frontend directories and install the necessary dependencies:

```bash
Copy code
cd backend
npm install
cd ../frontend
npm install
Run Docker Compose
```

Make sure Docker is running on your machine, then run the following command in the root directory to start the services:

```bash
Copy code
docker-compose up
Start the data fetcher
```

Navigate to the dataFetcher directory and run the Python script to start scraping financial data:

```bash
Copy code
cd ../dataFetcher
python fetcher.py
```

**Available APIs**
Financial Summary
Fetch a financial summary of all stocks:

http
Copy code
GET /api/stocks/financialsummary
Stock List
Fetch a list of all stocks:

http
Copy code
GET /api/stocks
Stock Data by ID
Fetch detailed information about a specific stock:

http
Copy code
GET /api/stocks/:id
Daily Stock Data
Fetch daily stock data for a specific stock:

http
Copy code
GET /api/stocks/:id/daily
Fundamentals Data
Fetch fundamentals data for a specific stock:

http
Copy code
GET /api/stocks/:id/fundamentals
Financials Data
Fetch financials data for a specific stock:

http
Copy code
GET /api/stocks/:id/financials
Advances and Declines
Fetch advances and declines for all stocks:

http
Copy code
GET /api/stocks/advances-declines
Top N Individual Stocks
Fetch top N stocks based on a specific financial metric:

http
Copy code
POST /api/stocks/top-n-individual
Request body example:

json
Copy code
{
  "criteria": "revenue",
  "n": 10,
  "orderDirection": "DESC"
}
Top N Stocks with Granular Criteria
Fetch top N stocks based on multiple granular criteria and a specific financial metric:

http
Copy code
POST /api/stocks/granularandtopn
Request body example:

json
Copy code
{
  "criteria": [
    { "type": "ma", "period": 20, "operator": "greater_than", "value": 0 },
    { "type": "rsi", "value": 30, "operator": "less_than" }
  ],
  "n": 10,
  "orderDirection": "DESC",
  "topNCriteria": "revenue"
}
Top Stocks by Metric
Fetch top stocks based on a specific metric and market cap category:

http
Copy code
GET /api/stocks/top/:metric/:order/:limit
Query parameters:

marketCapCategory: all, largecap, midcap, smallcap, microcap

