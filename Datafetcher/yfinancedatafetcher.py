import yfinance as yf
import sqlite3
import pandas as pd
from datetime import datetime

# Function to create the database and tables
def create_db_schema(conn):
    with conn:
        # Drop existing tables if they exist
        conn.execute("DROP TABLE IF EXISTS Stock")
        conn.execute("DROP TABLE IF EXISTS StockData")
        conn.execute("DROP TABLE IF EXISTS Fundamentals")
        conn.execute("DROP TABLE IF EXISTS Financials")
        
        # Create new tables with the updated schema
        conn.execute("""
            CREATE TABLE IF NOT EXISTS Stock (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS StockData (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS Fundamentals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS Financials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stock_id INTEGER,
                date DATE,
                statement_type TEXT,
                data BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stock_id) REFERENCES Stock(id),
                UNIQUE(stock_id, date, statement_type)
            )
        """)

# Function to insert stock information
def insert_stock(conn, ticker):
    with conn:
        cursor = conn.execute("INSERT OR IGNORE INTO Stock (ticker) VALUES (?)", (ticker,))
        return cursor.lastrowid

# Function to insert stock data
def insert_stock_data(conn, stock_id, data):
    with conn:
        for row in data.itertuples(index=True, name=None):
            conn.execute("""
                INSERT INTO StockData (stock_id, date, open, high, low, close, volume, dividends, stock_splits, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(stock_id, date) DO UPDATE SET
                open=excluded.open, high=excluded.high, low=excluded.low,
                close=excluded.close, volume=excluded.volume, dividends=excluded.dividends,
                stock_splits=excluded.stock_splits, updated_at=excluded.updated_at
            """, (stock_id, row[0].to_pydatetime(), row[1], row[2], row[3], row[4], row[5], row[6], row[7], datetime.now()))

# Function to insert fundamental data
def insert_fundamentals(conn, stock_id, date, info):
    with conn:
        conn.execute("""
            INSERT INTO Fundamentals (
                stock_id, date, market_cap, enterprise_value, trailing_pe, forward_pe, peg_ratio, price_to_book, dividend_yield, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(stock_id, date) DO UPDATE SET
            market_cap=excluded.market_cap, enterprise_value=excluded.enterprise_value,
            trailing_pe=excluded.trailing_pe, forward_pe=excluded.forward_pe,
            peg_ratio=excluded.peg_ratio, price_to_book=excluded.price_to_book,
            dividend_yield=excluded.dividend_yield, updated_at=excluded.updated_at
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

# Function to insert financial data
def insert_financials(conn, stock_id, date, statement_type, data):
    with conn:
        conn.execute("""
            INSERT INTO Financials (
                stock_id, date, statement_type, data, updated_at
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(stock_id, date, statement_type) DO UPDATE SET
            data=excluded.data, updated_at=excluded.updated_at
        """, (stock_id, date, statement_type, data.to_json(), datetime.now()))

# Main function to retrieve data and store it in the database
def main(tickers):
    conn = sqlite3.connect('stocks.db')
    create_db_schema(conn)

    for ticker in tickers:
        print(f"Processing {ticker}...")
        stock_id = insert_stock(conn, ticker)
        stock = yf.Ticker(ticker + '.NS')

        # Fetch and insert historical stock data
        data = stock.history(period="max")
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

    conn.close()
    print("Data retrieval and storage complete.")

if __name__ == "__main__":
    # List of stock tickers to retrieve data for
    # tickers = ['TCS.NS', 'INFY.NS', 'NRL.NS']

    excel_file_path = './MCAP28032024.xlsx'
    # Load the symbols from the Excel file
    df = pd.read_excel(excel_file_path)
    symbols = df['Symbol'].tolist()
    # random.shuffle(symbols)

    main(symbols)
