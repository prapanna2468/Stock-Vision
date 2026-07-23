# StockVision Project Knowledge Dump for ITS64704 Software Test Plan and Test Execution Report

## Project Name & One-Line Description

**StockVision** is an AI-powered stock market forecasting dashboard that lets users search stock tickers, view historical market data, compare ARIMA and LSTM prediction outputs, inspect technical indicators, and generate reporting views for investment analysis and software testing documentation.

## Project Objectives (business goals, what problem it solves)

- Provide a single web dashboard for retail-style stock forecasting and market analysis.
- Help users quickly search common stock tickers and generate forecasts without manually collecting market data.
- Compare two forecasting approaches, ARIMA and LSTM, so users can evaluate model behavior side by side.
- Present historical stock movement, future prediction lines, past prediction traces, evaluation metrics, and technical indicators in visual form.
- Support software testing coursework by exposing clear frontend modules, backend APIs, input validation paths, model fallback behavior, and reportable test scenarios.
- Reduce dependency on manual spreadsheet analysis by using Yahoo Finance data through `yfinance` and rendering interactive Plotly charts.
- Keep the application usable even when trained model files are missing by falling back to deterministic placeholder predictions.

## Target Users / Stakeholders (roles: admin, end user, etc.)

- **End users / retail investors**
  - Use the dashboard to search tickers, generate forecasts, compare ARIMA and LSTM predictions, inspect technical indicators, review market overview data, and print reports.
- **Students / researchers**
  - Use the project as a demonstration system for software testing, AI model integration, API testing, UI testing, and requirements-based validation.
- **Software testers / QA team**
  - Validate frontend workflows, backend API responses, error handling, data rendering, forecast generation, and report generation.
- **Developers / maintainers**
  - Maintain the React frontend, FastAPI backend, model loading logic, API integrations, and deployment configuration.
- **Project evaluators / lecturers**
  - Assess whether the system has testable requirements, realistic modules, clear input/output behavior, and traceable testing artifacts.
- **ML model contributors**
  - Provide or improve ARIMA and LSTM model files stored under `backend/models/`.

## Functional Requirements — list every feature/module the system has, grouped by module (e.g. Authentication, Dashboard, Data Input, Reporting, etc.), each as a short bullet

### 1. Application Shell / Navigation

- Display a fixed top navigation bar with the StockVision logo.
- Display the product name **StockVision**.
- Display the tagline **AI-Powered Forecasting**.
- Show application version **v1.3**.
- Provide navigation tabs for **Dashboard**, **Markets**, and **Reports**.
- Highlight the active navigation tab.
- Keep navigation fixed while users scroll or switch pages.

### 2. Dashboard Module

- Show a welcome state when no forecast data has been generated.
- Display quick-pick ticker buttons for common stocks such as AAPL, TSLA, GOOGL, NVDA, and MSFT.
- Allow users to trigger a forecast from quick-pick ticker selections.
- Display a stock header after forecast data is loaded.
- Display loading feedback while market data and model predictions are being calculated.
- Display an error banner when forecast retrieval fails.
- Allow users to dismiss forecast errors.
- Route users back to the Dashboard automatically when a suggested ticker is selected.

### 3. Stock Search / Data Input Module

- Display a fixed sidebar on Dashboard and Reports pages.
- Allow users to enter a stock ticker symbol.
- Convert ticker input to uppercase.
- Support stock search suggestions using `/api/search`.
- Debounce search suggestion API calls by approximately 200 ms.
- Show suggestion results containing ticker symbols and company names.
- Allow users to select a suggestion to generate a forecast.
- Allow users to press Enter to generate a forecast.
- Allow users to press Escape to close suggestions.
- Close suggestions when users click outside the suggestion area.
- Store recent searches in browser `localStorage` under `sv_recent`.
- Limit recent searches to the five most recent symbols.

### 4. Forecast Horizon Module

- Allow users to choose forecast periods of 7, 14, 17, or 30 days.
- Default the forecast horizon to 17 days.
- Send the selected number of forecast days to the backend API.
- Generate forecast dates using business days only, excluding weekends.

### 5. Forecast Generation Module

