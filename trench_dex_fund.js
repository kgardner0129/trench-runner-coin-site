(function () {
  const WEB3_CDN = 'https://cdn.jsdelivr.net/npm/@solana/web3.js@1.98.4/lib/index.iife.min.js';
  const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
  const state = {
    quote: null,
    lastSignature: '',
    paid: false
  };

  function config() {
    return window.TrenchCoinConfig || {};
  }

  function apiBase() {
    const configured = config().settlementApiBase || window.TRENCH_API_BASE || localStorage.getItem('trench_api_base') || '';
    return String(configured || '').replace(/\/+$/, '');
  }

  function provider() {
    const phantom = window.phantom && window.phantom.solana;
    if (phantom && phantom.isPhantom) return phantom;
    if (window.solana && window.solana.isPhantom) return window.solana;
    return null;
  }

  function show(message) {
    const status = document.getElementById('twgStatus');
    if (status) status.textContent = message;
  }

  async function request(path, options = {}) {
    const base = apiBase();
    if (!base) throw new Error('Settlement API is not configured yet.');
    const response = await fetch(`${base}${path}`, {
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed: ${response.status}`);
    return body;
  }

  async function loadWeb3() {
    if (window.solanaWeb3) return window.solanaWeb3;
    await new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${WEB3_CDN}"]`);
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = WEB3_CDN;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Solana transaction library.'));
      document.head.appendChild(script);
    });
    if (!window.solanaWeb3) throw new Error('Solana transaction library did not load.');
    return window.solanaWeb3;
  }

  async function status() {
    const quote = await request('/dex/status');
    state.quote = quote;
    return quote;
  }

  function isRequired() {
    const c = config();
    return Boolean(apiBase() && c.dexFundWallet);
  }

  async function ensureContribution(wallet) {
    if (!isRequired()) return { skipped: true, reason: 'DEX fund is not configured' };

    const quote = await status();
    if (!quote.ready || !quote.lamports || quote.dexGoalReached) {
      state.paid = true;
      return { skipped: true, reason: 'DEX fund goal is already met', quote };
    }

    const p = provider();
    if (!p) throw new Error('Phantom wallet was not found. Install Phantom, then refresh this page.');

    const connected = wallet || (p.publicKey && p.publicKey.toString());
    if (!connected) {
      const result = await p.connect();
      wallet = result.publicKey.toString();
    } else {
      wallet = connected;
    }

    show(`Approve ${quote.solAmount.toFixed(6)} SOL for the DEX fund in Phantom.`);
    const web3 = await loadWeb3();
    const connection = new web3.Connection(config().rpcUrl || DEFAULT_RPC, 'confirmed');
    const fromPubkey = new web3.PublicKey(wallet);
    const toPubkey = new web3.PublicKey(quote.dexFundWallet || config().dexFundWallet);
    const tx = new web3.Transaction().add(web3.SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Number(quote.lamports)
    }));
    tx.feePayer = fromPubkey;
    const blockhash = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash.blockhash;

    const sent = await p.signAndSendTransaction(tx);
    const signature = sent.signature || sent;
    state.lastSignature = signature;

    show('Confirming DEX fund payment on-chain...');
    const confirmed = await request('/dex/confirm', {
      method: 'POST',
      body: JSON.stringify({ wallet, signature })
    });
    state.paid = true;
    show(`DEX fund payment confirmed: ${quote.solAmount.toFixed(6)} SOL.`);
    return confirmed;
  }

  window.TrenchDexFund = {
    state,
    isRequired,
    status,
    ensureContribution
  };
})();
