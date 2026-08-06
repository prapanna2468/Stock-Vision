from contextlib import asynccontextmanager
import threading

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
import pickle
import logging

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)

# ─── Paths ───────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
ARIMA_MODEL_PATH = os.path.join(MODELS_DIR, "arima_universal.pkl")
LSTM_MODEL_PATH = os.path.join(MODELS_DIR, "lstm_stock_model.h5")
FEATURE_SCALER_PATH = os.path.join(MODELS_DIR, "feature_scaler.pkl")
TARGET_SCALER_PATH = os.path.join(MODELS_DIR, "target_scaler.pkl")

os.makedirs(MODELS_DIR, exist_ok=True)

# LSTM pipeline constants
LSTM_WINDOW = 60         # lookback window the model expects
LSTM_FEATURES = 16       # number of features the model expects
LSTM_MIN_HISTORY = 110   # 60-day window + 50 days to warm up SMA50/indicators

# ─── Optional heavy imports (only if model files exist) ──────────────────────
# We import lazily so the server starts even without optional model dependencies.
_arima_model = None  # loaded once and cached in memory
_lstm_model = None  # loaded once and cached in memory
_feature_scaler = None  # loaded once and cached in memory
_target_scaler = None   # loaded once and cached in memory
_arima_load_error = None
_lstm_load_error = None
_models_preloading = True  # True while background preloading is in progress

def _load_arima_model():
    """Load the universal ARIMA model from disk once. Returns None if unavailable."""
    global _arima_model, _arima_load_error
    if _arima_model is not None:
        return _arima_model
    if not os.path.exists(ARIMA_MODEL_PATH):
        _arima_load_error = None
        log.warning("Universal ARIMA model not found at %s — using placeholder predictions.", ARIMA_MODEL_PATH)
        return None
    try:
        with open(ARIMA_MODEL_PATH, "rb") as f:
            _arima_model = pickle.load(f)
        _arima_load_error = None
        log.info("[OK] Universal ARIMA model loaded from %s", ARIMA_MODEL_PATH)
        return _arima_model
    except Exception as exc:
        _arima_load_error = str(exc)
        log.error("Failed to load universal ARIMA model: %s — using placeholder predictions.", exc)
        return None

def _load_lstm_model():
    """Load the LSTM model + both scalers from disk (once). Returns None if unavailable."""
    global _lstm_model, _feature_scaler, _target_scaler, _lstm_load_error
    if _lstm_model is not None:
        return _lstm_model

    # All three files are required
    missing = [p for p in (LSTM_MODEL_PATH, FEATURE_SCALER_PATH, TARGET_SCALER_PATH) if not os.path.exists(p)]
    if missing:
        _lstm_load_error = None
        for p in missing:
            log.warning("LSTM deployment file not found: %s", p)
        log.warning("LSTM requires lstm_stock_model.h5, feature_scaler.pkl, and target_scaler.pkl — using placeholder predictions.")
        return None
    try:
        from tensorflow.keras.models import load_model  # type: ignore
        _lstm_model = load_model(LSTM_MODEL_PATH)
        with open(FEATURE_SCALER_PATH, "rb") as f:
            _feature_scaler = pickle.load(f)
        with open(TARGET_SCALER_PATH, "rb") as f:
            _target_scaler = pickle.load(f)
        _lstm_load_error = None
        log.info("[OK] LSTM model + feature_scaler + target_scaler loaded from %s", MODELS_DIR)
        return _lstm_model
    except Exception as exc:
        _lstm_load_error = str(exc)
        log.error("Failed to load LSTM deployment files: %s — using placeholder predictions.", exc)
        return None


def _arima_predict(symbol: str, closes: pd.Series, days: int):
    """
    Run the universal ARIMA model on the given stock's data.

    Uses model.apply() to transfer the learned ARIMA parameters to the
    current stock's closing prices, then forecasts forward.  This ensures
    the forecast continues from the stock's actual last price rather than
    from the training data the model was originally fitted on.
    """
    model = _load_arima_model()
    if model is None:
        return None

    try:
        # Prefer apply() so the forecast starts from the current stock's data
        if hasattr(model, "apply"):
            applied = model.apply(closes.astype(float), refit=False)
            preds = applied.forecast(steps=days)
        elif hasattr(model, "forecast"):
            preds = model.forecast(steps=days)
        elif hasattr(model, "predict"):
            try:
                preds = model.predict(n_periods=days)
            except TypeError:
                preds = model.predict(days)
        else:
            raise TypeError("ARIMA model must expose forecast() or predict().")

        log.info("Forecast for %s used universal ARIMA model.", symbol.upper())
        return [round(float(p), 4) for p in preds]
    except Exception as exc:
        log.warning("Universal ARIMA prediction failed (%s) — using placeholder predictions.", exc)
        return None


