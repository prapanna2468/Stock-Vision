import { useState, useEffect } from 'react';
import C from '../colors';
import { fetchPrices } from '../services/api';

export default function PortfolioView({ onForecastSelect }) {
  // --- Portfolio State ---
  const [cash, setCash] = useState(100000.0);
  const [holdings, setHoldings] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [livePrices, setLivePrices] = useState({});

  // --- Form State ---
  const [formSymbol, setFormSymbol] = useState('');
  const [formShares, setFormShares] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formType, setFormType] = useState('BUY'); // BUY or SELL
  const [formError, setFormError] = useState('');

  // --- Load Portfolio from localStorage ---
  useEffect(() => {
    const savedCash = localStorage.getItem('stockvision_cash');
    const savedHoldings = localStorage.getItem('stockvision_holdings');
    const savedTransactions = localStorage.getItem('stockvision_transactions');

    if (savedCash !== null) setCash(parseFloat(savedCash));
    if (savedHoldings !== null) setHoldings(JSON.parse(savedHoldings));
    if (savedTransactions !== null) setTransactions(JSON.parse(savedTransactions));
  }, []);

  // --- Save Portfolio to localStorage ---
  const savePortfolio = (newCash, newHoldings, newTransactions) => {
    setCash(newCash);
    setHoldings(newHoldings);
    setTransactions(newTransactions);
    localStorage.setItem('stockvision_cash', newCash.toString());
    localStorage.setItem('stockvision_holdings', JSON.stringify(newHoldings));
    localStorage.setItem('stockvision_transactions', JSON.stringify(newTransactions));
  };

  // --- Fetch Live Prices ---
  useEffect(() => {
    if (holdings.length === 0) {
      setLivePrices({});
      return;
    }

    const symbols = holdings.map((h) => h.symbol);
    let active = true;

    async function loadPrices() {
      try {
        const data = await fetchPrices(symbols.join(','));
        if (active) {
          setLivePrices(data);
        }
      } catch (err) {
        console.error('Failed to load portfolio live prices:', err);
      }
    }

    loadPrices();
    // Refresh every 30 seconds
    const interval = setInterval(loadPrices, 30000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [holdings]);

  // --- Handle Buy/Sell Transaction ---
  const handleExecute = (e) => {
    e.preventDefault();
    setFormError('');

    const symbol = formSymbol.trim().toUpperCase();
    const shares = parseInt(formShares);
    const price = parseFloat(formPrice);

    if (!symbol) return setFormError('Please enter a stock symbol.');
    if (isNaN(shares) || shares <= 0) return setFormError('Shares must be a positive integer.');
    if (isNaN(price) || price <= 0) return setFormError('Price must be a positive number.');

    const totalValue = shares * price;

    if (formType === 'BUY') {
      if (totalValue > cash) {
        return setFormError(`Insufficient cash. Buying this requires $${totalValue.toFixed(2)}, but you only have $${cash.toFixed(2)}.`);
      }

      // Update cash
      const newCash = cash - totalValue;

      // Update holdings
      const existingHoldingIdx = holdings.findIndex((h) => h.symbol === symbol);
      let newHoldings = [...holdings];

      if (existingHoldingIdx >= 0) {
        const existing = holdings[existingHoldingIdx];
        const newShares = existing.shares + shares;
        const newAvgPrice = (existing.shares * existing.buyPrice + totalValue) / newShares;
        newHoldings[existingHoldingIdx] = {
          symbol,
          shares: newShares,
          buyPrice: parseFloat(newAvgPrice.toFixed(4)),
        };
      } else {
        newHoldings.push({ symbol, shares, buyPrice: price });
      }

      // Add transaction log
      const newTx = {
        id: Date.now().toString(),
        symbol,
        shares,
        price,
        type: 'BUY',
        date: new Date().toLocaleString(),
      };

      savePortfolio(newCash, newHoldings, [newTx, ...transactions]);
    } else {
      // SELL
      const existingHoldingIdx = holdings.findIndex((h) => h.symbol === symbol);
      if (existingHoldingIdx < 0 || holdings[existingHoldingIdx].shares < shares) {
        return setFormError(`Insufficient shares. You only own ${existingHoldingIdx >= 0 ? holdings[existingHoldingIdx].shares : 0} shares of ${symbol}.`);
      }

      const existing = holdings[existingHoldingIdx];
      const newCash = cash + totalValue;
      let newHoldings = [...holdings];

      if (existing.shares === shares) {
        // Remove holding entirely
        newHoldings.splice(existingHoldingIdx, 1);
      } else {
        // Reduce shares
        newHoldings[existingHoldingIdx] = {
          ...existing,
          shares: existing.shares - shares,
        };
      }

      // Add transaction log
      const newTx = {
        id: Date.now().toString(),
        symbol,
        shares,
        price,
        type: 'SELL',
        date: new Date().toLocaleString(),
      };

      savePortfolio(newCash, newHoldings, [newTx, ...transactions]);
    }

    // Reset Form
    setFormSymbol('');
    setFormShares('');
    setFormPrice('');
    setFormError('');
  };

  // --- Reset Entire Portfolio ---
  const handleResetPortfolio = () => {
    if (window.confirm('Are you sure you want to reset your portfolio and transaction history back to $100,000 cash?')) {
      savePortfolio(100000.0, [], []);
      setLivePrices({});
    }
  };

  // --- Calculations ---
  const totalMarketValue = holdings.reduce((sum, h) => {
    const currentPrice = livePrices[h.symbol] ?? h.buyPrice;
    return sum + h.shares * currentPrice;
  }, 0.0);

  const totalCost = holdings.reduce((sum, h) => sum + h.shares * h.buyPrice, 0.0);
  const totalPortfolioValue = cash + totalMarketValue;
  const startingCapital = 100000.0;
  const totalGainLoss = totalPortfolioValue - startingCapital;
  const totalGainLossPercent = (totalGainLoss / startingCapital) * 100;
  const profitColor = totalGainLoss >= 0 ? C.green : C.red;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: C.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Portfolio Simulator</h1>
          <p style={{ color: C.grey, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Mock buy/sell transactions and track returns with simulated live pricing (persisted in local storage).
          </p>
        </div>
        <button
          onClick={handleResetPortfolio}
          style={{
            background: 'transparent',
            border: `1px solid ${C.red}66`,
            color: C.red,
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `${C.red}18`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Reset Portfolio
        </button>
      </div>

      {/* Grid Indicators */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {/* Total Value */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.grey, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Portfolio Value
          </div>
          <div style={{ color: C.white, fontSize: 22, fontWeight: 700, marginTop: 8 }}>
            ${totalPortfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {/* Cash Balance */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.grey, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Buying Power (Cash)
          </div>
          <div style={{ color: C.white, fontSize: 22, fontWeight: 700, marginTop: 8 }}>
            ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {/* Stock Assets */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.grey, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Invested Value
          </div>
          <div style={{ color: C.white, fontSize: 22, fontWeight: 700, marginTop: 8 }}>
            ${totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        {/* Total P&L */}
        <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16 }}>
          <div style={{ color: C.grey, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Return
          </div>
          <div style={{ color: profitColor, fontSize: 22, fontWeight: 700, marginTop: 8 }}>
            {totalGainLoss >= 0 ? '+' : ''}
            ${totalGainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 6, opacity: 0.85 }}>
              ({totalGainLossPercent >= 0 ? '+' : ''}
              {totalGainLossPercent.toFixed(2)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Main Layout: Left = Holdings, Right = Form + History */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, alignItems: 'start' }}>
        {/* Left column: Holdings */}
        <div
          style={{
            background: C.card,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>Current Positions</div>
          {holdings.length === 0 ? (
            <div style={{ color: C.grey, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              No holdings in portfolio. Use the form on the right to execute your first mock purchase!
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, background: `${C.bg}33` }}>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600 }}>TICKER</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>SHARES</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>AVG COST</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>LIVE PRICE</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>TOTAL COST</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>VALUE</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>GAIN/LOSS</th>
                    <th style={{ padding: '10px 12px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => {
                    const livePrice = livePrices[h.symbol] ?? h.buyPrice;
                    const costVal = h.shares * h.buyPrice;
                    const marketVal = h.shares * livePrice;
                    const gainVal = marketVal - costVal;
                    const gainPercent = costVal > 0 ? (gainVal / costVal) * 100 : 0.0;
                    const cellColor = gainVal >= 0 ? C.green : C.red;

                    return (
                      <tr key={h.symbol} style={{ borderBottom: `1px solid ${C.border}` }}>
                        <td style={{ padding: '12px', color: C.white, fontWeight: 700, fontSize: 13 }}>
                          <span
                            style={{
                              background: `${C.blue}12`,
                              color: C.blue,
                              padding: '2px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {h.symbol}
                          </span>
                        </td>
                        <td style={{ padding: '12px', color: C.white, fontSize: 13, textAlign: 'right' }}>
                          {h.shares}
                        </td>
                        <td style={{ padding: '12px', color: C.grey, fontSize: 13, textAlign: 'right' }}>
                          ${h.buyPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', color: C.white, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                          ${livePrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', color: C.grey, fontSize: 13, textAlign: 'right' }}>
                          ${costVal.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', color: C.white, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                          ${marketVal.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px', color: cellColor, fontSize: 13, fontWeight: 600, textAlign: 'right' }}>
                          {gainVal >= 0 ? '+' : ''}
                          ${gainVal.toFixed(2)}
                          <div style={{ fontSize: 11, opacity: 0.8 }}>
                            ({gainPercent >= 0 ? '+' : ''}
                            {gainPercent.toFixed(2)}%)
                          </div>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                            <button
                              onClick={() => onForecastSelect(h.symbol)}
                              style={{
                                background: C.secondary,
                                border: `1px solid ${C.border}`,
                                color: C.blue,
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Forecast
                            </button>
                            <button
                              onClick={() => {
                                setFormSymbol(h.symbol);
                                setFormType('SELL');
                                setFormShares(h.shares.toString());
                                setFormPrice(livePrice.toFixed(2));
                              }}
                              style={{
                                background: 'transparent',
                                border: `1px solid ${C.border}`,
                                color: C.orange,
                                fontSize: 11,
                                fontWeight: 600,
                                padding: '4px 8px',
                                borderRadius: 4,
                                cursor: 'pointer',
                              }}
                            >
                              Sell
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Form and history */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Transaction Form Card */}
          <div
            style={{
              background: C.card,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: 20,
            }}
          >
            <div style={{ color: C.white, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              New Transaction
            </div>

            <form onSubmit={handleExecute} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Buy/Sell Switcher */}
              <div style={{ display: 'flex', gap: 8, background: C.secondary, padding: 4, borderRadius: 8 }}>
                {['BUY', 'SELL'].map((type) => {
                  const isSel = type === formType;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFormType(type)}
                      style={{
                        flex: 1,
                        background: isSel ? (type === 'BUY' ? C.blue : C.orange) : 'transparent',
                        border: 'none',
                        borderRadius: 6,
                        color: C.white,
                        fontWeight: 600,
                        fontSize: 12,
                        padding: '6px 0',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>

              {/* Ticker */}
              <div>
                <label style={{ display: 'block', color: C.grey, fontSize: 11, marginBottom: 4 }}>TICKER</label>
                <input
                  type="text"
                  placeholder="e.g. AAPL"
                  value={formSymbol}
                  onChange={(e) => setFormSymbol(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: C.secondary,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.white,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'Inter, sans-serif',
                  }}
                />
              </div>

              {/* Shares & Price row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', color: C.grey, fontSize: 11, marginBottom: 4 }}>SHARES</label>
                  <input
                    type="number"
                    placeholder="Quantity"
                    value={formShares}
                    onChange={(e) => setFormShares(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: C.secondary,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.white,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: C.grey, fontSize: 11, marginBottom: 4 }}>PRICE ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Price per share"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      background: C.secondary,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.white,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  />
                </div>
              </div>

              {formError && (
                <div style={{ color: C.red, fontSize: 11, marginTop: 4 }}>
                  ⚠️ {formError}
                </div>
              )}

              <button
                type="submit"
                style={{
                  background: formType === 'BUY' ? C.blue : C.orange,
                  border: 'none',
                  borderRadius: 8,
                  color: C.white,
                  fontWeight: 600,
                  fontSize: 13,
                  padding: '10px 0',
                  marginTop: 8,
                  cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.9)}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
              >
                {formType === 'BUY' ? 'Buy Asset' : 'Sell Asset'}
              </button>
            </form>
          </div>

          {/* Transaction History Card */}
          <div
            style={{
              background: C.card,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: 20,
              maxHeight: 340,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>History</div>
            {transactions.length === 0 ? (
              <div style={{ color: C.grey, fontSize: 12, textAlign: 'center', padding: '20px 0' }}>
                No transaction history.
              </div>
            ) : (
              <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {transactions.map((tx) => {
                  const isBuy = tx.type === 'BUY';
                  return (
                    <div
                      key={tx.id}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        paddingBottom: 8,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              color: C.white,
                              background: isBuy ? `${C.blue}22` : `${C.orange}22`,
                              color: isBuy ? C.blue : C.orange,
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 4px',
                              borderRadius: 4,
                            }}
                          >
                            {tx.type}
                          </span>
                          <span style={{ color: C.white, fontWeight: 600, fontSize: 13 }}>
                            {tx.symbol}
                          </span>
                        </div>
                        <div style={{ color: C.grey, fontSize: 10, marginTop: 4 }}>{tx.date}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: C.white, fontSize: 12, fontWeight: 600 }}>
                          {tx.shares} @ ${tx.price.toFixed(2)}
                        </div>
                        <div style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>
                          ${(tx.shares * tx.price).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
