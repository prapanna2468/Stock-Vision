"""
train_lstm.py
=============
Trains a 16-feature LSTM stock model and saves:
  - models/lstm_stock_model.h5   (the Keras model)
  - models/target_scaler.pkl     (MinMaxScaler for % changes → [0,1])

Feature scaling strategy matches the fixed inference code in main.py:
  Each stock gets its OWN MinMaxScaler fitted on its own feature data.
  This avoids the global-scaler mismatch that caused the ~24% bias.

Run from the backend/ directory:
  python train_lstm.py
"""

import os
import pickle
import logging
import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import MinMaxScaler

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
MODELS_DIR   = os.path.join(os.path.dirname(__file__), "models")
MODEL_OUT    = os.path.join(MODELS_DIR, "lstm_stock_model.h5")
TARGET_SCALER_OUT = os.path.join(MODELS_DIR, "target_scaler.pkl")

WINDOW       = 60    # lookback window (must match LSTM_WINDOW in main.py)
N_FEATURES   = 16   # must match LSTM_FEATURES in main.py
EPOCHS       = 30
BATCH_SIZE   = 64
PERIOD       = "5y"  # how much history to download per ticker

# Diverse mix of price ranges so the model generalises across stocks
TRAIN_TICKERS = [
    # Mega-cap tech (~$100–$500)
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    # Mid-cap / varied prices
    "AMD", "NFLX", "CRM", "ADBE", "PYPL", "INTC", "CSCO",
    # Blue-chips / ETFs
    "JPM", "BAC", "WMT", "KO", "PG", "JNJ", "XOM", "CVX",
    "SPY", "QQQ",
]


