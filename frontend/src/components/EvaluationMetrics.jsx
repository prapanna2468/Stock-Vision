import C from '../colors';

function MetricRow({ label, value, highlight }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
      }}
    >
      <span style={{ color: C.grey, fontSize: 12 }}>{label}</span>
      <span
        style={{
          color: highlight ? C.green : C.white,
          fontSize: 13,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {typeof value === 'number' ? value.toFixed(4) : value}
      </span>
    </div>
  );
}

function ModelCard({ model, metrics, color, accentBg, isBetter, days }) {
  return (
    <div
      style={{
        background: C.secondary,
        border: `1px solid ${isBetter ? color : C.border}`,
        borderRadius: 10,
        overflow: 'hidden',
        flex: 1,
        position: 'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: accentBg,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ color: color, fontSize: 13, fontWeight: 700 }}>{model}</div>
          <div style={{ color: C.grey, fontSize: 10, marginTop: 2 }}>{days}-day forecast</div>
        </div>
        {isBetter && (
          <div
            style={{
              background: `${C.green}22`,
              border: `1px solid ${C.green}55`,
              borderRadius: 12,
              color: C.green,
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              letterSpacing: '0.04em',
            }}
          >
            * Better Model
          </div>
        )}
      </div>

      {/* Metrics */}
      <div style={{ padding: '10px 14px' }}>
        <MetricRow label="MAE" value={metrics?.mae} highlight={isBetter} />
        <div style={{ borderTop: `1px solid ${C.border}`, margin: '2px 0' }} />
        <MetricRow label="RMSE" value={metrics?.rmse} highlight={isBetter} />
        <div style={{ borderTop: `1px solid ${C.border}`, margin: '2px 0' }} />
        <MetricRow label="MAPE (%)" value={metrics?.mape} highlight={isBetter} />
      </div>
    </div>
  );
}

export default function EvaluationMetrics({ data }) {
  if (!data?.evaluation) {
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
          height: 160,
        }}
      >
        <span style={{ color: C.grey, fontSize: 13 }}>Metrics will appear after forecast is generated.</span>
      </div>
    );
  }

  const { evaluation, forecast_dates } = data;
  const days = forecast_dates?.length || 17;
  const arima = evaluation.arima;
  const lstm = evaluation.lstm;

  // LSTM wins if its MAE is lower
  const lstmBetter = lstm.mae < arima.mae;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {/* Card Header */}
      <div style={{ padding: '14px 20px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ color: C.white, fontSize: 15, fontWeight: 600 }}>Model Evaluation</div>
        <div style={{ color: C.grey, fontSize: 11, marginTop: 2 }}>{days}-day forecast performance</div>
      </div>

      {/* Cards */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 12 }}>
        <ModelCard
          model="ARIMA"
          metrics={arima}
          color={C.blue}
          accentBg={`${C.blue}18`}
          isBetter={!lstmBetter}
          days={days}
        />
        <ModelCard
          model="LSTM"
          metrics={lstm}
          color={C.orange}
          accentBg={`${C.orange}18`}
          isBetter={lstmBetter}
          days={days}
        />
      </div>

      {/* Verdict */}
      <div
        style={{
          margin: '0 16px 14px',
          background: `${C.green}11`,
          border: `1px solid ${C.green}33`,
          borderRadius: 8,
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>&#10003;</span>
        <span style={{ color: C.green, fontSize: 12, fontWeight: 500 }}>
          {lstmBetter ? 'LSTM' : 'ARIMA'} performed better on this forecast
        </span>
      </div>
    </div>
  );
}
