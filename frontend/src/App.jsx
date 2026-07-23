import { useState } from 'react';
import C from './colors';
import { fetchForecast } from './services/api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import StockHeader from './components/StockHeader';
import ForecastChart from './components/ForecastChart';
import EvaluationMetrics from './components/EvaluationMetrics';
import TechnicalIndicators from './components/TechnicalIndicators';
import MarketsView from './components/MarketsView';
import ReportsView from './components/ReportsView';

function LoadingOverlay() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `${C.bg}CC`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 10,
        backdropFilter: 'blur(3px)',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          border: `3px solid ${C.border}`,
          borderTopColor: C.blue,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <div style={{ color: C.white, fontSize: 14, fontWeight: 500 }}>Fetching market data…</div>
      <div style={{ color: C.grey, fontSize: 12 }}>Calculating ARIMA & LSTM predictions</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBanner({ message, onDismiss }) {
  return (
    <div
      style={{
        background: `${C.red}18`,
        border: `1px solid ${C.red}55`,
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
      }}
    >
      <span style={{ fontSize: 16, color: C.red, fontWeight: 700 }}>!</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: C.red, fontWeight: 600, fontSize: 13 }}>Forecast Error</div>
        <div style={{ color: `${C.red}CC`, fontSize: 12, marginTop: 2 }}>{message}</div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: C.grey,
          cursor: 'pointer',
          fontSize: 16,
          padding: 4,
        }}
      >
        x
      </button>
    </div>
  );
}

export default function App() {
  const [symbol, setSymbol] = useState('AAPL');
  const [days, setDays] = useState(17);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Dashboard');

  const fetchStockData = async (tickerSymbol, forecastDays = days) => {
    if (!tickerSymbol.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchForecast(tickerSymbol.trim(), forecastDays);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to fetch forecast. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => {
    fetchStockData(symbol, days);
  };

  const handleForecastSelect = (ticker) => {
    setSymbol(ticker);
    setActiveTab('Dashboard');
    fetchStockData(ticker, days);
  };

  const showSidebar = activeTab === 'Dashboard' || activeTab === 'Reports';

  return (
    <div
      style={{
        background: C.bg,
        minHeight: '100vh',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Fixed Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Fixed Sidebar */}
      {showSidebar && (
        <Sidebar
          symbol={symbol}
          setSymbol={setSymbol}
          days={days}
          setDays={setDays}
          onGenerate={handleGenerate}
          loading={loading}
          onSelectSuggestion={(ticker) => handleForecastSelect(ticker)}
        />
      )}

      {/* Main Content */}
      <main
        style={{
          marginLeft: showSidebar ? 220 : 0,
          marginTop: 56,
          padding: '20px 24px',
          minHeight: 'calc(100vh - 56px)',
          transition: 'margin-left 0.2s ease',
        }}
      >
        {/* Error Banner */}
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        {/* Tab Routing */}
        {activeTab === 'Dashboard' && (
          <>
            {/* Welcome State */}
            {!data && !loading && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 'calc(100vh - 140px)',
                  gap: 20,
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 20,
                    background: `linear-gradient(135deg, ${C.blue}33, #6B4FE033)`,
                    border: `1px solid ${C.blue}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                  }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3A82F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
                </div>
                <div>
                  <div style={{ color: C.white, fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
                    Welcome to StockVision
                  </div>
                  <div style={{ color: C.grey, fontSize: 14, maxWidth: 420, lineHeight: 1.6 }}>
                    Enter a stock ticker in the sidebar, choose your forecast horizon, and click{' '}
                    <span style={{ color: C.blue, fontWeight: 600 }}>Generate Forecast</span> to see
                    AI-powered ARIMA &amp; LSTM predictions.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {['AAPL', 'TSLA', 'GOOGL', 'NVDA', 'MSFT'].map((s) => (
                    <button
                      key={s}
                      id={`quick-pick-${s.toLowerCase()}`}
                      onClick={() => {
                        handleForecastSelect(s);
                      }}
                      style={{
                        background: C.secondary,
                        border: `1px solid ${C.border}`,
                        borderRadius: 8,
                        color: C.white,
                        fontFamily: 'Inter, sans-serif',
                        fontSize: 13,
                        fontWeight: 600,
                        padding: '8px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = C.blue;
                        e.currentTarget.style.background = `${C.blue}18`;
                        e.currentTarget.style.color = C.blue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = C.border;
                        e.currentTarget.style.background = C.secondary;
                        e.currentTarget.style.color = C.white;
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dashboard Content */}
            {(data || loading) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Stock Header */}
                <StockHeader data={data} />

                {/* Forecast Chart (relative for overlay) */}
                <div style={{ position: 'relative' }}>
                  {loading && <LoadingOverlay />}
                  <ForecastChart data={data} />
                </div>

                {/* Bottom Row: Metrics + Indicators */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '340px 1fr',
                    gap: 16,
                    alignItems: 'start',
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    {loading && <LoadingOverlay />}
                    <EvaluationMetrics data={data} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    {loading && <LoadingOverlay />}
                    <TechnicalIndicators data={data} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'Markets' && (
          <MarketsView onForecastSelect={handleForecastSelect} />
        )}

        {activeTab === 'Reports' && (
          <ReportsView currentStockData={data} activeSymbol={symbol} />
        )}
      </main>
    </div>
  );
}