# ── Indicator helpers (identical to main.py) ──────────────────────────────────
def build_features(ohlcv: pd.DataFrame) -> pd.DataFrame:
    o  = ohlcv["Open"].astype(float)
    h  = ohlcv["High"].astype(float)
    lo = ohlcv["Low"].astype(float)
    c  = ohlcv["Close"].astype(float)
    v  = ohlcv["Volume"].astype(float)

    sma20 = c.rolling(20).mean()
    sma50 = c.rolling(50).mean()
    ema20 = c.ewm(span=20, adjust=False).mean()
    ema50 = c.ewm(span=50, adjust=False).mean()

    delta    = c.diff()
    gain     = delta.where(delta > 0, 0.0)
    loss     = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs       = avg_gain / avg_loss
    rsi14    = 100 - (100 / (1 + rs))

    ema12       = c.ewm(span=12, adjust=False).mean()
    ema26       = c.ewm(span=26, adjust=False).mean()
    macd_line   = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_hist   = macd_line - macd_signal

    low14   = lo.rolling(14).min()
    high14  = h.rolling(14).max()
    stoch_k = ((c - low14) / (high14 - low14 + 1e-9)) * 100

    std20    = c.rolling(20).std()
    bb_width = (4 * std20) / (sma20 + 1e-9)

    prev_close = c.shift(1)
    tr = pd.concat([
        (h - lo),
        (h - prev_close).abs(),
        (lo - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr14 = tr.ewm(span=14, adjust=False).mean()

    return pd.DataFrame({
        "Open": o, "High": h, "Low": lo, "Close": c, "Volume": v,
        "SMA20": sma20, "SMA50": sma50, "EMA20": ema20, "EMA50": ema50,
        "RSI14": rsi14, "MACD": macd_line, "MACD_Signal": macd_signal,
        "MACD_Histogram": macd_hist, "Stoch_K": stoch_k,
        "BB_Width": bb_width, "ATR14": atr14,
    }, index=ohlcv.index)


# ── Data collection ───────────────────────────────────────────────────────────
def collect_data():
    """
    Download OHLCV for each ticker, build features, fit a per-stock scaler,
    then create (X, y) sequences where:
      X = 60 days of per-stock-scaled features
      y = next-day % change (raw, will be scaled later with target_scaler)
    """
    all_X, all_y = [], []
    all_pcts     = []   # collect raw % changes for target_scaler fitting

    for ticker in TRAIN_TICKERS:
        log.info("Downloading %s …", ticker)
        try:
            raw = yf.download(ticker, period=PERIOD, progress=False, auto_adjust=True)
            if raw.empty or len(raw) < WINDOW + 60:
                log.warning("  Skipping %s — not enough data (%d rows)", ticker, len(raw))
                continue

            # Flatten MultiIndex if present
            if isinstance(raw.columns, pd.MultiIndex):
                raw.columns = raw.columns.get_level_values(0)

            ohlcv = raw[["Open", "High", "Low", "Close", "Volume"]].dropna()
            feats = build_features(ohlcv).dropna()

            if len(feats) < WINDOW + 1:
                log.warning("  Skipping %s — too few rows after indicator warmup (%d)", ticker, len(feats))
                continue

            # Per-stock feature scaler (same as inference in main.py)
            scaler = MinMaxScaler(feature_range=(0, 1))
            scaled = scaler.fit_transform(feats.values)  # (T, 16)

            # Target: next-day % change in Close
            closes = feats["Close"].values
            pct_changes = np.diff(closes) / closes[:-1] * 100  # length T-1

            # Build sequences
            for i in range(WINDOW, len(scaled) - 1):
                X_seq = scaled[i - WINDOW : i]          # (60, 16)
                y_val = pct_changes[i - 1]              # scalar % change
                all_X.append(X_seq)
                all_y.append(y_val)
                all_pcts.append(y_val)

            log.info("  %s: %d sequences, Close range [%.2f, %.2f]",
                     ticker, len(feats) - WINDOW - 1,
                     feats["Close"].min(), feats["Close"].max())

        except Exception as exc:
            log.error("  Error processing %s: %s", ticker, exc)

    if not all_X:
        raise RuntimeError("No training data collected — check your internet connection.")

    X = np.array(all_X, dtype=np.float32)  # (N, 60, 16)
    y_raw = np.array(all_y, dtype=np.float32)  # (N,)

    # Fit target_scaler on ALL percent changes
    target_scaler = MinMaxScaler(feature_range=(0, 1))
    y_scaled = target_scaler.fit_transform(y_raw.reshape(-1, 1)).flatten()

    log.info("Total sequences: %d  |  % change range: [%.4f, %.4f]",
             len(X), y_raw.min(), y_raw.max())

    return X, y_scaled, target_scaler


# ── Model definition ──────────────────────────────────────────────────────────
def build_model():
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
    from tensorflow.keras.optimizers import Adam

    model = Sequential([
        LSTM(128, return_sequences=True, input_shape=(WINDOW, N_FEATURES)),
        Dropout(0.2),
        BatchNormalization(),
        LSTM(64, return_sequences=False),
        Dropout(0.2),
        BatchNormalization(),
        Dense(32, activation="relu"),
        Dropout(0.1),
        Dense(1, activation="sigmoid"),   # output in [0, 1] to match target_scaler range
    ])

    model.compile(optimizer=Adam(learning_rate=1e-3), loss="mse", metrics=["mae"])
    model.summary()
    return model


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    os.makedirs(MODELS_DIR, exist_ok=True)

    log.info("=== Collecting training data ===")
    X, y, target_scaler = collect_data()

    # Shuffle before split
    idx = np.random.default_rng(42).permutation(len(X))
    X, y = X[idx], y[idx]

    split = int(len(X) * 0.9)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    log.info("Train: %d  |  Val: %d", len(X_train), len(X_val))

    log.info("=== Building model ===")
    model = build_model()

    from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True, verbose=1),
        ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=3, verbose=1),
    ]

    log.info("=== Training (%d epochs, batch %d) ===", EPOCHS, BATCH_SIZE)
    model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=1,
    )

    log.info("=== Saving artefacts ===")
    model.save(MODEL_OUT)
    log.info("Model saved  → %s", MODEL_OUT)

    with open(TARGET_SCALER_OUT, "wb") as f:
        pickle.dump(target_scaler, f)
    log.info("Target scaler → %s", TARGET_SCALER_OUT)

    log.info("=== Done! ===")


if __name__ == "__main__":
    main()