- Call the backend forecast API through `fetchForecast(symbol, days)`.
- Request historical market data from Yahoo Finance through `yfinance`.
- Retrieve approximately two years of historical stock data for a symbol.
- Return a clear error response when no market data is found for a symbol.
- Return symbol, dates, historical close prices, OHLC data, volume data, forecast dates, model predictions, past predictions, evaluation metrics, and technical indicators.
- Normalize response symbols to uppercase.

### 6. ARIMA Prediction Module

- Attempt to load an ARIMA model from `backend/models/arima_universal.pkl`.
- Cache the loaded ARIMA model in memory after first successful load.
- Support ARIMA-like models with either `forecast(steps=...)` or `predict(...)` methods.
- Generate ARIMA predictions for the selected forecast horizon.
- Use placeholder ARIMA predictions when the real model file is missing or prediction fails.
- Generate placeholder ARIMA backtest predictions for recent historical dates.
- Include the ARIMA prediction source as either `model` or `placeholder` in evaluation data.

### 7. LSTM Prediction Module

- Attempt to load an LSTM model from `backend/models/lstm_stock_model.h5`.
- Cache the loaded LSTM model in memory after first successful load.
- Use TensorFlow Keras to load the LSTM model when available.
- Scale historical close prices with `MinMaxScaler` before prediction.
- Use the most recent 60 closing prices as the LSTM seed window.
- Generate multi-step LSTM forecasts for the selected number of days.
- Inverse-transform LSTM outputs back to real stock price scale.
- Use placeholder LSTM predictions when the model file is missing, data is insufficient, or prediction fails.
- Generate LSTM backtest predictions when the LSTM model is available.
- Generate placeholder LSTM backtest predictions when the model is unavailable.
- Include the LSTM prediction source as either `model` or `placeholder` in evaluation data.

### 8. Technical Indicators Module

- Compute RSI using a 14-period rolling method.
- Compute MACD using 12-period and 26-period EMAs.
- Compute MACD signal using a 9-period EMA.
- Compute Bollinger Bands using a 20-period moving average and two standard deviations.
- Return technical indicator arrays in the forecast API response.
- Display technical indicators in the frontend technical indicators component.

### 9. Charting / Visualization Module

- Render forecast data through a Plotly-based forecast chart component.
- Show historical stock price data.
- Show OHLC candlestick data when available.
- Show ARIMA future prediction data.
- Show LSTM future prediction data.
- Show ARIMA and LSTM past prediction traces for comparison against historical data.
- Support interactive chart usage through Plotly.

### 10. Evaluation Metrics Module

- Display model evaluation metrics for ARIMA and LSTM.
- Return MAE, RMSE, and MAPE values for each model.
- Indicate whether each metric set is based on a real model or placeholder predictions.
- Allow users/testers to compare model performance presentation between ARIMA and LSTM.

### 11. Markets Module

- Provide a Markets navigation tab.
- Fetch market overview data from `/api/markets`.
- Retrieve data for symbols including SPY, QQQ, DIA, AAPL, TSLA, NVDA, MSFT, GOOGL, and AMZN.
- Display current price, daily change, percentage change, high, and low values.
- Return an error object if market data cannot be fetched.

### 12. Price Lookup Module

- Provide `/api/prices` for comma-separated stock symbols.
- Normalize requested symbols to uppercase.
- Return latest close prices for requested symbols.
- Return an empty object when no valid symbols or no data are available.

### 13. Reporting Module

- Provide a Reports navigation tab.
- Show the sidebar on the Reports page so users can select forecast inputs.
- Render report-oriented content through `ReportsView.jsx`.
- Provide a print/report trigger function for producing report output from the browser.
- Support inclusion of forecast, metrics, and analysis content in generated reporting views.

### 14. Backend Health / Model Status Module

- Provide `/api/health` endpoint.
- Return API status as `ok` when the backend is running.
- Return model readiness status for ARIMA.
- Return model readiness status for LSTM.
- Return model file paths for backend model files.
- Return user-readable model status messages.
- Allow the frontend sidebar to show whether models are loaded, placeholder, pending, or unreachable.

### 15. Search API Module

- Provide `/api/search` endpoint.
- Search a curated popular stock list by ticker symbol or company name.
- Return the top ten popular stocks when the search query is empty.
- Return up to eight matching search results for non-empty queries.

