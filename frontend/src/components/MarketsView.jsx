import { useState, useEffect } from 'react';
import C from '../colors';
import { fetchMarkets } from '../services/api';

export default function MarketsView({ onForecastSelect }) {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchMarkets();
        setMarkets(data);
      } catch (err) {
        setError(err.message || 'Failed to load market data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div>
        <h1 style={{ color: C.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Markets Overview</h1>
        <p style={{ color: C.grey, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
          Real-time performance of major indexes and popular equities. Click Forecast to run ARIMA/LSTM models.
        </p>
      </div>

      {loading && (
        <div
          style={{
            background: C.card,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: `3px solid ${C.border}`,
              borderTopColor: C.blue,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <div style={{ color: C.grey, fontSize: 13 }}>Fetching market rates...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {error && (
        <div
          style={{
            background: `${C.red}12`,
            border: `1px solid ${C.red}44`,
            borderRadius: 10,
            padding: '16px 20px',
            color: C.red,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <div
          style={{
            background: C.card,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}`, background: `${C.bg}66` }}>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600 }}>TICKER</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600 }}>NAME</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>PRICE</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>CHANGE</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>% CHANGE</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>HIGH</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'right' }}>LOW</th>
                  <th style={{ padding: '16px 20px', color: C.grey, fontSize: 12, fontWeight: 600, textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => {
                  const isUp = m.change >= 0;
                  const color = isUp ? C.green : C.red;
                  return (
                    <tr
                      key={m.symbol}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        transition: 'background 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `${C.secondary}77`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                      onClick={() => onForecastSelect(m.symbol)}
                    >
                      <td style={{ padding: '16px 20px', color: C.white, fontWeight: 700, fontSize: 13 }}>
                        <span
                          style={{
                            background: `${C.blue}18`,
                            color: C.blue,
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 12,
                          }}
                        >
                          {m.symbol}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: C.grey, fontSize: 13 }}>{m.name}</td>
                      <td style={{ padding: '16px 20px', color: C.white, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                        ${m.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '16px 20px', color: color, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                        {isUp ? '+' : ''}
                        {m.change.toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 20px', color: color, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                        <span
                          style={{
                            background: `${color}12`,
                            padding: '4px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {isUp ? '+' : ''}
                          {m.change_percent.toFixed(2)}%
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', color: C.grey, fontSize: 13, textAlign: 'right' }}>
                        ${m.high.toFixed(2)}
                      </td>
                      <td style={{ padding: '16px 20px', color: C.grey, fontSize: 13, textAlign: 'right' }}>
                        ${m.low.toFixed(2)}
                      </td>
                      <td
                        style={{ padding: '16px 20px', textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()} // Stop triggering the row click
                      >
                        <button
                          onClick={() => onForecastSelect(m.symbol)}
                          style={{
                            background: C.secondary,
                            border: `1px solid ${C.border}`,
                            color: C.blue,
                            fontWeight: 600,
                            fontSize: 12,
                            padding: '6px 12px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = C.blue;
                            e.currentTarget.style.color = C.white;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = C.secondary;
                            e.currentTarget.style.color = C.blue;
                          }}
                        >
                          Forecast
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
