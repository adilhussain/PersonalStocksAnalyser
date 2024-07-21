import axios from 'axios';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function Home() {
  const [stocks, setStocks] = useState([]);

  useEffect(() => {
    axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks`)
      .then(response => setStocks(response.data))
      .catch(error => console.error('Error fetching stocks:', error));
  }, []);

  return (
    <div>
      <h1>Stock Market Dashboard</h1>
      <ul>
        <li>
          <Link href="/advances-declines">
            <a>Advances and Declines Chart</a>
          </Link>
        </li>
      </ul>
      <h2>Stocks List</h2>
      <ul>
        {stocks.map(stock => (
          <li key={stock.id}>
            <Link href={`/stocks/${stock.id}`}>
              <a>{stock.ticker}</a>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