### 16. Error Handling Module

- Show frontend forecast errors in a dismissible banner.
- Handle backend-unreachable model status checks in the sidebar.
- Return error objects for missing ticker data and unexpected backend failures.
- Keep the backend running even if ARIMA or LSTM model files are missing.
- Log model loading and prediction failures on the backend.

### 17. API Integration Module

- Use React service functions in `frontend/src/services/api.js` to communicate with the backend.
- Enable CORS for local frontend origins `http://localhost:5173`, `http://localhost:5174`, and `http://localhost:4173`.
- Expose interactive FastAPI documentation at `/docs` when the backend is running.

### 18. Authentication Module

- The current implementation does **not** include login, registration, roles, passwords, or session management.
- Any admin or restricted access features are outside the current implemented scope.

## Non-Functional Requirements — performance, security, usability, scalability, availability targets if any

### Performance

- Stock search suggestions should feel responsive by using debounced API calls.
- Forecast generation should provide a loading overlay so users receive feedback during slower Yahoo Finance or model operations.
- Backend model objects should be cached after loading to avoid repeated disk/model load overhead.
- Forecast response generation should complete within a practical interactive dashboard timeframe under normal network conditions.
- Frontend navigation and tab switching should occur without full page reloads.

### Usability

- The UI should provide clear navigation between Dashboard, Markets, and Reports.
- Ticker input should be simple and support common stock examples.
- Quick-pick ticker buttons should help first-time users generate a forecast quickly.
- The application should show visible loading, error, active-tab, and model-status states.
- Forecast results should be visual and easy to compare through charts, metrics, and indicators.
- The app should remain usable when model files are missing by using placeholder predictions.

### Reliability / Availability

- The backend should start even when optional ML model files or dependencies are unavailable.
- Placeholder prediction fallback should prevent model-file absence from breaking the forecast workflow.
- Backend API errors should be caught and returned as error responses where implemented.
- The frontend should handle backend failures gracefully by showing error messages.

### Security

- CORS should be restricted to known local development frontend origins.
- The application should not expose authentication secrets because authentication is not implemented.
- User input should be normalized and passed as query parameters rather than executed as code.
- The system should avoid storing sensitive user data. Current local storage only stores recent ticker symbols.
- If deployed publicly, HTTPS, stricter CORS, input validation, rate limiting, and API abuse protection should be added.

### Scalability

- The current project is designed for local or small-scale educational/demo usage.
- Backend forecast requests depend on Yahoo Finance network availability and local model inference resources.
- Horizontal scaling would require stateless API deployment, model artifact management, caching, and request throttling.
- Market data caching would be recommended for production use to reduce repeated external API calls.

### Maintainability

- Frontend code is separated into components such as Navbar, Sidebar, ForecastChart, EvaluationMetrics, TechnicalIndicators, MarketsView, and ReportsView.
- Backend code groups model loading, predictions, indicators, stock search data, and API routes in `main.py`.
- Model files are isolated under `backend/models/`.
- API service logic is separated under `frontend/src/services/api.js`.

### Compatibility

- Frontend is built with React 18 and Vite 5.
- Backend is built with FastAPI and Python 3.9+.
- The system is intended to run locally with backend on port 8000 and frontend on port 5173.

## Business Rules / Validation Rules — e.g. field constraints, input formats, calculation rules

- Stock ticker input must not be blank before forecast generation is attempted by the frontend.
- Ticker symbols entered in the frontend are converted to uppercase.
- Search suggestions are requested only when the input length is at least one character.
- Search API should match query text against ticker symbols and company names.
- Search API should return up to ten popular stocks for an empty query.
- Search API should return up to eight matches for a non-empty query.
- Forecast days must be supplied as an integer query parameter.
- Supported frontend forecast periods are 7, 14, 17, and 30 days.
- Default forecast period is 17 days.
- Forecast dates must be generated only for business days, excluding Saturdays and Sundays.
- Forecast API must return an error when Yahoo Finance returns no data for a requested symbol.
- Historical market data should cover approximately two years of trading data.
- LSTM prediction requires at least 60 scaled close-price values for its input window.
- LSTM output must be inverse-transformed back to actual price scale.
- Missing ARIMA model file triggers placeholder ARIMA predictions.
- Missing LSTM model file triggers placeholder LSTM predictions.
- ARIMA predictions may use either a `forecast` method or compatible `predict` method.
- Model status must show `ready` when files exist and `placeholder` when files are missing.
- Recent searches should remove duplicate symbols and keep the newest occurrence first.
- Recent searches should be capped at five entries.
- RSI default period is 14.
- MACD uses fast period 12, slow period 26, and signal period 9.
- Bollinger Bands use period 20 and standard deviation multiplier 2.0.
- OHLCV arrays should align with historical close-price dates.
- API response prices and prediction values should be rounded for presentation.
- Authentication-related validation rules are not applicable because authentication is not implemented.

