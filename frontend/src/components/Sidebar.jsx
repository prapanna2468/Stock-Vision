import { useState, useEffect, useRef, useCallback } from 'react';
import C from '../colors';
import { searchStocks, checkHealth } from '../services/api';

const PERIOD_DAYS = [7, 14, 17, 30];

export default function Sidebar({ symbol, setSymbol, days, setDays, onGenerate, loading, onSelectSuggestion }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('sv_recent');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [modelStatus, setModelStatus] = useState({
    lstm: { status: 'loading', loaded: false, message: 'Checking...' },
    arima: { status: 'loading', loaded: false, message: 'Checking...' },
  });
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Fetch model health on mount
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const poll = () => {
      checkHealth()
        .then((data) => {
          if (cancelled) return;
          if (data?.models) {
            setModelStatus(data.models);
            // If any model is still loading, re-poll in 5 seconds
            const stillLoading = Object.values(data.models).some(
              (m) => m.status === 'loading',
            );
            if (stillLoading) {
              retryTimer = setTimeout(poll, 5000);
            }
          }
        })
        .catch(() => {
          if (cancelled) return;
          setModelStatus({
            lstm: { status: 'error', loaded: false, message: 'Backend unreachable' },
            arima: { status: 'error', loaded: false, message: 'Backend unreachable' },
          });
        });
    };

    poll();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  // Add to recent searches
  const addRecent = useCallback((sym) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((r) => r.symbol !== sym);
      const updated = [{ symbol: sym, timestamp: Date.now() }, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('sv_recent', JSON.stringify(updated));
      } catch { /* ignore */ }
      return updated;
    });
  }, []);

  // Search suggestions with debounce
  const handleInputChange = (e) => {
    const val = e.target.value.toUpperCase();
    setSymbol(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.length >= 1) {
      debounceRef.current = setTimeout(async () => {
        try {
          const results = await searchStocks(val);
          setSuggestions(results);
          setShowSuggestions(true);
        } catch {
          setSuggestions([]);
        }
      }, 200);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (stock) => {
    setSymbol(stock.symbol);
    setShowSuggestions(false);
    setSuggestions([]);
    addRecent(stock.symbol);
    if (onSelectSuggestion) {
      onSelectSuggestion(stock.symbol);
    } else {
      // Trigger generate after selecting
      setTimeout(() => onGenerate(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !loading) {
      setShowSuggestions(false);
      addRecent(symbol);
      onGenerate();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleGenerateClick = () => {
    addRecent(symbol);
    onGenerate();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        inputRef.current &&
        !inputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Model status helper
  const getStatusIndicator = (model) => {
    const status = modelStatus[model];
    if (!status) return { color: C.grey, label: 'Unknown', dot: C.grey };

    if (status.status === 'loading') {
      return { color: C.blue, label: 'Loading…', dot: C.blue };
    }
    if (status.status === 'error') {
      return { color: C.red, label: 'Error', dot: C.red };
    }
    if (status.status === 'ready' || status.loaded) {
      return { color: C.green, label: 'Loaded', dot: C.green };
    }
    // placeholder
    return { color: C.orange, label: 'Placeholder', dot: C.orange };
  };

  const lstmIndicator = getStatusIndicator('lstm');
  const arimaIndicator = getStatusIndicator('arima');

  return (
    <aside
      style={{
        position: 'fixed',
        top: 56,
        left: 0,
        bottom: 0,
        width: 220,
        background: C.card,
        borderRight: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        overflowY: 'auto',
        gap: 20,
      }}
    >
      {/* Search Stock */}
      <div style={{ position: 'relative' }}>
        <div style={{ color: C.grey, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 8 }}>
          SEARCH STOCK
        </div>
        <div style={{ position: 'relative' }}>
          <input
            ref={inputRef}
            id="stock-symbol-input"
            type="text"
            placeholder="e.g. AAPL, TSLA, NVDA"
            value={symbol}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (symbol.length >= 1 && suggestions.length > 0) {
                setShowSuggestions(true);
              } else if (symbol.length >= 1) {
                // Trigger a fresh search on focus
                handleInputChange({ target: { value: symbol } });
              }
            }}
            style={{
              width: '100%',
              background: C.secondary,
              border: `1px solid ${C.border}`,
              borderRadius: showSuggestions ? '8px 8px 0 0' : 8,
              color: C.white,
              fontFamily: 'Inter, sans-serif',
              fontSize: 13,
              padding: '9px 12px',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          {/* Search icon */}
          <span
            style={{
              position: 'absolute',
              right: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: C.grey,
              fontSize: 13,
              pointerEvents: 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              background: C.secondary,
              border: `1px solid ${C.border}`,
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              maxHeight: 240,
              overflowY: 'auto',
              zIndex: 50,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}
          >
            {suggestions.map((stock, idx) => (
              <div
                key={`${stock.symbol}-${idx}`}
                onClick={() => handleSuggestionClick(stock)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: idx < suggestions.length - 1 ? `1px solid ${C.border}44` : 'none',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${C.blue}15`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  style={{
                    background: `${C.blue}22`,
                    color: C.blue,
                    padding: '3px 6px',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    minWidth: 42,
                    textAlign: 'center',
                  }}
                >
                  {stock.symbol}
                </span>
                <span
                  style={{
                    color: C.grey,
                    fontSize: 11,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {stock.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forecast Period */}
      <div>
        <div style={{ color: C.grey, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>
          FORECAST PERIOD
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {PERIOD_DAYS.map((d) => {
            const isSelected = days === d;
            return (
              <button
                key={d}
                id={`period-btn-${d}`}
                onClick={() => setDays(d)}
                style={{
                  background: isSelected ? C.blue : C.secondary,
                  border: `1px solid ${isSelected ? C.blue : C.border}`,
                  borderRadius: 20,
                  color: isSelected ? C.white : C.grey,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 400,
                  padding: '7px 0',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = C.blue;
                    e.currentTarget.style.color = C.white;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = C.border;
                    e.currentTarget.style.color = C.grey;
                  }
                }}
              >
                {d} Days
              </button>
            );
          })}
        </div>
      </div>

      {/* Generate Button */}
      <button
        id="generate-forecast-btn"
        onClick={handleGenerateClick}
        disabled={loading || !symbol}
        style={{
          width: '100%',
          background: loading || !symbol
            ? `${C.blue}55`
            : `linear-gradient(135deg, ${C.blue}, #5B6EF5)`,
          border: 'none',
          borderRadius: 10,
          color: loading || !symbol ? `${C.white}88` : C.white,
          fontFamily: 'Inter, sans-serif',
          fontSize: 13,
          fontWeight: 600,
          padding: '11px 0',
          cursor: loading || !symbol ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          letterSpacing: '0.03em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (!loading && symbol) e.currentTarget.style.opacity = '0.88';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {loading ? (
          <>
            <span
              style={{
                display: 'inline-block',
                width: 13,
                height: 13,
                border: `2px solid ${C.white}44`,
                borderTopColor: C.white,
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Fetching…
          </>
        ) : (
          <>Generate Forecast</>
        )}
      </button>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Recent Searches */}
      <div>
        <div style={{ color: C.grey, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>
          RECENT SEARCHES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {recentSearches.length === 0 && (
            <div style={{ color: `${C.grey}88`, fontSize: 11, padding: '6px 0' }}>
              No recent searches yet
            </div>
          )}
          {recentSearches.map((item) => (
            <div
              key={item.symbol}
              id={`recent-${item.symbol.toLowerCase()}`}
              onClick={() => {
                setSymbol(item.symbol);
                onGenerate();
              }}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: C.secondary,
                borderRadius: 8,
                padding: '8px 12px',
                cursor: 'pointer',
                border: `1px solid transparent`,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = C.border;
                e.currentTarget.style.background = '#252930';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.background = C.secondary;
              }}
            >
              <span style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{item.symbol}</span>
              <span style={{ color: C.grey, fontSize: 10 }}>
                {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: `1px solid ${C.border}` }} />

      {/* Model Status */}
      <div>
        <div style={{ color: C.grey, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', marginBottom: 10 }}>
          MODEL STATUS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* ARIMA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: C.secondary,
              borderRadius: 8,
              padding: '8px 12px',
            }}
            title={modelStatus.arima?.message || ''}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: arimaIndicator.dot,
                boxShadow: `0 0 6px ${arimaIndicator.dot}`,
                animation: modelStatus.arima?.status === 'loading' ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: C.white, fontSize: 12 }}>ARIMA Model</span>
            <span
              style={{
                marginLeft: 'auto',
                color: arimaIndicator.color,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {arimaIndicator.label}
            </span>
          </div>

          {/* LSTM */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: C.secondary,
              borderRadius: 8,
              padding: '8px 12px',
            }}
            title={modelStatus.lstm?.message || ''}
          >
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: lstmIndicator.dot,
                boxShadow: `0 0 6px ${lstmIndicator.dot}`,
                animation: modelStatus.lstm?.status === 'loading' ? 'pulse 1.2s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ color: C.white, fontSize: 12 }}>LSTM Model</span>
            <span
              style={{
                marginLeft: 'auto',
                color: lstmIndicator.color,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {lstmIndicator.label}
            </span>
          </div>
        </div>

        {/* Hint when LSTM is placeholder */}
        {modelStatus.lstm?.status === 'placeholder' && (
          <div
            style={{
              marginTop: 8,
              background: `${C.orange}11`,
              border: `1px solid ${C.orange}33`,
              borderRadius: 6,
              padding: '6px 10px',
              color: `${C.orange}CC`,
              fontSize: 10,
              lineHeight: 1.4,
            }}
          >
            Place <strong>lstm_stock_model.h5</strong> in <code style={{ fontSize: 9, background: `${C.bg}88`, padding: '1px 3px', borderRadius: 2 }}>backend/models/</code> for real LSTM predictions.
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </aside>
  );
}
