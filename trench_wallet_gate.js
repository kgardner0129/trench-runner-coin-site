(function () {
  const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
  const state = {
    profile: null,
    wallet: '',
    balance: 0,
    verified: false,
    checking: false
  };

  function short(address) {
    return address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';
  }

  function tokenomics() {
    return (state.profile && state.profile.tokenomics) || {};
  }

  function mintAddress() {
    return String(tokenomics().mint || tokenomics().tokenMint || '').trim();
  }

  function symbol() {
    return String(tokenomics().symbol || 'TOKEN').trim();
  }

  function requiredBalance() {
    const value = Number(tokenomics().minHoldTokens || tokenomics().entryCost || 100);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  async function loadProfile() {
    if (window.TrenchEmbeddedProfile) {
      state.profile = window.TrenchEmbeddedProfile;
      if (window.TrenchCoinConfig) {
        state.profile.tokenomics = Object.assign({}, state.profile.tokenomics || {}, window.TrenchCoinConfig);
      }
      return state.profile;
    }
    try {
      const response = await fetch('./profile.json', { cache: 'no-store' });
      if (response.ok) {
        state.profile = await response.json();
        if (window.TrenchCoinConfig) {
          state.profile.tokenomics = Object.assign({}, state.profile.tokenomics || {}, window.TrenchCoinConfig);
        }
        return state.profile;
      }
    } catch (_) {}
    state.profile = window.TrenchEmbeddedProfile || { tokenomics: {} };
    if (window.TrenchCoinConfig) {
      state.profile.tokenomics = Object.assign({}, state.profile.tokenomics || {}, window.TrenchCoinConfig);
    }
    return state.profile;
  }

  function provider() {
    const phantom = window.phantom && window.phantom.solana;
    if (phantom && phantom.isPhantom) return phantom;
    if (window.solana && window.solana.isPhantom) return window.solana;
    return null;
  }

  async function connectWallet() {
    const p = provider();
    if (!p) {
      window.open('https://phantom.app/download', '_blank', 'noopener,noreferrer');
      throw new Error('Phantom wallet was not found. Install Phantom, then refresh this page.');
    }
    showStatus('Opening Phantom wallet...');
    const result = await p.connect();
    state.wallet = result.publicKey.toString();
    showStatus(`Connected ${short(state.wallet)}.`);
    return state.wallet;
  }

  async function rpc(method, params) {
    const endpoint = String(tokenomics().rpcUrl || DEFAULT_RPC);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'trench-holder-check',
        method,
        params
      })
    });
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'Solana RPC error');
    return body.result;
  }

  async function tokenBalance(owner, mint) {
    const result = await rpc('getTokenAccountsByOwner', [
      owner,
      { mint },
      { encoding: 'jsonParsed' }
    ]);

    return (result.value || []).reduce((total, account) => {
      const amount = account.account && account.account.data &&
        account.account.data.parsed &&
        account.account.data.parsed.info &&
        account.account.data.parsed.info.tokenAmount;
      const uiAmount = Number(amount && (amount.uiAmountString || amount.uiAmount || 0));
      return total + (Number.isFinite(uiAmount) ? uiAmount : 0);
    }, 0);
  }

  function setPlayEnabled(enabled) {
    for (const id of ['playBtn', 'replayBtn', 'continueBtn']) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.disabled = !enabled;
      button.style.opacity = enabled ? '' : '.55';
      button.style.cursor = enabled ? '' : 'not-allowed';
      button.title = enabled ? '' : `Connect a wallet holding at least ${requiredBalance()} ${symbol()} to play.`;
    }
  }

  function drawPanel() {
    let panel = document.getElementById('trenchWalletGate');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'trenchWalletGate';
      panel.innerHTML = `
        <div class="twg-title">Holder Access</div>
        <div class="twg-status" id="twgStatus"></div>
        <div class="twg-row">
          <button id="twgConnect">Connect Wallet</button>
          <button id="twgCheck">Check Holdings</button>
        </div>
      `;
      document.body.appendChild(panel);

      const style = document.createElement('style');
      style.textContent = `
        #trenchWalletGate {
          position: fixed;
          left: 12px;
          bottom: 12px;
          z-index: 2147483000;
          width: min(360px, calc(100vw - 24px));
          padding: 12px;
          border: 1px solid rgba(56,217,130,.65);
          border-radius: 8px;
          background: rgba(7,18,22,.94);
          color: #f3f8f7;
          box-shadow: 0 18px 50px rgba(0,0,0,.38);
          font: 13px/1.35 system-ui, -apple-system, Segoe UI, sans-serif;
        }
        #trenchWalletGate .twg-title {
          font-weight: 900;
          margin-bottom: 6px;
          color: #ffd447;
        }
        #trenchWalletGate .twg-status {
          color: #b7cbc8;
          min-height: 38px;
        }
        #trenchWalletGate .twg-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        #trenchWalletGate button {
          flex: 1;
          min-height: 36px;
          border: 0;
          border-radius: 7px;
          padding: 8px 10px;
          font-weight: 900;
          cursor: pointer;
        }
        #twgConnect { background: #38d982; color: #04140b; }
        #twgCheck { background: #263942; color: #f3f8f7; border: 1px solid rgba(255,255,255,.14); }
        #trenchWalletGate.verified { border-color: rgba(255,212,71,.75); }
        #trenchWalletGate.verified .twg-status { color: #d9ffe8; }
      `;
      document.head.appendChild(style);

      document.getElementById('twgConnect').addEventListener('click', async () => {
        try {
          await connectWallet();
          await verifyHolder();
        } catch (error) {
          showStatus(error.message);
        }
      });
      document.getElementById('twgCheck').addEventListener('click', verifyHolder);
    }
    updatePanel();
  }

  function showStatus(message) {
    const status = document.getElementById('twgStatus');
    if (status) status.textContent = message;
  }

  function updatePanel() {
    const panel = document.getElementById('trenchWalletGate');
    if (panel) panel.classList.toggle('verified', state.verified);

    const mint = mintAddress();
    if (!mint) {
      if (state.wallet) {
        showStatus(`Connected ${short(state.wallet)}. Token mint is not set yet, so demo play is open until the Pump.fun mint is added to coin_config.js.`);
      } else {
        showStatus('Token mint is not set yet. Demo play is open until the Pump.fun mint is added to coin_config.js.');
      }
      setPlayEnabled(true);
      return;
    }

    if (state.verified) {
      showStatus(`Verified ${short(state.wallet)} holds ${state.balance.toLocaleString()} ${symbol()}. Play unlocked.`);
      setPlayEnabled(true);
      return;
    }

    if (state.wallet) {
      showStatus(`${short(state.wallet)} holds ${state.balance.toLocaleString()} ${symbol()}. Need ${requiredBalance().toLocaleString()} ${symbol()} to play.`);
    } else {
      showStatus(`Connect Phantom. Requires ${requiredBalance().toLocaleString()} ${symbol()} to play.`);
    }
    setPlayEnabled(false);
  }

  async function verifyHolder() {
    const mint = mintAddress();
    if (!mint) {
      if (!state.wallet) await connectWallet();
      state.verified = false;
      updatePanel();
      return true;
    }
    if (!state.wallet) await connectWallet();

    state.checking = true;
    showStatus('Checking token balance on Solana...');
    try {
      state.balance = await tokenBalance(state.wallet, mint);
      state.verified = state.balance >= requiredBalance();
      if (state.verified && window.TrenchDexFund && window.TrenchDexFund.isRequired()) {
        try {
          await window.TrenchDexFund.ensureContribution(state.wallet);
        } catch (error) {
          state.verified = false;
          showStatus(`DEX fund payment required: ${error.message}`);
          setPlayEnabled(false);
          return false;
        }
      }
      updatePanel();
      return state.verified;
    } catch (error) {
      state.verified = false;
      showStatus(`Could not verify holdings: ${error.message}`);
      setPlayEnabled(false);
      return false;
    } finally {
      state.checking = false;
    }
  }

  function interceptPlayClicks() {
    document.addEventListener('click', async (event) => {
      const button = event.target && event.target.closest && event.target.closest('#playBtn,#replayBtn,#continueBtn');
      if (!button || state.verified || !mintAddress()) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      await verifyHolder();
      if (state.verified) button.click();
    }, true);
  }

  async function init() {
    await loadProfile();
    drawPanel();
    interceptPlayClicks();
    const p = provider();
    if (p && p.isConnected && p.publicKey) {
      state.wallet = p.publicKey.toString();
      verifyHolder();
    }
  }

  window.TrenchWalletGate = {
    connectWallet,
    verifyHolder,
    state,
    loadProfile
  };

  window.addEventListener('DOMContentLoaded', init);
})();
