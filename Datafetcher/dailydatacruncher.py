import psycopg2
import redis
import json
from datetime import datetime
import os

# Database connection parameters
db_params = {
    'dbname': os.environ['DB_NAME'],  # replace with your actual database name
    'user': os.environ['DB_USER'],    # replace with your actual database user
    'password': os.environ['DB_PASSWORD'],  # replace with your actual database password
    'host': 'postgres',
    'port': '5432',
}

# Redis connection parameters
redis_params = {
    'host': 'redisYFinance',
    'port': 6379
}

# Function to fetch data from the database
def fetch_data_from_db(query):
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()
    cursor.execute(query)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

# Function to fetch stock and financial data
def fetch_financial_data():
    stock_query = 'SELECT id, ticker FROM Stock'
    financial_query = 'SELECT stock_id, date, statement_type, data FROM Financials'
    fundamental_query = 'SELECT stock_id, date, market_cap, trailing_pe, price_to_book FROM Fundamentals'

    stocks = fetch_data_from_db(stock_query)
    financial_data = fetch_data_from_db(financial_query)
    fundamentals_data = fetch_data_from_db(fundamental_query)

    return stocks, financial_data, fundamentals_data

# Function to sanitize data
def sanitize_data(data):
    if isinstance(data, float):
        if data == float('inf') or data == float('-inf') or data != data:  # checks for infinity and NaN
            return None
    elif isinstance(data, dict):
        return {k: sanitize_data(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_data(v) for v in data]
    return data

# Function to crunch data
def crunch_data(stocks, financial_data, fundamentals_data):
    stock_ids = [stock[0] for stock in stocks]

    # Calculate aggregates
    total_market_cap = sum(sanitize_data(item[2]) or 0 for item in fundamentals_data) / 10000000
    total_profit = sum(sanitize_data(item[3].get('Net Income')) or 0 for item in financial_data if item[2] == 'income_statement') / 10000000
    total_revenue = sum(sanitize_data(item[3].get('Total Revenue')) or 0 for item in financial_data if item[2] == 'income_statement') / 10000000
    combined_eps = sum(sanitize_data(item[3].get('Basic EPS')) or 0 for item in financial_data if item[2] == 'income_statement')
    total_debt = sum(sanitize_data(item[3].get('Total Debt')) or 0 for item in financial_data if item[2] == 'balance_sheet') / 10000000

    avg_profit_per_mcap = total_profit / (total_market_cap / 1000) if total_market_cap else 0
    avg_profit_per_revenue = total_profit / (total_revenue / 1000) if total_revenue else 0
    avg_debt_per_mcap = total_debt / (total_market_cap / 1000) if total_market_cap else 0
    avg_debt_per_revenue = total_debt / (total_revenue / 1000) if total_revenue else 0

    response_data = {
        'totalMarketCap': total_market_cap,
        'totalProfit': total_profit,
        'combinedEPS': combined_eps,
        'totalDebt': total_debt,
        'totalRevenue': total_revenue,
        'avgProfitPerMcap': avg_profit_per_mcap,
        'avgProfitPerRevenue': avg_profit_per_revenue,
        'avgDebtPerMcap': avg_debt_per_mcap,
        'avgDebtPerRevenue': avg_debt_per_revenue,
        'fundamentalsData': fundamentals_data,
    }

    return sanitize_data(response_data)

# Function to persist data in the database
def persist_data_in_db(data):
    conn = psycopg2.connect(**db_params)
    cursor = conn.cursor()
    create_table_query = '''
    CREATE TABLE IF NOT EXISTS FinancialSummary (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        data JSONB NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    '''
    cursor.execute(create_table_query)
    insert_data_query = '''
    INSERT INTO FinancialSummary (date, data)
    VALUES (%s, %s::jsonb)
    ON CONFLICT (date) DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = EXCLUDED.updated_at
    '''
    cursor.execute(insert_data_query, (datetime.now().date(), json.dumps(data, default=str)))
    conn.commit()
    cursor.close()
    conn.close()

# Function to store data in Redis
def store_data_in_redis(data):
    redis_client = redis.StrictRedis(**redis_params, decode_responses=True)
    redis_client.set('financialSummary', json.dumps(data, default=str), ex=3600)  # Cache for 1 hour

if __name__ == '__main__':
    stocks, financial_data, fundamentals_data = fetch_financial_data()
    summary_data = crunch_data(stocks, financial_data, fundamentals_data)
    persist_data_in_db(summary_data)
    store_data_in_redis(summary_data)
