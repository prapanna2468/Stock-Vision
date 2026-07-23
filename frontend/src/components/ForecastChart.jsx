import Plot from 'react-plotly.js';
import C from '../colors';

// Filter out null/NaN from trace arrays while keeping date alignment
function cleanTraceData(x, y) {
  const cleanX = [];
  const cleanY = [];
  for (let i = 0; i < x.length; i++) {
    if (y[i] != null && !isNaN(y[i])) {
      cleanX.push(x[i]);
      cleanY.push(y[i]);
    }
  }
  return { x: cleanX, y: cleanY };
}

export default function ForecastChart({ data }) {
  if (!data) {
    return (
      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: 420,
          gap: 12,
        }}
      >
        <div style={{ fontSize: 36 }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#8F97A6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="7 14 11 10 14 13 17 8"/></svg></div>
        <div style={{ color: C.grey, fontSize: 14 }}>Enter a stock symbol and click Generate Forecast</div>
      </div>
    );
  }

  const {
    dates = [],
    historical_prices: rawCloses = [],
    opens: rawOpens = [],
    highs: rawHighs = [],
    lows: rawLows = [],
    forecast_dates: fDates = [],
    arima_predictions: arima = [],
    lstm_predictions: lstm = [],
    arima_past_predictions: arimaPast = [],
    arima_past_dates: arimaPastDates = [],
    lstm_past_predictions: lstmPast = [],
    lstm_past_dates: lstmPastDates = [],
    prediction_sources: predictionSources = {},
  } = data;

  // Clean null/NaN from historical data
  const closes = rawCloses.map((v) => (v == null || isNaN(v) ? null : v));
  const opens = rawOpens.map((v) => (v == null || isNaN(v) ? null : v));
  const highs = rawHighs.map((v) => (v == null || isNaN(v) ? null : v));
  const lows = rawLows.map((v) => (v == null || isNaN(v) ? null : v));

  // Find valid data points for candlestick
  const validIndices = [];
  for (let i = 0; i < dates.length; i++) {
    if (closes[i] != null) validIndices.push(i);
  }
  const validDates = validIndices.map((i) => dates[i]);
  const validCloses = validIndices.map((i) => closes[i]);
  const validOpens = validIndices.map((i) => opens[i] ?? closes[i]);
  const validHighs = validIndices.map((i) => highs[i] ?? closes[i] * 1.005);
  const validLows = validIndices.map((i) => lows[i] ?? closes[i] * 0.995);

  // Candlestick — historical
  const candlestick = {
    type: 'candlestick',
    x: validDates,
    open: validOpens,
    high: validHighs,
    low: validLows,
    close: validCloses,
    name: 'Historical',
    increasing: { line: { color: '#22C55E', width: 1 }, fillcolor: '#22C55E44' },
    decreasing: { line: { color: '#EF4444', width: 1 }, fillcolor: '#EF444444' },
    showlegend: true,
    whiskerwidth: 0.5,
  };

  // ARIMA past predictions (backtest)
  const arimaPastClean = cleanTraceData(arimaPastDates, arimaPast);
  const arimaPastTrace = {
    type: 'scatter',
    mode: 'lines',
    x: arimaPastClean.x,
    y: arimaPastClean.y,
    name: `ARIMA Past Pred (${predictionSources.arima_past || 'unknown'})`,
    line: { color: C.blue, width: 1.5, shape: 'spline' },
    opacity: 0.4,
    showlegend: true,
  };

  // LSTM past predictions (backtest)
  const lstmPastClean = cleanTraceData(lstmPastDates, lstmPast);
  const lstmPastTrace = {
    type: 'scatter',
    mode: 'lines',
    x: lstmPastClean.x,
    y: lstmPastClean.y,
    name: `LSTM Past Pred (${predictionSources.lstm_past || 'unknown'})`,
    line: { color: C.orange, width: 1.5, shape: 'spline' },
    opacity: 0.4,
    showlegend: true,
  };

  // ARIMA forecast
  const arimaClean = cleanTraceData(fDates, arima);
  const arimaTrace = {
    type: 'scatter',
    mode: 'lines+markers',
    x: arimaClean.x,
    y: arimaClean.y,
    name: 'ARIMA Forecast',
    line: { color: C.blue, width: 2.5, dash: 'dash' },
    marker: { color: C.blue, size: 4 },
    showlegend: true,
  };

  // LSTM forecast
  const lstmClean = cleanTraceData(fDates, lstm);
  const lstmTrace = {
    type: 'scatter',
    mode: 'lines+markers',
    x: lstmClean.x,
    y: lstmClean.y,
    name: 'LSTM Forecast',
    line: { color: C.orange, width: 2.5, dash: 'dot' },
    marker: { color: C.orange, size: 4 },
    showlegend: true,
  };

  // Vertical line shape
  const firstForecastDate = fDates[0] || validDates[validDates.length - 1];
  const lastHistDate = validDates[validDates.length - 1];
  const lastClosePrice = validCloses[validCloses.length - 1];

  // Build plot data: candlestick, past predictions, then future forecasts
  const plotData = [candlestick];
  if (arimaPastClean.y.length > 0) plotData.push(arimaPastTrace);
  if (lstmPastClean.y.length > 0) plotData.push(lstmPastTrace);
  plotData.push(arimaTrace, lstmTrace);

  // Bridge — connect last historical to first forecast
  if (lastHistDate && arimaClean.y.length > 0) {
    plotData.push({
      type: 'scatter',
      mode: 'lines',
      x: [lastHistDate, arimaClean.x[0]],
      y: [lastClosePrice, arimaClean.y[0]],
      line: { color: C.blue, width: 2, dash: 'dash' },
      showlegend: false,
      hoverinfo: 'skip',
    });
  }
  if (lastHistDate && lstmClean.y.length > 0) {
    plotData.push({
      type: 'scatter',
      mode: 'lines',
      x: [lastHistDate, lstmClean.x[0]],
      y: [lastClosePrice, lstmClean.y[0]],
      line: { color: C.orange, width: 2, dash: 'dot' },
      showlegend: false,
      hoverinfo: 'skip',
    });
  }

  const layout = {
    autosize: true,
    paper_bgcolor: C.card,
    plot_bgcolor: C.card,
    font: { family: 'Inter, sans-serif', color: C.white, size: 11 },
    margin: { t: 20, r: 20, b: 50, l: 70 },
    showlegend: true,
    legend: {
      x: 0.01,
      y: 0.99,
      bgcolor: `${C.secondary}CC`,
      bordercolor: C.border,
      borderwidth: 1,
      font: { size: 11, color: C.white },
    },
    xaxis: {
      color: C.grey,
      gridcolor: `${C.border}88`,
      linecolor: C.border,
      tickfont: { size: 10 },
      rangeslider: { visible: false },
      showspikes: true,
      spikecolor: `${C.blue}88`,
      spikemode: 'across',
      spikethickness: 1,
    },
    yaxis: {
      color: C.grey,
      gridcolor: `${C.border}55`,
      linecolor: C.border,
      tickfont: { size: 10 },
      tickprefix: '$',
      showspikes: true,
      spikecolor: `${C.blue}88`,
      spikethickness: 1,
    },
    shapes: firstForecastDate
      ? [
          {
            type: 'line',
            x0: firstForecastDate,
            x1: firstForecastDate,
            y0: 0,
            y1: 1,
            yref: 'paper',
            line: { color: `${C.blue}99`, width: 1.5, dash: 'dot' },
          },
        ]
      : [],
    annotations: firstForecastDate
      ? [
          {
            x: firstForecastDate,
            y: 1,
            yref: 'paper',
            text: '  Forecast →',
            showarrow: false,
            font: { color: C.blue, size: 11, family: 'Inter, sans-serif' },
            xanchor: 'left',
          },
        ]
      : [],
    hovermode: 'x unified',
    hoverlabel: {
      bgcolor: C.secondary,
      bordercolor: C.border,
      font: { family: 'Inter, sans-serif', color: C.white, size: 11 },
    },
  };

  const config = {
    displayModeBar: true,
    modeBarButtonsToRemove: ['select2d', 'lasso2d', 'autoScale2d'],
    displaylogo: false,
    responsive: true,
  };

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'visible',
        minHeight: 460,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px 10px',
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div>
          <div style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>Price History + Forecast</div>
          <div style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>Candlestick with ARIMA & LSTM projections · past predictions overlaid</div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { color: C.grey, label: 'Historical' },
            ...(arimaPastClean.y.length > 0 ? [{ color: C.blue, label: `ARIMA Past (${predictionSources.arima_past || 'unknown'})`, opacity: 0.4 }] : []),
            ...(lstmPastClean.y.length > 0 ? [{ color: C.orange, label: `LSTM Past (${predictionSources.lstm_past || 'unknown'})`, opacity: 0.4 }] : []),
            { color: C.blue, label: 'ARIMA Forecast' },
            { color: C.orange, label: 'LSTM Forecast' },
          ].map(({ color, label, opacity }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: opacity || 1 }} />
              <span style={{ color: C.grey, fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Plot */}
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: 420 }}
        useResizeHandler
      />
    </div>
  );
}