## Main User Flows / Use Cases

### Use Case 1: Generate Forecast from Manual Ticker Input

1. User opens StockVision.
2. User stays on the Dashboard tab.
3. User enters a ticker such as `AAPL` in the sidebar.
4. User selects a forecast horizon such as 17 days.
5. User clicks **Generate Forecast** or presses Enter.
6. Frontend shows a loading overlay.
7. Backend retrieves Yahoo Finance data and generates ARIMA/LSTM predictions.
8. Frontend displays the stock header, chart, metrics, and indicators.

### Use Case 2: Generate Forecast from Search Suggestion

1. User types at least one character in the ticker search field.
2. Frontend calls `/api/search` after debounce.
3. User selects a ticker suggestion.
4. Ticker is saved to recent searches.
5. Dashboard forecast is generated for the selected symbol.

### Use Case 3: Generate Forecast from Quick-Pick Button

1. User sees the welcome state.
2. User clicks a quick-pick ticker such as TSLA or NVDA.
3. Frontend sets the selected symbol and calls forecast generation.
4. Forecast results are displayed on the Dashboard.

### Use Case 4: View Market Overview

1. User clicks the Markets tab.
2. Frontend renders the Markets view.
3. Backend `/api/markets` provides price, change, high, and low information for selected market symbols.
4. User reviews the current market overview.

### Use Case 5: View or Print Report

1. User clicks the Reports tab.
2. User selects or generates forecast data using the sidebar.
3. Reports view presents report-oriented forecast information.
4. User triggers browser print/report generation if needed.

### Use Case 6: Check Model Status

1. User opens a page with the sidebar.
2. Sidebar calls `/api/health` on mount.
3. Backend returns ARIMA and LSTM model readiness.
4. Sidebar displays loaded, placeholder, pending, or unreachable status.

### Use Case 7: Invalid or Unknown Ticker

1. User enters an invalid or unsupported ticker.
2. Frontend calls `/api/forecast`.
3. Backend receives no Yahoo Finance data.
4. Backend returns an error object.
5. Frontend shows a forecast error banner.

## External Interfaces / APIs

### Frontend Routes / Views

- **Dashboard**: Main forecast generation and chart view.
- **Markets**: Market overview page.
- **Reports**: Report generation and print-oriented page.

### Backend API Endpoints

| Method | Endpoint | Parameters | Purpose |
|---|---|---|---|
| GET | `/api/health` | None | Check backend and model readiness. |
| GET | `/api/search` | `q` string | Search curated stock symbols and company names. |
| GET | `/api/markets` | None | Fetch market overview for selected index/stock symbols. |
| GET | `/api/prices` | `symbols` comma-separated string | Return latest close prices for requested symbols. |
| GET | `/api/forecast` | `symbol` string, `days` integer | Return historical prices, OHLCV data, ARIMA/LSTM forecasts, metrics, and indicators. |

### External Data Source

- **Yahoo Finance**, accessed through the Python `yfinance` library.
- Used for historical stock data, current prices, and market overview data.

### Model File Interfaces

- `backend/models/arima_universal.pkl`
  - Expected to be a pickled ARIMA-compatible model with `forecast` or `predict` behavior.
- `backend/models/lstm_stock_model.h5`
  - Expected to be a TensorFlow Keras LSTM model.

## Data / Database / Storage

