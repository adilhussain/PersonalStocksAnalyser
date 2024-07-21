import * as React from 'react';
import { DataGrid } from '@mui/x-data-grid';

const columns = [
  { field: 'date', headerName: 'Date', width: 150 },
  { field: 'open', headerName: 'Open', width: 100 },
  { field: 'high', headerName: 'High', width: 100 },
  { field: 'low', headerName: 'Low', width: 100 },
  { field: 'close', headerName: 'Close', width: 100 },
  { field: 'volume', headerName: 'Volume', width: 150 },
  { field: 'dividends', headerName: 'Dividends', width: 150 },
  { field: 'stock_splits', headerName: 'Stock Splits', width: 150 },
];

export default function StockDataTable({ rows }) {
  return (
    <div style={{ height: 600, width: '100%' }}>
      <DataGrid rows={rows} columns={columns} pageSize={10} />
    </div>
  );
}
