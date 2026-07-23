import { useState } from 'react';
import C from '../colors';

const TIME_RANGES = ['1W', '1M', '3M', '6M', '1Y', '2Y'];

export default function StockHeader({ data }) {
  const [activeRange, setActiveRange] = useState('2Y');

  const symbol = data?.symbol || 'AAPL';
  const prices = data?.historical_prices || [];
  const currentPrice = prices.length > 0 ? prices[prices.length - 1] : 187.42;
  const prevPrice = prices.length > 1 ? prices[prices.length - 2] : currentPrice - 2.34;
  const change = currentPrice - prevPrice;
  const changePct = prevPrice !== 0 ? (change / prevPrice) * 100 : 0;
  const isPositive = change >= 0;

  const companyNames = {
    AAPL: 'Apple Inc. · NASDAQ',
    TSLA: 'Tesla, Inc. · NASDAQ',
    GOOGL: 'Alphabet Inc. · NASDAQ',
    MSFT: 'Microsoft Corp. · NASDAQ',
    AMZN: 'Amazon.com Inc. · NASDAQ',
    META: 'Meta Platforms · NASDAQ',
    NVDA: 'NVIDIA Corp. · NASDAQ',
    NFLX: 'Netflix Inc. · NASDAQ',
    BTC: 'Bitcoin / USD · CRYPTO',
  };
  const companyLabel = companyNames[symbol] || `${symbol} · STOCK`;

  const handleExport = () => {
    if (!data) return;

    const {
      dates = [],
      historical_prices = [],
      opens = [],
      highs = [],
      lows = [],
      volumes = [],
      forecast_dates = [],
      arima_predictions = [],
      lstm_predictions = [],
    } = data;

    // Build CSV rows
    const rows = [['Date', 'Open', 'High', 'Low', 'Close', 'Volume', 'Type', 'ARIMA Forecast', 'LSTM Forecast']];

    // Historical data rows
    for (let i = 0; i < dates.length; i++) {
      rows.push([
        dates[i],
        opens[i] != null ? opens[i].toFixed(4) : '',
        highs[i] != null ? highs[i].toFixed(4) : '',
        lows[i] != null ? lows[i].toFixed(4) : '',
        historical_prices[i] != null ? historical_prices[i].toFixed(4) : '',
        volumes[i] != null ? volumes[i] : '',
        'Historical',
        '',
        '',
      ]);
    }

    // Forecast data rows
    for (let i = 0; i < forecast_dates.length; i++) {
      rows.push([
        forecast_dates[i],
        '',
        '',
        '',
        '',
        '',
        'Forecast',
        arima_predictions[i] != null ? arima_predictions[i].toFixed(4) : '',
        lstm_predictions[i] != null ? lstm_predictions[i].toFixed(4) : '',
      ]);
    }

    // Convert to CSV string
    const csvContent = rows.map((row) => row.join(',')).join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${symbol}_forecast_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
      }}
    >
      {/* Symbol + Company */}
      <div>
        <div style={{ color: C.white, fontSize: 22, fontWeight: 800, letterSpacing: '0.01em' }}>
          {symbol}
        </div>
        <div style={{ color: C.grey, fontSize: 12, marginTop: 2 }}>{companyLabel}</div>
      </div>

      {/* Price + Change */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ color: C.white, fontSize: 26, fontWeight: 700 }}>
          ${currentPrice.toFixed(2)}
        </div>
        <div
          style={{
            background: isPositive ? `${C.green}22` : `${C.red}22`,
            color: isPositive ? C.green : C.red,
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
        </div>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Time Range Tabs */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {TIME_RANGES.map((range) => {
          const isActive = range === activeRange;
          return (
            <button
              key={range}
              id={`range-btn-${range}`}
              onClick={() => setActiveRange(range)}
              style={{
                background: isActive ? C.blue : 'transparent',
                border: 'none',
                borderRadius: 6,
                color: isActive ? C.white : C.grey,
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.18s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = C.white;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = C.grey;
              }}
            >
              {range}
            </button>
          );
        })}
      </div>

      {/* Export Button */}
      <button
        id="export-btn"
        onClick={handleExport}
        disabled={!data}
        style={{
          background: C.secondary,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          color: !data ? `${C.grey}66` : C.grey,
          fontFamily: 'Inter, sans-serif',
          fontSize: 12,
          fontWeight: 500,
          padding: '7px 14px',
          cursor: !data ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          if (data) {
            e.currentTarget.style.borderColor = C.blue;
            e.currentTarget.style.color = C.white;
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = C.border;
          e.currentTarget.style.color = data ? C.grey : `${C.grey}66`;
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 1v8M6 9l-3-3M6 9l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M1.5 11h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        Export CSV
      </button>
    </div>
  );
}
