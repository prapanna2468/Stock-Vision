# StockVision 📈

An AI-powered stock market forecasting dashboard with ARIMA and LSTM model predictions,
technical indicators, and interactive Plotly charts.

## Tech Stack

| Layer    | Technology                        |
|----------|-----------------------------------|
| Frontend | React 18 + Vite 5                 |
| Charts   | Plotly.js + react-plotly.js       |
| Backend  | FastAPI + Python 3.9+             |
| Data     | yfinance (Yahoo Finance API)      |

## Quick Start

Open **two terminals** in the project root.

### Terminal 1 — Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

API available at → **http://localhost:8000**  
Interactive docs → **http://localhost:8000/docs**

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev
```

App available at → **http://localhost:5173**

## API Endpoints

| Method | Endpoint        | Description                                 |
|--------|-----------------|---------------------------------------------|
| GET    | /api/health     | Health check                                |
| GET    | /api/forecast   | Forecast + indicators (`?symbol=AAPL&days=17`) |

## Model Files

Place the two universal model files in the backend models folder:

```text
backend/models/arima_universal.pkl
backend/models/lstm_stock_model.h5
```

If a model file is missing, the backend stays running and uses placeholder predictions for that model.

## Project Structure

```
stockvision/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── requirements.txt     # Python dependencies
│   └── README.md
└── frontend/
    ├── src/
    │   ├── App.jsx                        # Root layout + state
    │   ├── colors.js                      # Design token palette
    │   ├── services/api.js               # fetchForecast()
    │   └── components/
    │       ├── Navbar.jsx
    │       ├── Sidebar.jsx
    │       ├── StockHeader.jsx
    │       ├── ForecastChart.jsx
    │       ├── EvaluationMetrics.jsx
    │       └── TechnicalIndicators.jsx
    ├── index.html
    ├── vite.config.js
    ├── .env
    └── package.json
```

## Usage

1. Type a stock symbol into the sidebar (e.g. `AAPL`, `TSLA`, `GOOGL`)
2. Select a forecast horizon (7 / 14 / 17 / 30 days)
3. Click **⚡ Generate Forecast**
4. View the candlestick + forecast chart, model evaluation metrics, and technical indicators