# ─── LSTM 16-feature pipeline ─────────────────────────────────────────────────
# The LSTM model was trained on exactly these 16 features computed from OHLCV
# data in this order.  The feature_scaler.pkl was fit on these columns during
# training and MUST be used at inference time.
LSTM_FEATURE_NAMES = [
    "Open", "High", "Low", "Close", "Volume",
    "SMA20", "SMA50", "EMA20", "EMA50",
    "RSI14", "MACD", "MACD_Signal", "MACD_Histogram",
    "Stoch_K", "BB_Width", "ATR14",
]


def _build_lstm_features(ohlcv: pd.DataFrame) -> pd.DataFrame:
    """
    Compute the exact 16 features expected by the LSTM model from OHLCV data.

    Parameters
    ----------
    ohlcv : DataFrame with columns Open, High, Low, Close, Volume
            (must already be cleaned / NaN-free).

    Returns
    -------
    DataFrame with 16 columns in the order given by LSTM_FEATURE_NAMES.
    Early rows with NaN (from rolling warm-up) are included so the caller
    can decide how many to drop.
    """
    o = ohlcv["Open"].astype(float)
    h = ohlcv["High"].astype(float)
    lo = ohlcv["Low"].astype(float)
    c = ohlcv["Close"].astype(float)
    v = ohlcv["Volume"].astype(float)

    sma20 = c.rolling(20).mean()
    sma50 = c.rolling(50).mean()
    ema20 = c.ewm(span=20, adjust=False).mean()
    ema50 = c.ewm(span=50, adjust=False).mean()

    # RSI-14 using ewm(com=13) smoothing (matches training)
    delta = c.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.ewm(com=13, adjust=False).mean()
    avg_loss = loss.ewm(com=13, adjust=False).mean()
    rs = avg_gain / avg_loss
    rsi14 = 100 - (100 / (1 + rs))

    # MACD: EMA12 - EMA26, signal is 9-period EMA of MACD
    ema12 = c.ewm(span=12, adjust=False).mean()
    ema26 = c.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    macd_signal = macd_line.ewm(span=9, adjust=False).mean()
    macd_histogram = macd_line - macd_signal

    # Stochastic %K (14-period)
    low14 = lo.rolling(14).min()
    high14 = h.rolling(14).max()
    stoch_k = ((c - low14) / (high14 - low14)) * 100

    # Bollinger Band Width = 4 * std20 / SMA20
    std20 = c.rolling(20).std()
    bb_width = (4 * std20) / sma20

    # ATR-14: 14-period EMA of True Range
    prev_close = c.shift(1)
    tr = pd.concat([
        (h - lo),
        (h - prev_close).abs(),
        (lo - prev_close).abs(),
    ], axis=1).max(axis=1)
    atr14 = tr.ewm(span=14, adjust=False).mean()

    features = pd.DataFrame({
        "Open": o, "High": h, "Low": lo, "Close": c, "Volume": v,
        "SMA20": sma20, "SMA50": sma50, "EMA20": ema20, "EMA50": ema50,
        "RSI14": rsi14, "MACD": macd_line, "MACD_Signal": macd_signal,
        "MACD_Histogram": macd_histogram, "Stoch_K": stoch_k,
        "BB_Width": bb_width, "ATR14": atr14,
    }, index=ohlcv.index)

    return features