- The current implementation does **not** use a database.
- Historical and market data are fetched on demand from Yahoo Finance.
- ARIMA and LSTM model artifacts are stored as local files in `backend/models/`.
- Recent search history is stored in browser `localStorage` as `sv_recent`.
- Application source files are stored in frontend and backend project folders.
- No permanent user accounts, portfolios, authentication sessions, or database records are implemented.

## Key Screens / UI Components

- **Navbar (`frontend/src/components/Navbar.jsx`)**
  - Displays logo, product name, tagline, navigation tabs, and version v1.3.
- **Sidebar (`frontend/src/components/Sidebar.jsx`)**
  - Handles ticker input, search suggestions, forecast horizon, model status, recent searches, and forecast submission.
- **StockHeader (`frontend/src/components/StockHeader.jsx`)**
  - Displays high-level selected stock information after forecast generation.
- **ForecastChart (`frontend/src/components/ForecastChart.jsx`)**
  - Displays interactive Plotly-based historical and forecast visualization.
- **EvaluationMetrics (`frontend/src/components/EvaluationMetrics.jsx`)**
  - Displays ARIMA and LSTM MAE, RMSE, MAPE, and source-related metric information.
- **TechnicalIndicators (`frontend/src/components/TechnicalIndicators.jsx`)**
  - Displays RSI, MACD, MACD signal, and Bollinger Band information.
- **MarketsView (`frontend/src/components/MarketsView.jsx`)**
  - Displays market overview data.
- **ReportsView (`frontend/src/components/ReportsView.jsx`)**
  - Displays report-oriented content and supports print/report behavior.
- **LoadingOverlay (`frontend/src/App.jsx`)**
  - Shows progress while data is being fetched and predictions are being calculated.
- **ErrorBanner (`frontend/src/App.jsx`)**
  - Shows forecast errors and supports dismissal.

## Assumptions / Limitations

- Forecast outputs are educational/demo outputs and should not be treated as financial advice.
- Placeholder predictions are used when real model files are missing or fail to load.
- Placeholder evaluation metrics are randomly generated ranges rather than formal model validation metrics.
- No user authentication or authorization is currently implemented.
- No database persistence is currently implemented.
- Yahoo Finance availability and response quality affect forecast and market features.
- The application is primarily configured for local development.
- CORS is configured only for local frontend origins.
- Model files named in README and health messages should be kept consistent in future maintenance.
- ARIMA backtesting currently uses placeholder logic, even when ARIMA future prediction may use a model.
- Forecast date generation excludes weekends but does not account for market holidays.
- The current backend may return error objects with HTTP 200 in some cases rather than raising explicit HTTP error codes.
- The UI does not currently provide portfolio persistence or account-based personalization.

## Suggested Test Scenarios / Test Cases

### Application Shell / Navigation Tests

- Verify the navbar displays the StockVision logo.
- Verify the navbar displays product name **StockVision**.
- Verify the navbar displays tagline **AI-Powered Forecasting**.
- Verify the navbar displays version **v1.3**.
- Verify Dashboard, Markets, and Reports tabs are visible.
- Verify clicking each tab changes the active page.
- Verify the active tab is visually highlighted.

### Ticker Input and Search Tests

- Enter lowercase `aapl` and verify it becomes `AAPL`.
- Enter `A` and verify search suggestions appear.
- Enter a company-name fragment and verify matching suggestions are returned when available.
- Press Escape and verify suggestions close.
- Click outside suggestions and verify suggestions close.
- Select a suggestion and verify forecast generation starts.
- Press Enter in the ticker input and verify forecast generation starts.
- Verify recent searches are saved and capped at five symbols.

### Forecast Horizon Tests

- Verify 7-day forecast option sends `days=7`.
- Verify 14-day forecast option sends `days=14`.
- Verify 17-day forecast option is the default.
- Verify 30-day forecast option sends `days=30`.
- Verify returned forecast dates exclude Saturdays and Sundays.

### Forecast API Tests

- Call `/api/forecast?symbol=AAPL&days=17` and verify required response fields exist.
- Verify response symbol is uppercase.
- Verify historical dates and historical prices are returned.
- Verify forecast_dates length equals requested days.
- Verify ARIMA predictions length equals requested days.
- Verify LSTM predictions length equals requested days.
- Verify evaluation contains ARIMA and LSTM metrics.
- Verify indicators contain RSI, MACD, MACD signal, Bollinger upper, and Bollinger lower arrays.
- Verify invalid ticker returns an error message.

