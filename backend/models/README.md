# Models Folder

Put the two universal trained model files in this folder.

```text
backend/
└── models/
    ├── arima_universal.pkl     # Universal ARIMA model
    └── lstm_stock_model.h5       # Universal LSTM model
```

## Required filenames

The backend code now looks for these exact paths:

```text
backend/models/arima_universal.pkl
backend/models/lstm_stock_model.h5
```

Do not rename them unless you also change the paths in `backend/main.py`.

## ARIMA model

Expected file:

```text
backend/models/arima_universal.pkl
```

Expected format:

- Python pickle `.pkl`
- The loaded object should support one of these methods:
  - `forecast(steps=days)`, common for statsmodels fitted ARIMA results
  - `predict(n_periods=days)`, common for pmdarima models
  - `predict(days)`, supported as a fallback

If this file is missing or incompatible, the backend uses placeholder ARIMA predictions.

## LSTM model

Expected file:

```text
backend/models/lstm_stock_model.h5
```

Expected format:

- Keras/TensorFlow `.h5` model
- Input shape: `(batch, 60, 1)`
- The backend passes the last 60 normalized closing prices
- Output should be one predicted next-day normalized price

The backend handles scaling and inverse scaling with `MinMaxScaler`.

If this file is missing or incompatible, the backend uses placeholder LSTM predictions.

## Check whether models are loaded

Start the backend and open:

```text
http://localhost:8000/api/health
```

You should see both models as `ready` when the files are present:

```json
{
  "models": {
    "arima": {
      "status": "ready",
      "loaded": true
    },
    "lstm": {
      "status": "ready",
      "loaded": true
    }
  }
}
```
