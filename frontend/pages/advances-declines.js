import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdvancesDeclinesChart from '../components/AdvancesDeclinesChart';

const AdvancesDeclines = () => {
  const [advancesDeclines, setAdvancesDeclines] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const advancesDeclinesResult = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/advances-declines`);
      setAdvancesDeclines(advancesDeclinesResult.data);
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Stock Market Advances and Declines</h1>
      <AdvancesDeclinesChart data={advancesDeclines} />
    </div>
  );
};

export default AdvancesDeclines;