def _backtest_metrics(closes: pd.Series, pred_dates: list, predictions: list, source: str):
    """Calculate MAE, RMSE, and MAPE against actual closes for plotted past predictions."""
    if source != "model" or not pred_dates or not predictions:
        return {
            "mae": None,
            "rmse": None,
            "mape": None,
            "source": source,
            "sample_size": 0,
            "note": "No real model backtest metrics available.",
        }

    actual_by_date = {d.strftime("%Y-%m-%d"): float(v) for d, v in closes.items() if not pd.isna(v)}
    actual = []
    pred = []
    for date, value in zip(pred_dates, predictions):
        if date in actual_by_date and value is not None and not pd.isna(value):
            actual.append(actual_by_date[date])
            pred.append(float(value))

    if not actual:
        return {
            "mae": None,
            "rmse": None,
            "mape": None,
            "source": source,
            "sample_size": 0,
            "note": "Predictions could not be aligned with actual close prices.",
        }

    actual_arr = np.array(actual, dtype=float)
    pred_arr = np.array(pred, dtype=float)
    errors = pred_arr - actual_arr
    non_zero = actual_arr != 0
    mape = np.mean(np.abs(errors[non_zero] / actual_arr[non_zero])) * 100 if np.any(non_zero) else None
    return {
        "mae": round(float(np.mean(np.abs(errors))), 4),
        "rmse": round(float(np.sqrt(np.mean(errors ** 2))), 4),
        "mape": round(float(mape), 4) if mape is not None else None,
        "source": source,
        "sample_size": len(actual),
        "note": "Calculated from plotted past prediction line versus actual close prices.",
    }


def _lstm_predict(ohlcv: pd.DataFrame, days: int):
    """
    Run LSTM multi-step forecast using the trained model + saved scalers.

    For each step:
      1. Build 16 features from OHLCV, take last 60 rows, scale with feature_scaler
      2. Model predicts scaled percent-change
      3. Inverse-transform with target_scaler to get real percent-change
      4. Reconstruct price as: last_real_close * (1 + pct / 100)
         (always anchored to the most recent REAL close, never a predicted one)

    Returns (prices, pct_changes) or (None, None) if unavailable.
    """
    model = _load_lstm_model()
    if model is None:
        return None, None

    try:
        features = _build_lstm_features(ohlcv)
        clean = features.dropna()

        if len(clean) < LSTM_WINDOW:
            log.warning(
                "Not enough data after indicator warm-up for LSTM (%d < %d). "
                "Need at least %d trading days of history.",
                len(clean), LSTM_WINDOW, LSTM_MIN_HISTORY,
            )
            return None, None

        # Scale the last LSTM_WINDOW rows with the training-time scaler
        window_data = clean.iloc[-LSTM_WINDOW:].values  # (60, 16)
        scaled = _feature_scaler.transform(window_data)  # (60, 16)
        current_input = scaled.reshape(1, LSTM_WINDOW, LSTM_FEATURES)

        last_real_close = float(ohlcv["Close"].iloc[-1])
        pred_prices = []
        pred_pcts = []

        for _ in range(days):
            raw_out = float(model.predict(current_input, verbose=0)[0][0])
            # Inverse-transform to get real percent-change
            pct_change = float(_target_scaler.inverse_transform([[raw_out]])[0][0])
            # Anchor to last REAL close
            predicted_price = last_real_close * (1 + pct_change / 100)
            pred_prices.append(round(predicted_price, 4))
            pred_pcts.append(round(pct_change, 4))

            # Slide window: shift and append the new predicted row
            next_row = current_input[0, -1, :].copy()
            next_row[0] = raw_out  # approximate — keeps features from last real row
            current_input = np.concatenate(
                [current_input[:, 1:, :], next_row.reshape(1, 1, LSTM_FEATURES)],
                axis=1,
            )

        return pred_prices, pred_pcts
    except Exception as exc:
        log.error("LSTM prediction failed: %s — using placeholder predictions.", exc)
        return None, None


# ─── Backtest (past predictions) ─────────────────────────────────────────────
BACKTEST_DAYS = 90  # how many historical days to show past-prediction lines for


