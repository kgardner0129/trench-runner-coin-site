(function () {
  const DEFAULT_API = 'http://localhost:8787';

  function apiBase() {
    const configured = window.TrenchCoinConfig && (window.TrenchCoinConfig.settlementApiBase || window.TrenchCoinConfig.apiBase);
    return String(window.TRENCH_API_BASE || configured || localStorage.getItem('trench_api_base') || DEFAULT_API).replace(/\/+$/, '');
  }

  async function request(path, options = {}) {
    const response = await fetch(`${apiBase()}${path}`, {
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Request failed: ${response.status}`);
    }
    return body;
  }

  async function connectWallet() {
    const provider = window.solana && window.solana.isPhantom ? window.solana : null;
    if (!provider) throw new Error('Phantom wallet was not found');
    const result = await provider.connect();
    return result.publicKey.toString();
  }

  async function getConfig() {
    return request('/config');
  }

  async function startRun(wallet, clientRunId = '') {
    return request('/runs/start', {
      method: 'POST',
      body: JSON.stringify({ wallet, clientRunId })
    });
  }

  async function finishRun({ wallet, runId, runSignature, reason, score, coinsCollected }) {
    return request('/runs/finish', {
      method: 'POST',
      body: JSON.stringify({ wallet, runId, runSignature, reason, score, coinsCollected })
    });
  }

  async function dailyLeaderboard(day) {
    const query = day ? `?day=${encodeURIComponent(day)}` : '';
    return request(`/leaderboard/daily${query}`);
  }

  async function vault() {
    return request('/vault');
  }

  window.TrenchLive = {
    apiBase,
    connectWallet,
    getConfig,
    startRun,
    finishRun,
    dailyLeaderboard,
    vault
  };
})();
