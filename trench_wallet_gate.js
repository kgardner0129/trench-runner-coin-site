(function () {
  const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
  const state = {
    profile: null,
    wallet: '',
    walletSource: '',
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

  function purchaseUrl() {
    return String(tokenomics().purchaseUrl || 'https://pump.fun').trim();
  }

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  }

  function phantomBrowseUrl() {
    const current = window.location.href;
    const ref = window.location.origin || 'https://phantom.app';
    return `https://phantom.app/ul/browse/${encodeURIComponent(current)}?ref=${encodeURIComponent(ref)}`;
  }

  function openWalletBrowser() {
    const url = isMobile() ? phantomBrowseUrl() : 'https://phantom.app/download';
    if (isMobile()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  function setWallet(address, source = 'wallet') {
    state.wallet = String(address || '').trim();
    state.walletSource = source;
    return state.wallet;
  }

  function requiredBalance() {
    const value = Number(tokenomics().minHoldTokens || tokenomics().entryCost || 100);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  function holderRequiredToPlay() {
    return tokenomics().requireHolderToPlay === true;
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
    if (window.solana && typeof window.solana.connect === 'function') return window.solana;
    if (Array.isArray(window.solanaProviders)) {
      const compatible = window.solanaProviders.find((walletProvider) =>
        walletProvider && typeof walletProvider.connect === 'function' && walletProvider.publicKey !== undefined
      );
      if (compatible) return compatible;
    }
    return null;
  }

  async function connectWallet() {
    const p = provider();
    if (!p) {
      throw new Error(isMobile()
        ? 'Wallet connect is not available in this browser. Tap Open Wallet, then connect inside the wallet browser.'
        : 'Wallet connect is not available in this browser. Install/enable the Phantom browser extension, unlock it, refresh, then connect.');
    }
    showStatus('Opening wallet...');
    const result = await p.connect();
    setWallet(result.publicKey.toString(), 'connected');
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
      button.title = enabled ? '' : `Connect a wallet holding at least ${requiredBalance()} ${symbol()} to unlock holder mode.`;
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
        <div class="twg-flow">
          <span>1 Buy ${symbol()}</span>
          <span>2 Connect wallet</span>
          <span>3 Verify and play</span>
        </div>
        <div class="twg-help">Demo play is open. Holder mode checks for ${requiredBalance().toLocaleString()} ${symbol()}. On phones, open this page inside Phantom or another Solana wallet browser before connecting.</div>
        <div class="twg-row">
          <a id="twgBuy" href="${purchaseUrl()}" target="_blank" rel="noopener noreferrer">Buy Coin</a>
          <button id="twgOpenWallet">Open Wallet</button>
        </div>
        <div class="twg-row">
          <button id="twgConnect">Connect + Verify</button>
          <button id="twgCheck">Recheck</button>
        </div>
        <div class="twg-manual">
          <input id="twgAddress" autocomplete="off" spellcheck="false" placeholder="Paste wallet address to verify holdings">
          <button id="twgVerifyAddress">Verify Address</button>
        </div>
        <div class="twg-dex" id="twgDexStatus"></div>
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
        #trenchWalletGate .twg-help {
          margin-top: 7px;
          color: #8fa5a2;
          font-size: 11px;
          line-height: 1.35;
        }
        #trenchWalletGate .twg-flow {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
          margin-top: 8px;
          font-size: 10px;
          color: #d8f7ef;
        }
        #trenchWalletGate .twg-flow span {
          min-height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 7px;
          padding: 4px;
          background: rgba(255,255,255,.04);
        }
        #trenchWalletGate .twg-row {
          display: flex;
          gap: 8px;
          margin-top: 10px;
        }
        #trenchWalletGate .twg-manual {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 7px;
          margin-top: 8px;
        }
        #trenchWalletGate input {
          min-width: 0;
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 7px;
          padding: 8px;
          background: rgba(255,255,255,.05);
          color: #f3f8f7;
          font: inherit;
        }
        #trenchWalletGate button,
        #trenchWalletGate a {
          flex: 1;
          min-height: 36px;
          border: 0;
          border-radius: 7px;
          padding: 8px 10px;
          font-weight: 900;
          cursor: pointer;
          text-align: center;
          text-decoration: none;
          box-sizing: border-box;
        }
        #twgConnect,
        #twgBuy { background: #38d982; color: #04140b; }
        #twgCheck,
        #twgOpenWallet,
        #twgVerifyAddress { background: #263942; color: #f3f8f7; border: 1px solid rgba(255,255,255,.14); }
        #twgVerifyAddress { min-width: 112px; }
        #trenchWalletGate .twg-dex {
          margin-top: 9px;
          padding-top: 7px;
          border-top: 1px dashed rgba(255,255,255,.14);
          color: #ffd447;
          font-size: 11px;
        }
        #trenchWalletGate.verified { border-color: rgba(255,212,71,.75); }
        #trenchWalletGate.verified .twg-status { color: #d9ffe8; }
        @media (pointer: coarse), (max-width: 820px) {
          #trenchWalletGate {
            left: 8px;
            right: 8px;
            bottom: auto;
            top: 108px;
            width: auto;
            padding: 9px;
          }
          #trenchWalletGate .twg-title { margin-bottom: 4px; }
          #trenchWalletGate .twg-status { min-height: 0; font-size: 12px; }
          #trenchWalletGate .twg-help,
          #trenchWalletGate .twg-flow { display: none; }
          #trenchWalletGate .twg-row { margin-top: 7px; }
          #trenchWalletGate .twg-manual { grid-template-columns: 1fr; gap: 6px; }
          #trenchWalletGate button,
          #trenchWalletGate a { min-height: 34px; padding: 7px 8px; }
          #trenchWalletGate .twg-dex { margin-top: 7px; padding-top: 6px; }
        }
      `;
      document.head.appendChild(style);

      document.getElementById('twgOpenWallet').addEventListener('click', openWalletBrowser);
      document.getElementById('twgVerifyAddress').addEventListener('click', verifyManualAddress);
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
    refreshDexStatus();
  }

  function showStatus(message) {
    const status = document.getElementById('twgStatus');
    if (status) status.textContent = message;
  }

  async function verifyManualAddress() {
    const input = document.getElementById('twgAddress');
    const address = String(input && input.value || '').trim();
    if (!address) {
      showStatus('Paste your Pump.fun or Phantom wallet address first.');
      return false;
    }
    setWallet(address, 'pasted');
    return verifyHolder({ skipConnect: true });
  }

  function updatePanel() {
    const panel = document.getElementById('trenchWalletGate');
    if (panel) panel.classList.toggle('verified', state.verified);

    const buy = document.getElementById('twgBuy');
    if (buy) buy.href = purchaseUrl();

    const mint = mintAddress();
    if (!mint) {
      if (state.wallet) {
        showStatus(`Connected ${short(state.wallet)}. Demo play is open until holder mode is fully configured.`);
      } else {
        showStatus('Demo play is open. Holder verification turns on after the Pump.fun mint is added.');
      }
      setPlayEnabled(true);
      return;
    }

    if (state.verified) {
      const mode = state.walletSource === 'pasted' ? 'Address verified' : 'Wallet verified';
      showStatus(`${mode}: ${short(state.wallet)} holds ${state.balance.toLocaleString()} ${symbol()}. Holder mode unlocked.`);
      setPlayEnabled(true);
      return;
    }

    if (state.wallet) {
      showStatus(`${short(state.wallet)} holds ${state.balance.toLocaleString()} ${symbol()}. Need ${requiredBalance().toLocaleString()} ${symbol()} for holder mode. Demo play stays open.`);
    } else {
      showStatus(`Connect a Solana wallet, or paste a wallet address to verify holdings. Demo play stays open.`);
    }
    setPlayEnabled(!holderRequiredToPlay());
  }

  async function refreshDexStatus() {
    const dex = document.getElementById('twgDexStatus');
    if (!dex) return;

    if (!window.TrenchDexFund || !window.TrenchDexFund.isRequired()) {
      dex.textContent = 'DEX fund payment turns on after the secure backend URL is added.';
      return;
    }

    dex.textContent = 'Checking DEX fund status...';
    try {
      const status = await window.TrenchDexFund.status();
      if (status.dexGoalReached) {
        dex.textContent = 'DEX fund is complete. Extra SOL contribution is no longer required.';
      } else if (status.ready && status.solAmount) {
        dex.textContent = `Live entry includes about ${status.solAmount.toFixed(6)} SOL for the DEX fund until the goal is met.`;
      } else {
        dex.textContent = 'DEX fund is configured but not ready yet.';
      }
    } catch (error) {
      dex.textContent = `DEX fund status unavailable: ${error.message}`;
    }
  }

  async function verifyHolder(options = {}) {
    const mint = mintAddress();
    if (!mint) {
      if (!state.wallet && !options.skipConnect) await connectWallet();
      state.verified = false;
      updatePanel();
      return true;
    }
    if (!state.wallet && !options.skipConnect) await connectWallet();
    if (!state.wallet) {
      showStatus('Connect a wallet or paste a wallet address first.');
      return false;
    }

    state.checking = true;
    showStatus('Checking token balance on Solana...');
    try {
      state.balance = await tokenBalance(state.wallet, mint);
      state.verified = state.balance >= requiredBalance();
      if (state.verified && state.walletSource !== 'pasted' && window.TrenchDexFund && window.TrenchDexFund.isRequired()) {
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
      if (state.verified && state.walletSource === 'pasted' && window.TrenchDexFund && window.TrenchDexFund.isRequired()) {
        showStatus(`Address verified for holdings. Connect inside a Solana wallet browser to approve the SOL DEX contribution.`);
      }
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
      if (!button || state.verified || !mintAddress() || !holderRequiredToPlay()) return;

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
      setWallet(p.publicKey.toString(), 'connected');
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