def _lstm_backtest(ohlcv: pd.DataFrame, n_days: int = BACKTEST_DAYS):
    """
    Run the LSTM model on a sliding window over the last N historical days
    to produce a 'what the model predicted' line for each day.

    Each prediction uses 60 rows of properly-scaled features and converts
    the output percent-change back to a price using the *previous day's*
    actual close as the anchor.

    Returns (dates_list, preds_list) or (None, None) if unavailable.
    """
    model = _load_lstm_model()
    if model is None:
        return None, None

    try:
        features = _build_lstm_features(ohlcv)
        clean = features.dropna()
        closes = ohlcv["Close"].astype(float)

        # We need at least LSTM_WINDOW + n_days clean rows
        available = len(clean) - LSTM_WINDOW
        if available < 1:
            return None, None
        n_days = min(n_days, available)

        all_scaled = _feature_scaler.transform(clean.values)

        start_idx = len(all_scaled) - n_days
        backtest_preds = []
        backtest_dates = []

        for i in range(start_idx, len(all_scaled)):
            input_window = all_scaled[i - LSTM_WINDOW : i].reshape(1, LSTM_WINDOW, LSTM_FEATURES)
            raw_out = float(model.predict(input_window, verbose=0)[0][0])
            pct_change = float(_target_scaler.inverse_transform([[raw_out]])[0][0])

            # Anchor to the *actual* close of the day before the target
            # clean.index[i-1] is the last day in the input window
            anchor_date = clean.index[i - 1]
            anchor_close = float(closes.loc[anchor_date])
            pred_price = anchor_close * (1 + pct_change / 100)

            backtest_preds.append(round(pred_price, 4))
            backtest_dates.append(clean.index[i].strftime("%Y-%m-%d"))

        return backtest_dates, backtest_preds
    except Exception as exc:
        log.error("LSTM backtest failed: %s", exc)
        return None, None


def _arima_backtest(closes: pd.Series, forecast_horizon: int = 5, n_days: int = BACKTEST_DAYS):
    """
    Honest multi-step ARIMA backtest using the saved model.

    At each historical point, predict ``forecast_horizon`` steps ahead and
    record the final prediction.  Each plotted point therefore represents
    what the model forecasted ``forecast_horizon`` days in advance — giving
    a realistic picture of prediction accuracy rather than the near-perfect
    1-step-ahead results that any I(1) ARIMA model trivially achieves.
    """
    model = _load_arima_model()
    if model is None:
        return [], [], "unavailable:no_arima_model_loaded"

    if not hasattr(model, "apply"):
        log.info("ARIMA past prediction line unavailable: model has no apply() API.")
        return [], [], "unavailable:no_supported_backtest_api"

    try:
        horizon = max(1, forecast_horizon)
        window = min(252, max(60, len(closes) - n_days))
        # Start early enough so the backtest range still covers ~n_days points
        start_idx = max(window, len(closes) - n_days - horizon + 1)
        end_idx = len(closes) - horizon + 1  # exclusive
        preds = []
        dates = []
        for i in range(start_idx, end_idx):
            history = closes.iloc[max(0, i - window):i].astype(float)
            if len(history) < 10:
                continue
            applied = model.apply(history, refit=False)
            multi_pred = applied.forecast(steps=horizon)
            # Record the prediction for the day that is `horizon` steps ahead
            final_pred = float(np.asarray(multi_pred)[-1])
            target_idx = i + horizon - 1
            if target_idx < len(closes):
                preds.append(round(final_pred, 4))
                dates.append(closes.index[target_idx].strftime("%Y-%m-%d"))
        return dates, preds, "model"
    except Exception as exc:
        log.warning("ARIMA backtest failed (%s). No ARIMA past line will be drawn.", exc)
        return [], [], "unavailable:backtest_failed"


# ─── Placeholder fallbacks ───────────────────────────────────────────────────
def _placeholder_arima(last_price: float, days: int):
    """Random-walk placeholder used when real ARIMA is unavailable."""
    rng = np.random.default_rng(seed=42)
    preds, price = [], last_price
    for _ in range(days):
        price += rng.normal(0.15, last_price * 0.008)
        preds.append(round(float(price), 4))
    return preds


def _placeholder_lstm(last_price: float, days: int):
    """Random-walk placeholder used when real LSTM is unavailable."""
    rng = np.random.default_rng(seed=7)
    preds, price = [], last_price
    for _ in range(days):
        price += rng.normal(0.20, last_price * 0.010)
        preds.append(round(float(price), 4))
    return preds


# ─── Technical indicators ────────────────────────────────────────────────────
def compute_rsi(prices: pd.Series, period: int = 14) -> list:
    delta = prices.diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50).tolist()


def compute_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9):
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd.fillna(0).tolist(), macd_signal.fillna(0).tolist()


def compute_bollinger(prices: pd.Series, period: int = 20, std_dev: float = 2.0):
    sma = prices.rolling(window=period).mean()
    std = prices.rolling(window=period).std()
    upper = (sma + std_dev * std).bfill()
    lower = (sma - std_dev * std).bfill()
    return upper.tolist(), lower.tolist()