### Model Fallback Tests

- Run backend without `arima_universal.pkl` and verify ARIMA status is placeholder.
- Run backend without `lstm_stock_model.h5` and verify LSTM status is placeholder.
- Verify forecast still returns predictions when model files are missing.
- Verify evaluation source indicates placeholder when fallback predictions are used.

### Health API Tests

- Call `/api/health` and verify `status` equals `ok`.
- Verify response contains `models.arima`.
- Verify response contains `models.lstm`.
- Verify each model object contains status, loaded, path, and message fields.

### Search API Tests

- Call `/api/search?q=` and verify up to ten popular stocks are returned.
- Call `/api/search?q=AAPL` and verify AAPL is included.
- Call `/api/search?q=Apple` and verify Apple Inc. is included.
- Verify no more than eight results are returned for a non-empty search.

### Markets API Tests

- Call `/api/markets` and verify an array or error object is returned.
- Verify market rows include symbol, name, price, change, change_percent, high, and low.
- Verify known symbols such as SPY, QQQ, AAPL, and NVDA are handled when data is available.

### Prices API Tests

- Call `/api/prices?symbols=AAPL,MSFT` and verify a response object is returned.
- Verify returned keys are uppercase symbols when data is available.
- Call `/api/prices?symbols=` and verify empty or validation behavior is handled.

### UI Error Handling Tests

- Stop the backend and load the frontend sidebar, then verify model status shows backend unreachable or error.
- Request an invalid symbol and verify the forecast error banner appears.
- Click the dismiss button and verify the error banner disappears.

### Loading and Responsiveness Tests

- Trigger forecast generation and verify loading overlay appears.
- Verify loading overlay disappears after successful or failed request.
- Verify users can navigate between tabs without a full page reload.

### Reporting Tests

- Open Reports tab and verify the report view renders.
- Verify sidebar remains available on Reports page.
- Generate or select forecast data and verify report content can be prepared.
- Trigger print/report behavior and verify browser print flow is invoked.

### Technical Indicator Tests

- Verify RSI values are returned in the forecast response.
- Verify MACD and MACD signal values are returned.
- Verify Bollinger upper and lower band values are returned.
- Verify indicator arrays align with historical price series length where applicable.

### Non-Functional Tests

- Verify forecast workflow provides visible loading feedback during API latency.
- Verify backend remains available when model files are missing.
- Verify CORS allows the configured local frontend origin.
- Verify the app does not require login for current implemented features.
- Verify recent ticker storage does not contain sensitive information.

## Traceability Notes for Test Plan

| Requirement Area | Related Files | Suggested Evidence |
|---|---|---|
| Navigation and version | `frontend/src/components/Navbar.jsx` | UI screenshot or component inspection showing logo, tabs, v1.3. |
| Ticker input and suggestions | `frontend/src/components/Sidebar.jsx`, `/api/search` | UI test, API response test, localStorage check. |
| Forecast generation | `frontend/src/App.jsx`, `frontend/src/services/api.js`, `/api/forecast` | API test response, chart screenshot, loading/error tests. |
| ARIMA/LSTM fallback | `backend/main.py`, `backend/models/` | Health response and forecast response source fields. |
| Technical indicators | `backend/main.py`, `TechnicalIndicators.jsx` | API field assertions and UI display checks. |
| Markets | `MarketsView.jsx`, `/api/markets` | API response and Markets tab screenshot. |
| Reports | `ReportsView.jsx` | Report page screenshot and print trigger verification. |
| Error handling | `App.jsx`, `Sidebar.jsx`, `backend/main.py` | Backend-down test, invalid ticker test, model-missing test. |

## Recommended Test Execution Report Metrics

- Number of planned test cases.
- Number of executed test cases.
- Number of passed test cases.
- Number of failed test cases.
- Number of blocked test cases.
- Defect severity distribution.
- API response validation pass rate.
- UI workflow pass rate.
- Cross-module traceability coverage.
- Evidence captured, such as screenshots, API responses, console logs, and test output.
