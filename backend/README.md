# StockVision — Backend

A FastAPI-powered REST API for stock market forecasting.

## Requirements

- Python 3.9+

## Setup & Run

```bash
# Install dependencies
pip install -r requirements.txt

# Start the development server (auto-reloads on changes)
uvicorn main:app --reload
```

The API will be available at **http://localhost:8000**

## Endpoints

| Method | Path            | Description                        |
|--------|-----------------|------------------------------------|
| GET    | /api/health     | Health check → `{"status": "ok"}` |
| GET    | /api/forecast   | Stock forecast + indicators         |
| GET    | /api/search     | Search curated ticker list          |
| GET    | /api/markets    | Market overview prices              |
| GET    | /api/prices     | Latest prices for ticker list       |

## Model Files

Place both universal model files in `backend/models/`:

```text
backend/models/arima_universal.pkl
backend/models/lstm_universal.h5
```

If either file is missing, the API will still run and use placeholder predictions for that model.

### `/api/forecast` Query Parameters

| Parameter | Type   | Default | Description                       |
|-----------|--------|---------|-----------------------------------|
| `symbol`  | string | —       | Ticker symbol (e.g. AAPL, TSLA)   |
| `days`    | int    | 17      | Number of forecast days            |

### Example Request

```
GET http://localhost:8000/api/forecast?symbol=AAPL&days=17
```

### Interactive Docs

FastAPI auto-generates Swagger UI at: **http://localhost:8000/docs**