def compute_ma(prices: pd.Series):
    """Compute SMA(20), SMA(50), and EMA(20) from a closing-price series."""
    sma20 = prices.rolling(window=20).mean()
    sma50 = prices.rolling(window=50).mean()
    ema20 = prices.ewm(span=20, adjust=False).mean()
    return sma20.tolist(), sma50.tolist(), ema20.tolist()


# ─── Popular stocks for search suggestions ───────────────────────────────────
POPULAR_STOCKS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corp."},
    {"symbol": "GOOGL", "name": "Alphabet Inc. (Class A)"},
    {"symbol": "GOOG", "name": "Alphabet Inc. (Class C)"},
    {"symbol": "AMZN", "name": "Amazon.com Inc."},
    {"symbol": "NVDA", "name": "NVIDIA Corp."},
    {"symbol": "META", "name": "Meta Platforms Inc."},
    {"symbol": "TSLA", "name": "Tesla Inc."},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway (Class B)"},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co."},
    {"symbol": "V", "name": "Visa Inc."},
    {"symbol": "JNJ", "name": "Johnson & Johnson"},
    {"symbol": "WMT", "name": "Walmart Inc."},
    {"symbol": "MA", "name": "Mastercard Inc."},
    {"symbol": "PG", "name": "Procter & Gamble Co."},
    {"symbol": "UNH", "name": "UnitedHealth Group Inc."},
    {"symbol": "HD", "name": "The Home Depot Inc."},
    {"symbol": "DIS", "name": "The Walt Disney Co."},
    {"symbol": "BAC", "name": "Bank of America Corp."},
    {"symbol": "ADBE", "name": "Adobe Inc."},
    {"symbol": "CRM", "name": "Salesforce Inc."},
    {"symbol": "NFLX", "name": "Netflix Inc."},
    {"symbol": "AMD", "name": "Advanced Micro Devices Inc."},
    {"symbol": "INTC", "name": "Intel Corp."},
    {"symbol": "PYPL", "name": "PayPal Holdings Inc."},
    {"symbol": "CSCO", "name": "Cisco Systems Inc."},
    {"symbol": "PEP", "name": "PepsiCo Inc."},
    {"symbol": "KO", "name": "The Coca-Cola Co."},
    {"symbol": "COST", "name": "Costco Wholesale Corp."},
    {"symbol": "TMO", "name": "Thermo Fisher Scientific Inc."},
    {"symbol": "ABT", "name": "Abbott Laboratories"},
    {"symbol": "NKE", "name": "Nike Inc."},
    {"symbol": "ORCL", "name": "Oracle Corp."},
    {"symbol": "QCOM", "name": "Qualcomm Inc."},
    {"symbol": "T", "name": "AT&T Inc."},
    {"symbol": "VZ", "name": "Verizon Communications Inc."},
    {"symbol": "XOM", "name": "Exxon Mobil Corp."},
    {"symbol": "CVX", "name": "Chevron Corp."},
    {"symbol": "MRK", "name": "Merck & Co. Inc."},
    {"symbol": "PFE", "name": "Pfizer Inc."},
    {"symbol": "ABBV", "name": "AbbVie Inc."},
    {"symbol": "LLY", "name": "Eli Lilly and Co."},
    {"symbol": "AVGO", "name": "Broadcom Inc."},
    {"symbol": "TXN", "name": "Texas Instruments Inc."},
    {"symbol": "UPS", "name": "United Parcel Service Inc."},
    {"symbol": "SBUX", "name": "Starbucks Corp."},
    {"symbol": "BA", "name": "The Boeing Co."},
    {"symbol": "GS", "name": "Goldman Sachs Group Inc."},
    {"symbol": "SPY", "name": "SPDR S&P 500 ETF"},
    {"symbol": "QQQ", "name": "Invesco QQQ Trust (Nasdaq 100)"},
    {"symbol": "DIA", "name": "SPDR Dow Jones Industrial Average ETF"},
    {"symbol": "IWM", "name": "iShares Russell 2000 ETF"},
    {"symbol": "COIN", "name": "Coinbase Global Inc."},
    {"symbol": "SQ", "name": "Block Inc. (Square)"},
    {"symbol": "SHOP", "name": "Shopify Inc."},
    {"symbol": "SNAP", "name": "Snap Inc."},
    {"symbol": "UBER", "name": "Uber Technologies Inc."},
    {"symbol": "ABNB", "name": "Airbnb Inc."},
    {"symbol": "ZM", "name": "Zoom Video Communications Inc."},
    {"symbol": "PLTR", "name": "Palantir Technologies Inc."},
    {"symbol": "RIVN", "name": "Rivian Automotive Inc."},
    {"symbol": "SOFI", "name": "SoFi Technologies Inc."},
    {"symbol": "MARA", "name": "Marathon Digital Holdings Inc."},
    {"symbol": "ARM", "name": "Arm Holdings plc"},
]


