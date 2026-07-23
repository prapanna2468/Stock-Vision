import C from '../colors';

export default function ReportsView({ currentStockData, activeSymbol }) {
  if (!currentStockData) {
    return (
      <div
        style={{
          background: C.card,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: 48,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span style={{ display: 'inline-block' }}><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#8F97A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 14 11 10 14 13 17 8"/></svg></span>
        <h2 style={{ color: C.white, margin: 0, fontSize: 20 }}>No Forecast Loaded</h2>
        <p style={{ color: C.grey, fontSize: 13, maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
          Before generating an analysis report, you must search and run a forecast for a stock on the **Dashboard** tab.
        </p>
      </div>
    );
  }

  const data = currentStockData;
  const symbol = data.symbol;
  const historical = data.historical_prices;
  const latestClose = historical[historical.length - 1];

  // ARIMA stats
  const arimaTarget = data.arima_predictions[data.arima_predictions.length - 1];
  const arimaChange = ((arimaTarget - latestClose) / latestClose) * 100;
  const arimaSignal = arimaChange > 1.0 ? 'Bullish' : arimaChange < -1.0 ? 'Bearish' : 'Neutral';

  // LSTM stats
  const lstmTarget = data.lstm_predictions[data.lstm_predictions.length - 1];
  const lstmChange = ((lstmTarget - latestClose) / latestClose) * 100;
  const lstmSignal = lstmChange > 1.0 ? 'Bullish' : lstmChange < -1.0 ? 'Bearish' : 'Neutral';

  // Technical Indicators
  const latestRsi = data.indicators.rsi[data.indicators.rsi.length - 1];
  let rsiSignal = 'Neutral';
  if (latestRsi >= 70) rsiSignal = 'Overbought';
  else if (latestRsi <= 30) rsiSignal = 'Oversold';

  const latestMacd = data.indicators.macd[data.indicators.macd.length - 1];
  const latestSignal = data.indicators.macd_signal[data.indicators.macd_signal.length - 1];
  const macdDiff = latestMacd - latestSignal;
  const macdSignal = macdDiff > 0.05 ? 'Bullish' : macdDiff < -0.05 ? 'Bearish' : 'Neutral';

  const upperB = data.indicators.bollinger_upper[data.indicators.bollinger_upper.length - 1];
  const lowerB = data.indicators.bollinger_lower[data.indicators.bollinger_lower.length - 1];
  let bbSignal = 'Neutral';
  if (latestClose >= upperB * 0.97) bbSignal = 'Overbought';
  else if (latestClose <= lowerB * 1.03) bbSignal = 'Oversold';

  // Score Calculations
  let score = 0;
  if (arimaSignal === 'Bullish') score += 2;
  if (arimaSignal === 'Bearish') score -= 2;
  if (lstmSignal === 'Bullish') score += 2;
  if (lstmSignal === 'Bearish') score -= 2;
  if (rsiSignal === 'Oversold') score += 1;
  if (rsiSignal === 'Overbought') score -= 1;
  if (macdSignal === 'Bullish') score += 1;
  if (macdSignal === 'Bearish') score -= 1;
  if (bbSignal === 'Oversold') score += 1;
  if (bbSignal === 'Overbought') score -= 1;

  let rating = 'Hold';
  let ratingColor = C.orange;
  let ratingText = 'Hold / Neutral';
  let needleAngle = 0; // -90 (Strong Sell) to +90 (Strong Buy)

  if (score >= 4) {
    rating = 'Strong Buy';
    ratingColor = C.green;
    ratingText = 'Strong Outperform / Buy';
    needleAngle = 70;
  } else if (score >= 1) {
    rating = 'Buy';
    ratingColor = '#10B981'; // light green
    ratingText = 'Outperform / Buy';
    needleAngle = 35;
  } else if (score <= -4) {
    rating = 'Strong Sell';
    ratingColor = C.red;
    ratingText = 'Underperform / Sell';
    needleAngle = -70;
  } else if (score <= -1) {
    rating = 'Sell';
    ratingColor = '#F43F5E'; // rose/orange-red
    ratingText = 'Underperform / Reduce';
    needleAngle = -35;
  } else {
    rating = 'Hold';
    ratingColor = C.orange;
    ratingText = 'Market Perform / Neutral';
    needleAngle = 0;
  }

  // Handle Printing
  const triggerPrint = () => {
    window.print();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* CSS overrides for printing */}
      <style>{`
        @media print {
          /* Hide everything except the print container */
          header, nav, aside, button, .no-print {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
            padding: 0 !important;
            margin-top: 0 !important;
          }
          .print-card {
            background: #ffffff !important;
            color: #000000 !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          .print-text-white {
            color: #000000 !important;
          }
          .print-text-grey {
            color: #444444 !important;
          }
          .print-border {
            border: 1px solid #dddddd !important;
            border-color: #dddddd !important;
          }
          .print-row-bg {
            background: #f8f9fa !important;
          }
        }
      `}</style>

      {/* Screen Header / Controls */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ color: C.white, fontSize: 24, fontWeight: 700, margin: 0 }}>Technical Report</h1>
          <p style={{ color: C.grey, fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            Comprehensive scorecard and investment consensus based on AI models and technical gauges.
          </p>
        </div>
        <button
          onClick={triggerPrint}
          style={{
            background: C.blue,
            border: 'none',
            color: C.white,
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = 0.9)}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = 1)}
        >
          Print / Save PDF
        </button>
      </div>

      {/* Main Report Document */}
      <div
        className="print-card"
        style={{
          background: C.card,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Document Header */}
        <div
          style={{
            borderBottom: `1px solid ${C.border}`,
            paddingBottom: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
          className="print-border"
        >
          <div>
            <h2 className="print-text-white" style={{ color: C.white, fontSize: 20, fontWeight: 700, margin: 0 }}>
              {symbol} Consensus Analysis Report
            </h2>
            <div className="print-text-grey" style={{ color: C.grey, fontSize: 11, marginTop: 4 }}>
              Generated on {new Date().toLocaleDateString()} • Real-time Technical Review
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="print-text-white" style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>
              Latest Closing Rate:
            </div>
            <div className="print-text-white" style={{ color: C.blue, fontSize: 20, fontWeight: 700, marginTop: 2 }}>
              ${latestClose.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Dial Score Panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'center' }}>
          {/* Dial Graphic */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
            <svg width="240" height="130" viewBox="0 0 240 130">
              {/* Semi-circle segments */}
              {/* Arc radius 90, center x=120, y=110 */}
              {/* Strong Sell (Red) */}
              <path d="M 30,110 A 90,90 0 0,1 54.1,46.3 L 72.1,60.3 A 60,60 0 0,0 56,110 Z" fill={C.red} opacity="0.85" />
              {/* Sell (Rose) */}
              <path d="M 54.1,46.3 A 90,90 0 0,1 97.4,22.6 L 104.7,42.5 A 60,60 0 0,0 72.1,60.3 Z" fill="#F43F5E" opacity="0.85" />
              {/* Hold (Orange) */}
              <path d="M 97.4,22.6 A 90,90 0 0,1 142.6,22.6 L 135.3,42.5 A 60,60 0 0,0 104.7,42.5 Z" fill={C.orange} opacity="0.85" />
              {/* Buy (Light Green) */}
              <path d="M 142.6,22.6 A 90,90 0 0,1 185.9,46.3 L 167.9,60.3 A 60,60 0 0,0 135.3,42.5 Z" fill="#10B981" opacity="0.85" />
              {/* Strong Buy (Green) */}
              <path d="M 185.9,46.3 A 90,90 0 0,1 210,110 L 184,110 A 60,60 0 0,0 167.9,60.3 Z" fill={C.green} opacity="0.85" />

              {/* Needle center */}
              <circle cx="120" cy="110" r="10" fill="#EBEff5" />
              {/* Needle pointer */}
              <polygon
                points="116,110 120,25 124,110"
                fill="#EBEff5"
                transform={`rotate(${needleAngle}, 120, 110)`}
                style={{ transition: 'transform 0.8s ease-in-out' }}
              />
            </svg>
            <div className="print-text-white" style={{ color: ratingColor, fontSize: 20, fontWeight: 800, marginTop: 8 }}>
              {rating.toUpperCase()}
            </div>
            <div className="print-text-grey" style={{ color: C.grey, fontSize: 12, marginTop: 2 }}>
              Consensus Score: {score > 0 ? `+${score}` : score} / 7
            </div>
          </div>

          {/* Commentary & Summary */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="print-text-white" style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>
              Executive Rating Summary
            </div>
            <p
              className="print-text-grey"
              style={{ color: C.grey, fontSize: 13, lineHeight: 1.6, margin: 0, textAlign: 'justify' }}
            >
              The composite indicator rating for <strong>{symbol}</strong> suggests a <strong>{ratingText}</strong>.
              Over the next 17 business days, the ARIMA model predicts a price trajectory target of{' '}
              <strong>${arimaTarget.toFixed(2)}</strong> ({arimaChange >= 0 ? '+' : ''}
              {arimaChange.toFixed(2)}%), while the LSTM model maps an ultimate price target of{' '}
              <strong>${lstmTarget.toFixed(2)}</strong> ({lstmChange >= 0 ? '+' : ''}
              {lstmChange.toFixed(2)}%).
            </p>
            <p
              className="print-text-grey"
              style={{ color: C.grey, fontSize: 13, lineHeight: 1.6, margin: 0, textAlign: 'justify' }}
            >
              Technically, the Relative Strength Index (RSI) registers at <strong>{latestRsi.toFixed(1)}</strong>,
              signaling <strong>{rsiSignal || 'Neutral'}</strong> conditions. The MACD momentum oscillator
              is currently indicating a <strong>{macdSignal}</strong> signal, while the stock is trading in a{' '}
              <strong>{bbSignal}</strong> zone relative to its Bollinger Bands boundaries.
            </p>
          </div>
        </div>

        {/* Breakdown Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="print-text-white" style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>
            Analytical Score Breakdown
          </div>
          <div
            className="print-border"
            style={{
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
              <thead>
                <tr
                  className="print-row-bg"
                  style={{ borderBottom: `1px solid ${C.border}`, background: `${C.bg}66` }}
                >
                  <th style={{ padding: '12px 16px', color: C.grey, fontSize: 11, fontWeight: 600 }}>INDICATOR</th>
                  <th style={{ padding: '12px 16px', color: C.grey, fontSize: 11, fontWeight: 600 }}>CURRENT VALUE / STATE</th>
                  <th style={{ padding: '12px 16px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'center' }}>DIRECTION</th>
                  <th style={{ padding: '12px 16px', color: C.grey, fontSize: 11, fontWeight: 600, textAlign: 'right' }}>SCORE IMPACT</th>
                </tr>
              </thead>
              <tbody>
                {/* ARIMA */}
                <tr className="print-border" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="print-text-white" style={{ padding: '12px 16px', color: C.white, fontWeight: 600 }}>ARIMA Model</td>
                  <td className="print-text-grey" style={{ padding: '12px 16px', color: C.grey }}>
                    Target: ${arimaTarget.toFixed(2)} ({arimaChange >= 0 ? '+' : ''}
                    {arimaChange.toFixed(2)}%)
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        color: arimaSignal === 'Bullish' ? C.green : arimaSignal === 'Bearish' ? C.red : C.orange,
                        fontWeight: 600,
                      }}
                    >
                      {arimaSignal}
                    </span>
                  </td>
                  <td
                    className="print-text-white"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: arimaSignal === 'Bullish' ? C.green : arimaSignal === 'Bearish' ? C.red : C.white,
                    }}
                  >
                    {arimaSignal === 'Bullish' ? '+2' : arimaSignal === 'Bearish' ? '-2' : '0'}
                  </td>
                </tr>

                {/* LSTM */}
                <tr className="print-border" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="print-text-white" style={{ padding: '12px 16px', color: C.white, fontWeight: 600 }}>LSTM Model</td>
                  <td className="print-text-grey" style={{ padding: '12px 16px', color: C.grey }}>
                    Target: ${lstmTarget.toFixed(2)} ({lstmChange >= 0 ? '+' : ''}
                    {lstmChange.toFixed(2)}%)
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        color: lstmSignal === 'Bullish' ? C.green : lstmSignal === 'Bearish' ? C.red : C.orange,
                        fontWeight: 600,
                      }}
                    >
                      {lstmSignal}
                    </span>
                  </td>
                  <td
                    className="print-text-white"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: lstmSignal === 'Bullish' ? C.green : lstmSignal === 'Bearish' ? C.red : C.white,
                    }}
                  >
                    {lstmSignal === 'Bullish' ? '+2' : lstmSignal === 'Bearish' ? '-2' : '0'}
                  </td>
                </tr>

                {/* RSI */}
                <tr className="print-border" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="print-text-white" style={{ padding: '12px 16px', color: C.white, fontWeight: 600 }}>Relative Strength (RSI)</td>
                  <td className="print-text-grey" style={{ padding: '12px 16px', color: C.grey }}>Value: {latestRsi.toFixed(2)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        color: rsiSignal === 'Oversold' ? C.green : rsiSignal === 'Overbought' ? C.red : C.grey,
                        fontWeight: 600,
                      }}
                    >
                      {rsiSignal || 'Neutral'}
                    </span>
                  </td>
                  <td
                    className="print-text-white"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: rsiSignal === 'Oversold' ? C.green : rsiSignal === 'Overbought' ? C.red : C.white,
                    }}
                  >
                    {rsiSignal === 'Oversold' ? '+1' : rsiSignal === 'Overbought' ? '-1' : '0'}
                  </td>
                </tr>

                {/* MACD */}
                <tr className="print-border" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td className="print-text-white" style={{ padding: '12px 16px', color: C.white, fontWeight: 600 }}>MACD Oscillator</td>
                  <td className="print-text-grey" style={{ padding: '12px 16px', color: C.grey }}>Diff: {macdDiff.toFixed(4)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        color: macdSignal === 'Bullish' ? C.green : macdSignal === 'Bearish' ? C.red : C.grey,
                        fontWeight: 600,
                      }}
                    >
                      {macdSignal}
                    </span>
                  </td>
                  <td
                    className="print-text-white"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: macdSignal === 'Bullish' ? C.green : macdSignal === 'Bearish' ? C.red : C.white,
                    }}
                  >
                    {macdSignal === 'Bullish' ? '+1' : macdSignal === 'Bearish' ? '-1' : '0'}
                  </td>
                </tr>

                {/* Bollinger Bands */}
                <tr className="print-border">
                  <td className="print-text-white" style={{ padding: '12px 16px', color: C.white, fontWeight: 600 }}>Bollinger Bands</td>
                  <td className="print-text-grey" style={{ padding: '12px 16px', color: C.grey }}>
                    Bands: [${lowerB.toFixed(2)} - ${upperB.toFixed(2)}]
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span
                      style={{
                        color: bbSignal === 'Oversold' ? C.green : bbSignal === 'Overbought' ? C.red : C.grey,
                        fontWeight: 600,
                      }}
                    >
                      {bbSignal}
                    </span>
                  </td>
                  <td
                    className="print-text-white"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 600,
                      color: bbSignal === 'Oversold' ? C.green : bbSignal === 'Overbought' ? C.red : C.white,
                    }}
                  >
                    {bbSignal === 'Oversold' ? '+1' : bbSignal === 'Overbought' ? '-1' : '0'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Disclaimer Footer */}
        <div
          style={{
            marginTop: 12,
            borderTop: `1px solid ${C.border}`,
            paddingTop: 16,
            color: C.grey,
            fontSize: 10,
            lineHeight: 1.4,
          }}
          className="print-border print-text-grey"
        >
          <strong>Disclaimer:</strong> This report is for educational and demonstration purposes only. StockVision
          uses historical data queries and mathematical model simulations (ARIMA and LSTM) to project speculative
          market patterns. It does not constitute formal financial advice or recommendation. Invest at your own risk.
        </div>
      </div>
    </div>
  );
}
