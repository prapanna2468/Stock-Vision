const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Fetch with a timeout via AbortController.
 */
function fetchWithTimeout(url, timeoutMs = 10000, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

/**
 * Delay helper for retry back-off.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchForecast(symbol, days) {
  const url = `${API_BASE}/api/forecast?symbol=${encodeURIComponent(symbol)}&days=${days}`;
  const response = await fetchWithTimeout(url, 120000); // 2-min timeout for forecasts (model may still be loading)
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

/**
 * Check backend health with retry logic.
 * Retries up to `maxRetries` times with `retryDelayMs` between attempts.
 */
export async function checkHealth(maxRetries = 3, retryDelayMs = 3000) {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/api/health`, 10000);
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await delay(retryDelayMs);
      }
    }
  }
  throw lastError;
}

export async function fetchMarkets() {
  const response = await fetch(`${API_BASE}/api/markets`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
}

export async function fetchPrices(symbols) {
  const response = await fetch(`${API_BASE}/api/prices?symbols=${encodeURIComponent(symbols)}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

export async function searchStocks(query) {
  const response = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}