# ─── Eager model preloading ──────────────────────────────────────────────────
def _preload_all_models():
    """Load both models in a background thread so the server starts instantly."""
    global _models_preloading
    log.info("Background model preloading started…")
    _load_arima_model()
    _load_lstm_model()
    _models_preloading = False
    log.info("Background model preloading finished.")


@asynccontextmanager
async def lifespan(application):  # noqa: ARG001
    """Kick off model loading in a daemon thread at startup."""
    thread = threading.Thread(target=_preload_all_models, daemon=True)
    thread.start()
    yield  # application is running
    # shutdown — nothing special to clean up


# ─── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="StockVision API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/search")
def search_stocks(q: str = Query("", description="Search query for stock symbol or name")):
    """Search curated stock list by ticker symbol or company name."""
    if not q or len(q.strip()) < 1:
        # Return top popular stocks when no query
        return POPULAR_STOCKS[:10]

    query = q.strip().upper()
    results = []
    for stock in POPULAR_STOCKS:
        if query in stock["symbol"].upper() or query in stock["name"].upper():
            results.append(stock)
        if len(results) >= 8:
            break
    return results


@app.get("/api/health")
def health_check():
    """Non-blocking health check — reads cached state, never triggers model loading."""
    arima_file_exists = os.path.exists(ARIMA_MODEL_PATH)
    lstm_file_exists = all(os.path.exists(p) for p in (LSTM_MODEL_PATH, FEATURE_SCALER_PATH, TARGET_SCALER_PATH))
    arima_loaded = _arima_model is not None
    lstm_loaded = _lstm_model is not None and _feature_scaler is not None and _target_scaler is not None

    def _model_status(loaded, file_exists, preloading, load_error, name):
        if loaded:
            return "ready"
        if preloading and file_exists:
            return "loading"
        if file_exists and load_error:
            return "error"
        return "placeholder"

    def _model_message(status, name):
        if status == "ready":
            return f"Model loaded and will be used for future {name} forecasts"
        if status == "loading":
            return f"{name} model is being loaded — please wait…"
        if status == "error":
            return f"{name} model file exists but failed to load — check server logs"
        return f"{name} model unavailable — using placeholder predictions. Place model file in backend/models/"

    arima_status = _model_status(arima_loaded, arima_file_exists, _models_preloading, _arima_load_error, "ARIMA")
    lstm_status = _model_status(lstm_loaded, lstm_file_exists, _models_preloading, _lstm_load_error, "LSTM")

    return {
        "status": "ok",
        "models": {
            "arima": {
                "status": arima_status,
                "file_exists": arima_file_exists,
                "loaded": arima_loaded,
                "path": ARIMA_MODEL_PATH,
                "error": _arima_load_error,
                "message": _model_message(arima_status, "ARIMA"),
            },
            "lstm": {
                "status": lstm_status,
                "file_exists": lstm_file_exists,
                "loaded": lstm_loaded,
                "path": LSTM_MODEL_PATH,
                "error": _lstm_load_error,
                "message": _model_message(lstm_status, "LSTM"),
            },
        },
    }


