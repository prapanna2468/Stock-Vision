import { useState } from 'react';
import Plot from 'react-plotly.js';
import C from '../colors';

const TOGGLES = [
  { key: 'rsi', label: 'RSI', color: C.purple },
  { key: 'macd', label: 'MACD', color: C.teal },
  { key: 'bollinger', label: 'Bollinger Bands', color: C.grey },
];

// Strip nulls/NaN while keeping date-alignment
function cleanPairs(dates, values) {
  const d = [], v = [];
  for (let i = 0; i < dates.length; i++) {
    if (values[i] != null && !isNaN(values[i])) {
      d.push(dates[i]);
      v.push(values[i]);
    }
  }
  return { dates: d, values: v };
}

export default function TechnicalIndicators({ data }) {
  const [activeIndicators, setActiveIndicators] = useState(['rsi']);

  if (!data?.indicators) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 200,
        }}
      >
        <span style={{ color: C.grey, fontSize: 13 }}>Technical indicators will appear after forecast is generated.</span>
      </div>
    );
  }

  const { dates = [], indicators = {}, historical_prices: closes = [] } = data;
  const { rsi = [], macd = [], macd_signal = [], bollinger_upper = [], bollinger_lower = [] } = indicators;

  const toggleIndicator = (key) => {
    setActiveIndicators((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const showRsi = activeIndicators.includes('rsi');
  const showMacd = activeIndicators.includes('macd');
  const showBollinger = activeIndicators.includes('bollinger');

  // -- RSI CHART --
  const rsiClean = cleanPairs(dates, rsi);

  const rsiLayout = {
    autosize: true,
    paper_bgcolor: C.secondary,
    plot_bgcolor: C.secondary,
    font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    margin: { t: 10, r: 16, b: 40, l: 50 },
    height: 180,
    showlegend: false,
    xaxis: {
      color: C.grey,
      gridcolor: `${C.border}88`,
      linecolor: C.border,
      tickfont: { size: 9 },
    },
    yaxis: {
      color: C.grey,
      gridcolor: `${C.border}55`,
      linecolor: C.border,
      tickfont: { size: 9 },
      range: [0, 100],
    },
    shapes: rsiClean.dates.length > 0
      ? [
          {
            type: 'line', x0: rsiClean.dates[0], x1: rsiClean.dates[rsiClean.dates.length - 1],
            y0: 70, y1: 70,
            line: { color: `${C.red}88`, width: 1, dash: 'dash' },
          },
          {
            type: 'line', x0: rsiClean.dates[0], x1: rsiClean.dates[rsiClean.dates.length - 1],
            y0: 30, y1: 30,
            line: { color: `${C.green}88`, width: 1, dash: 'dash' },
          },
        ]
      : [],
    annotations: rsiClean.dates.length > 0
      ? [
          {
            x: rsiClean.dates[rsiClean.dates.length - 1], y: 70, xanchor: 'right',
            text: 'Overbought', showarrow: false,
            font: { color: C.red, size: 9 },
          },
          {
            x: rsiClean.dates[rsiClean.dates.length - 1], y: 30, xanchor: 'right',
            text: 'Oversold', showarrow: false,
            font: { color: C.green, size: 9 },
          },
        ]
      : [],
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: C.card,
      bordercolor: C.border,
      font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    },
  };

  const rsiTrace = {
    type: 'scatter',
    mode: 'lines',
    x: rsiClean.dates,
    y: rsiClean.values,
    name: 'RSI',
    line: { color: C.purple, width: 2 },
    fill: 'tozeroy',
    fillcolor: `${C.purple}18`,
  };

  // -- MACD CHART --
  const macdClean = cleanPairs(dates, macd);
  const signalClean = cleanPairs(dates, macd_signal);

  // Compute histogram diff only for valid aligned points
  const macdDiff = [];
  const macdDiffDates = [];
  const macdDiffColors = [];
  for (let i = 0; i < dates.length; i++) {
    const m = macd[i];
    const s = macd_signal[i];
    if (m != null && !isNaN(m) && s != null && !isNaN(s)) {
      const diff = m - s;
      macdDiff.push(diff);
      macdDiffDates.push(dates[i]);
      macdDiffColors.push(diff >= 0 ? `${C.green}CC` : `${C.red}CC`);
    }
  }

  const macdHistTrace = {
    type: 'bar',
    x: macdDiffDates,
    y: macdDiff,
    name: 'Histogram',
    marker: { color: macdDiffColors },
  };
  const macdLineTrace = {
    type: 'scatter',
    mode: 'lines',
    x: macdClean.dates,
    y: macdClean.values,
    name: 'MACD',
    line: { color: C.teal, width: 2 },
  };
  const signalTrace = {
    type: 'scatter',
    mode: 'lines',
    x: signalClean.dates,
    y: signalClean.values,
    name: 'Signal',
    line: { color: C.orange, width: 1.5, dash: 'dot' },
  };

  const macdLayout = {
    autosize: true,
    paper_bgcolor: C.secondary,
    plot_bgcolor: C.secondary,
    font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    margin: { t: 10, r: 16, b: 40, l: 50 },
    height: 180,
    showlegend: true,
    legend: {
      x: 0.01, y: 0.99,
      bgcolor: 'transparent',
      font: { size: 10, color: C.grey },
    },
    xaxis: {
      color: C.grey, gridcolor: `${C.border}88`,
      linecolor: C.border, tickfont: { size: 9 },
    },
    yaxis: {
      color: C.grey, gridcolor: `${C.border}55`,
      linecolor: C.border, tickfont: { size: 9 },
      zeroline: true, zerolinecolor: `${C.border}CC`, zerolinewidth: 1,
    },
    barmode: 'overlay',
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: C.card, bordercolor: C.border,
      font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    },
  };

  // -- Bollinger Bands CHART --
  const upperClean = cleanPairs(dates, bollinger_upper);
  const lowerClean = cleanPairs(dates, bollinger_lower);
  const closesClean = cleanPairs(dates, closes);

  const bollingerTraces = [
    {
      type: 'scatter', mode: 'lines', x: upperClean.dates, y: upperClean.values,
      name: 'Upper Band', line: { color: `${C.grey}88`, width: 1, dash: 'dot' },
    },
    {
      type: 'scatter', mode: 'lines', x: closesClean.dates, y: closesClean.values,
      name: 'Price', line: { color: C.white, width: 1.5 },
    },
    {
      type: 'scatter', mode: 'lines', x: lowerClean.dates, y: lowerClean.values,
      name: 'Lower Band', line: { color: `${C.grey}88`, width: 1, dash: 'dot' },
      fill: 'tonexty', fillcolor: `${C.grey}11`,
    },
  ];

  const bollingerLayout = {
    autosize: true,
    paper_bgcolor: C.secondary,
    plot_bgcolor: C.secondary,
    font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    margin: { t: 10, r: 16, b: 40, l: 60 },
    height: 180,
    showlegend: true,
    legend: {
      x: 0.01, y: 0.99, bgcolor: 'transparent',
      font: { size: 10, color: C.grey },
    },
    xaxis: {
      color: C.grey, gridcolor: `${C.border}88`,
      linecolor: C.border, tickfont: { size: 9 },
    },
    yaxis: {
      color: C.grey, gridcolor: `${C.border}55`,
      linecolor: C.border, tickfont: { size: 9 }, tickprefix: '$',
    },
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: C.card, bordercolor: C.border,
      font: { family: 'Inter, sans-serif', color: C.white, size: 10 },
    },
  };

  const plotConfig = {
    displayModeBar: false,
    responsive: true,
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>Technical Indicators</div>
          <div style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>Momentum, trend, and volatility analysis</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {TOGGLES.map(({ key, label, color }) => {
            const isActive = activeIndicators.includes(key);
            return (
              <button
                key={key}
                id={`indicator-toggle-${key}`}
                onClick={() => toggleIndicator(key)}
                style={{
                  background: isActive ? `${color}22` : C.secondary,
                  border: `1px solid ${isActive ? color : C.border}`,
                  borderRadius: 20,
                  color: isActive ? color : C.grey,
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {showRsi && (
          <div
            style={{
              background: C.secondary,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ color: C.purple, fontSize: 11, fontWeight: 600, padding: '8px 12px 0' }}>
              RSI (14)
            </div>
            <Plot
              data={[rsiTrace]}
              layout={rsiLayout}
              config={plotConfig}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>
        )}

        {showMacd && (
          <div
            style={{
              background: C.secondary,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ color: C.teal, fontSize: 11, fontWeight: 600, padding: '8px 12px 0' }}>
              MACD (12, 26, 9)
            </div>
            <Plot
              data={[macdHistTrace, macdLineTrace, signalTrace]}
              layout={macdLayout}
              config={plotConfig}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>
        )}

        {showBollinger && (
          <div
            style={{
              background: C.secondary,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ color: C.grey, fontSize: 11, fontWeight: 600, padding: '8px 12px 0' }}>
              Bollinger Bands (20, 2σ)
            </div>
            <Plot
              data={bollingerTraces}
              layout={bollingerLayout}
              config={plotConfig}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>
        )}

        {activeIndicators.length === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: C.grey,
              fontSize: 13,
            }}
          >
            Select one or more indicators to display.
          </div>
        )}
      </div>
    </div>
  );
}
