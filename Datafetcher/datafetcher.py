import yfinance as yf
import psycopg2
import pandas as pd
from datetime import datetime
import json
import os
import redis
import openpyxl

# Initialize Redis client
redis_client = redis.StrictRedis(host='redisYFinance', port=6379, db=0, decode_responses=True)

# Function to create the database and tables
def create_db_schema1(conn):
    with conn.cursor() as cur:
        # Drop existing tables if they exist
        # cur.execute("DROP TABLE IF EXISTS Stock CASCADE")
        # cur.execute("DROP TABLE IF EXISTS StockData CASCADE")
        # cur.execute("DROP TABLE IF EXISTS Fundamentals CASCADE")
        # cur.execute("DROP TABLE IF EXISTS Financials CASCADE")
        
        # Create new tables with the updated schema
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Stock (
                id SERIAL PRIMARY KEY,
                ticker TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS StockData (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                dividends REAL,
                stock_splits REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Fundamentals (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                market_cap INTEGER,
                enterprise_value INTEGER,
                trailing_pe REAL,
                forward_pe REAL,
                peg_ratio REAL,
                price_to_book REAL,
                dividend_yield REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Financials (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                statement_type TEXT,
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date, statement_type)
            )
        """)
        conn.commit()

def create_db_schema(conn):
    with conn.cursor() as cur:
        # Drop existing tables if they exist
        # cur.execute("DROP TABLE IF EXISTS Stock CASCADE")
        # cur.execute("DROP TABLE IF EXISTS StockData CASCADE")
        # cur.execute("DROP TABLE IF EXISTS Fundamentals CASCADE")
        # cur.execute("DROP TABLE IF EXISTS Financials CASCADE")
        
        # Create new tables with the updated schema
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Stock (
                id SERIAL PRIMARY KEY,
                ticker TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS StockData (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume BIGINT,
                dividends REAL,
                stock_splits REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Fundamentals (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                market_cap BIGINT,
                enterprise_value BIGINT,
                trailing_pe REAL,
                forward_pe REAL,
                peg_ratio REAL,
                price_to_book REAL,
                dividend_yield REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS Financials (
                id SERIAL PRIMARY KEY,
                stock_id INTEGER,
                date DATE,
                statement_type TEXT,
                data JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date, statement_type)
            )
        """)
        conn.commit()

# Function to insert stock information
def insert_stock(conn, ticker):
    with conn.cursor() as cur:
        cur.execute("INSERT INTO Stock (ticker) VALUES (%s) ON CONFLICT (ticker) DO NOTHING RETURNING id", (ticker,))
        result = cur.fetchone()
        conn.commit()
        if result:
            return result[0]
        else:
            cur.execute("SELECT id FROM Stock WHERE ticker = %s", (ticker,))
            return cur.fetchone()[0]

# Function to insert stock data
def insert_stock_data(conn, stock_id, data):
    with conn.cursor() as cur:
        for row in data.itertuples(index=True, name=None):
            cur.execute("""
                INSERT INTO StockData (stock_id, date, open, high, low, close, volume, dividends, stock_splits, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (stock_id, date) DO UPDATE SET
                open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                close = EXCLUDED.close, volume = EXCLUDED.volume, dividends = EXCLUDED.dividends,
                stock_splits = EXCLUDED.stock_splits, updated_at = EXCLUDED.updated_at
            """, (stock_id, row[0].to_pydatetime(), row[1], row[2], row[3], row[4], row[5], row[6], row[7], datetime.now()))
        conn.commit()

# Function to insert fundamental data
def insert_fundamentals(conn, stock_id, date, info):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO Fundamentals (
                stock_id, date, market_cap, enterprise_value, trailing_pe, forward_pe, peg_ratio, price_to_book, dividend_yield, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (stock_id, date) DO UPDATE SET
            market_cap = EXCLUDED.market_cap, enterprise_value = EXCLUDED.enterprise_value,
            trailing_pe = EXCLUDED.trailing_pe, forward_pe = EXCLUDED.forward_pe,
            peg_ratio = EXCLUDED.peg_ratio, price_to_book = EXCLUDED.price_to_book,
            dividend_yield = EXCLUDED.dividend_yield, updated_at = EXCLUDED.updated_at
        """, (
            stock_id, date,
            info.get('marketCap'),
            info.get('enterpriseValue'),
            info.get('trailingPE'),
            info.get('forwardPE'),
            info.get('pegRatio'),
            info.get('priceToBook'),
            info.get('dividendYield'),
            datetime.now()
        ))
        conn.commit()

# Function to insert financial data
# def insert_financials(conn, stock_id, date, statement_type, data):
#     with conn.cursor() as cur:
#         cur.execute("""
#             INSERT INTO Financials (
#                 stock_id, date, statement_type, data, updated_at
#             ) VALUES (%s, %s, %s, %s, %s)
#             ON CONFLICT (stock_id, date, statement_type) DO UPDATE SET
#             data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
#         """, (stock_id, date, statement_type, json.dumps(data.to_dict()), datetime.now()))
#         conn.commit()
        
def insert_financials(conn, stock_id, date, statement_type, data):
    with conn.cursor() as cur:
        # Replace NaN with None and convert DataFrame to JSON
        json_data = data.where(pd.notnull(data), None).to_json()

        cur.execute("""
            INSERT INTO Financials (
                stock_id, date, statement_type, data, updated_at
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (stock_id, date, statement_type) DO UPDATE SET
            data = EXCLUDED.data, updated_at = EXCLUDED.updated_at
        """, (stock_id, date, statement_type, json_data, datetime.now()))
        conn.commit()

# Function to determine the period for data fetching
def determine_period(days_gap):
    periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
    thresholds = [1, 5, 30, 90, 180, 365, 730, 1825, 3650, 365, 10000]

    for period, threshold in zip(periods, thresholds):
        if days_gap <= threshold:
            return period
    return "max"

def fetch_stock_data(ticker, period):
    periods = ["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"]
    start_index = periods.index(period)

    for p in periods[start_index:]:
        try:
            data = yf.Ticker(ticker + '.NS').history(period=p)
            if not data.empty:
                return data
        except Exception as e:
            print(f"Error fetching data for period {p}: {e}")
    return pd.DataFrame()

# Main function to retrieve data and store it in the database
def main(tickers):
    conn = psycopg2.connect(
        dbname=os.environ['DB_NAME'],
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        host='postgres',  # This refers to the service name in docker-compose
        port='5432'
    )
    create_db_schema(conn)

    for ticker in tickers:
        print(f"Processing {ticker}...")
        if redis_client.get(ticker):
            print(f"Skipping {ticker}, already processed.")
            continue
        stock_id = insert_stock(conn, ticker)
        stock = yf.Ticker(ticker + '.NS')

        # Check latest date in StockData
        with conn.cursor() as cur:
            cur.execute("SELECT MAX(date) FROM StockData WHERE stock_id = %s", (stock_id,))
            result = cur.fetchone()
            last_date = result[0] if result[0] else datetime(1900, 1, 1).date()  # Default to very old date if no data
            days_gap = (datetime.now().date() - last_date).days

        period = determine_period(days_gap)
        # Fetch and insert historical stock data
        data = fetch_stock_data(ticker, period)
        print(data.columns)  # Print columns to debug the names
        insert_stock_data(conn, stock_id, data)

        # Fetch and insert daily fundamental data
        info = stock.info
        for date in data.index:
            insert_fundamentals(conn, stock_id, date.to_pydatetime(), info)

        # Fetch and insert financial data
        for statement_type, statement_data in [("balance_sheet", stock.balance_sheet),
                                               ("income_statement", stock.financials),
                                               ("cash_flow", stock.cashflow)]:
            for date in statement_data.columns:
                insert_financials(conn, stock_id, pd.to_datetime(date).to_pydatetime(), statement_type, statement_data[date])

        # Mark ticker as processed in Redis
        redis_client.set(ticker, 'processed')

    conn.close()
    print("Data retrieval and storage complete.")

if __name__ == "__main__":
    # List of stock tickers to retrieve data for
    # tickers = ['AAPL', 'MSFT', 'GOOGL']
    # main(tickers)

    excel_file_path = './MCAP28032024.xlsx'
    # Load the symbols from the Excel file
    df = pd.read_excel(excel_file_path)
    symbols = df['Symbol'].tolist()
    main(symbols)