@app.get("/api/markets")
def get_market_overview():
    try:
        symbols = ["SPY", "QQQ", "DIA", "AAPL", "TSLA", "NVDA", "MSFT", "GOOGL", "AMZN"]
        data = yf.download(" ".join(symbols), period="5d", progress=False, auto_adjust=True)
        if data.empty:
            return {"error": "Failed to fetch market data"}

        closes = data["Close"]
        highs = data["High"]
        lows = data["Low"]

        # Ensure column names are uppercase
        if isinstance(closes, pd.DataFrame):
            closes.columns = [c.upper() for c in closes.columns]
            highs.columns = [c.upper() for c in highs.columns]
            lows.columns = [c.upper() for c in lows.columns]
        elif isinstance(closes, pd.Series):
            # Single symbol fallback
            closes = pd.DataFrame({symbols[0]: closes})
            highs = pd.DataFrame({symbols[0]: highs})
            lows = pd.DataFrame({symbols[0]: lows})

        result = []
        names = {
            "SPY": "S&P 500 ETF",
            "QQQ": "Nasdaq 100 ETF",
            "DIA": "Dow Jones ETF",
            "AAPL": "Apple Inc.",
            "TSLA": "Tesla Inc.",
            "NVDA": "NVIDIA Corp.",
            "MSFT": "Microsoft Corp.",
            "GOOGL": "Alphabet Inc.",
            "AMZN": "Amazon.com Inc."
        }

        for sym in symbols:
            if sym not in closes.columns:
                continue

            sym_closes = closes[sym].dropna()
            if len(sym_closes) < 2:
                continue

            current_price = float(sym_closes.iloc[-1])
            prev_price = float(sym_closes.iloc[-2])
            change = current_price - prev_price
            pct_change = (change / prev_price) * 100

            sym_highs = highs[sym].dropna()
            sym_lows = lows[sym].dropna()
            high_val = float(sym_highs.iloc[-1]) if len(sym_highs) > 0 else current_price
            low_val = float(sym_lows.iloc[-1]) if len(sym_lows) > 0 else current_price

            result.append({
                "symbol": sym,
                "name": names.get(sym, sym),
                "price": round(current_price, 2),
                "change": round(change, 2),
                "change_percent": round(pct_change, 2),
                "high": round(high_val, 2),
                "low": round(low_val, 2)
            })
        return result
    except Exception as e:
        log.exception("Unexpected error in /api/markets")
        return {"error": str(e)}


@app.get("/api/prices")
def get_prices(symbols: str = Query(..., description="Comma-separated list of symbols")):
    try:
        sym_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
        if not sym_list:
            return {}

        data = yf.download(" ".join(sym_list), period="5d", progress=False, auto_adjust=True)
        if data.empty:
            return {}

        closes = data["Close"]
        result = {}

        for sym in sym_list:
            if isinstance(closes, pd.Series):
                val = closes.dropna()
                if not val.empty:
                    result[sym] = round(float(val.iloc[-1]), 2)
            else:
                # DataFrame
                cols_upper = [c.upper() for c in closes.columns]
                if sym in cols_upper:
                    # Find exact column match
                    idx = cols_upper.index(sym)
                    col_name = closes.columns[idx]
                    val = closes[col_name].dropna()
                    if not val.empty:
                        result[sym] = round(float(val.iloc[-1]), 2)
        return result
    except Exception as e:
        log.exception("Unexpected error in /api/prices")
        return {"error": str(e)}




@app.get("/api/forecast")
def get_forecast(
    symbol: str = Query(..., description="Stock ticker symbol"),
    days: int = Query(17, description="Number of days to forecast"),
):
    try:
        ticker = yf.download(symbol, period="2y", progress=False, auto_adjust=True)

        if ticker.empty:
            return {"error": f"No data found for symbol '{symbol}'"}

        # Flatten MultiIndex columns if present
        if isinstance(ticker.columns, pd.MultiIndex):
            ticker.columns = ticker.columns.get_level_values(0)

        closes = ticker["Close"].dropna()
        dates = [d.strftime("%Y-%m-%d") for d in closes.index]
        historical_prices = closes.tolist()

        last_price = historical_prices[-1] if historical_prices else 100.0
        last_date = closes.index[-1]

        # ── Build OHLCV DataFrame for LSTM pipeline ───────────────────────────
        ohlcv = ticker[["Open", "High", "Low", "Close", "Volume"]].dropna()

        # ── Forecast dates (business days only) ──────────────────────────────
        forecast_dates = []
        current = last_date
        count = 0
        while count < days:
            current = current + timedelta(days=1)
            if current.weekday() < 5:
                forecast_dates.append(current.strftime("%Y-%m-%d"))
                count += 1

        # ── ARIMA predictions ─────────────────────────────────────────────────
        arima_preds = _arima_predict(symbol, closes, days)
        arima_source = "model"
        if arima_preds is None:
            arima_preds = _placeholder_arima(last_price, days)
            arima_source = "placeholder"

        # ── LSTM predictions ──────────────────────────────────────────────────
        lstm_preds, lstm_pct_changes = _lstm_predict(ohlcv, days)
        lstm_source = "model"
        if lstm_preds is None:
            lstm_preds = _placeholder_lstm(last_price, days)
            lstm_pct_changes = None
            lstm_source = "placeholder"

        log.info("Forecast for %s — ARIMA: %s | LSTM: %s", symbol.upper(), arima_source, lstm_source)

        # ── Past predictions (backtest) ───────────────────────────────────────
        lstm_bt_dates, lstm_bt_preds = _lstm_backtest(ohlcv)
        lstm_bt_source = "model"
        if lstm_bt_dates is None:
            # Fallback: generate placeholder past LSTM predictions
            n_bt = min(BACKTEST_DAYS, len(closes))
            tail = closes.iloc[-n_bt:]
            rng_bt = np.random.default_rng(seed=7)
            noise = rng_bt.normal(0, tail.values * 0.008, size=n_bt)
            lstm_bt_preds = [round(float(p), 4) for p in (tail.values + noise)]
            lstm_bt_dates = [d.strftime("%Y-%m-%d") for d in tail.index]
            lstm_bt_source = "placeholder"

        arima_bt_dates, arima_bt_preds, arima_bt_source = _arima_backtest(closes, forecast_horizon=days)

        # ── Evaluation metrics (computed from backtest predictions) ───────────
        evaluation = {
            "arima": _backtest_metrics(closes, arima_bt_dates, arima_bt_preds, arima_bt_source),
            "lstm": _backtest_metrics(closes, lstm_bt_dates, lstm_bt_preds, lstm_bt_source),
        }

        # ── Technical indicators ──────────────────────────────────────────────
        closes_series = pd.Series(historical_prices, index=closes.index)
        rsi = compute_rsi(closes_series)
        macd, macd_signal = compute_macd(closes_series)
        sma20, sma50, ema20 = compute_ma(closes_series)

        # ── OHLCV for candlestick ─────────────────────────────────────────────
        opens = ticker["Open"].dropna().reindex(closes.index).fillna(closes).tolist()
        highs = ticker["High"].dropna().reindex(closes.index).fillna(closes).tolist()
        lows = ticker["Low"].dropna().reindex(closes.index).fillna(closes).tolist()
        volumes = ticker["Volume"].dropna().reindex(closes.index).fillna(0).tolist()

        return {
            "symbol": symbol.upper(),
            "dates": dates,
            "historical_prices": [None if pd.isna(p) else round(p, 4) for p in historical_prices],
            "opens": [None if pd.isna(p) else round(p, 4) for p in opens],
            "highs": [None if pd.isna(p) else round(p, 4) for p in highs],
            "lows": [None if pd.isna(p) else round(p, 4) for p in lows],
            "volumes": [0 if pd.isna(v) else int(v) for v in volumes],
            "forecast_dates": forecast_dates,
            "arima_predictions": arima_preds,
            "lstm_predictions": lstm_preds,
            "lstm_pct_changes": lstm_pct_changes,
            "arima_past_predictions": arima_bt_preds,
            "arima_past_dates": arima_bt_dates,
            "lstm_past_predictions": lstm_bt_preds,
            "lstm_past_dates": lstm_bt_dates,
            "prediction_sources": {
                "arima_future": arima_source,
                "lstm_future": lstm_source,
                "arima_past": arima_bt_source,
                "lstm_past": lstm_bt_source,
            },
            "evaluation": evaluation,
            "indicators": {
                "rsi": [None if pd.isna(v) else round(v, 4) for v in rsi],
                "macd": [None if pd.isna(v) else round(v, 4) for v in macd],
                "macd_signal": [None if pd.isna(v) else round(v, 4) for v in macd_signal],
                "sma20": [None if pd.isna(v) else round(v, 4) for v in sma20],
                "sma50": [None if pd.isna(v) else round(v, 4) for v in sma50],
                "ema20": [None if pd.isna(v) else round(v, 4) for v in ema20],
            },
        }
    except Exception as e:
        log.exception("Unexpected error in /api/forecast")
        return {"error": str(e)}
