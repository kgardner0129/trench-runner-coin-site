(function () {
  'use strict';

  const PROFILE_ID = safeProfileId(window.TrenchProfileId || (window.TrenchEmbeddedProfile && window.TrenchEmbeddedProfile.tokenomics && (window.TrenchEmbeddedProfile.tokenomics.symbol || window.TrenchEmbeddedProfile.tokenomics.profileName)) || 'default');
  const KEY_PREFIX = `trench_${PROFILE_ID}_`;
  const STORE = `${KEY_PREFIX}tokenomics_v1`;
  const RUN = `${KEY_PREFIX}active_run_v1`;
  const HISTORY = `${KEY_PREFIX}run_history_v1`;
  const PROFILE_EXPORT_VERSION = 1;
  const BUILD_MODE = window.TrenchBuildMode || (window.TRENCH_PLAYER_BUILD ? 'player' : 'admin');
  const IS_PLAYER_BUILD = BUILD_MODE === 'player';

  const defaults = {
    coinName: 'Trench Runner Coin',
    symbol: 'TRENCH',
    mint: '',
    decimals: 6,
    mode: 'simulation',
    entryCost: 100,
    rugPenalty: 50,
    snipePenalty: 25,
    burnPercent: 10,
    rewardVaultPercent: 90,
    dailyWinnerPercent: 10,
    minVaultReserve: 0,
    dexContributionUsd: 1,
    dexGoalUsd: 299,
    playerBalance: 10000,
    escrowBalance: 0,
    rewardVaultBalance: 0,
    burnedTotal: 0,
    dexFundUsd: 0,
    walletAddress: '',
    profileName: 'Default Coin Skin',
    leaderboard: []
  };

  const $ = (id) => document.getElementById(id);
  const money = (n, digits = 2) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
  const token = (n, state) => `${money(n, 4)} ${state.symbol || 'TOKEN'}`;

  function safeProfileId(value) {
    return String(value || 'default')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'default';
  }

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function state() {
    const embedded = (window.TrenchEmbeddedProfile && window.TrenchEmbeddedProfile.tokenomics) || {};
    return Object.assign({}, defaults, embedded, load(STORE, {}));
  }

  function setState(next) {
    save(STORE, Object.assign(state(), next));
    render();
  }

  function nowDay() {
    return new Date().toISOString().slice(0, 10);
  }

  function currentRun() {
    return load(RUN, null);
  }

  function setRun(run) {
    if (run) save(RUN, run);
    else localStorage.removeItem(RUN);
    render();
  }

  function addHistory(row) {
    const rows = load(HISTORY, []);
    rows.unshift(row);
    save(HISTORY, rows.slice(0, 100));
  }

  function ensureUi() {
    if ($('trenchTokenomics')) return;
    if (IS_PLAYER_BUILD) {
      ensurePlayerUi();
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      #trenchTokenToggle{position:fixed;left:10px;top:58px;z-index:2147483647;background:#ffd84d;color:#181200;border:none;border-radius:8px;padding:9px 12px;font-weight:900;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}
      #trenchTokenomics{position:fixed;left:10px;top:102px;width:min(430px,calc(100vw - 20px));max-height:calc(100vh - 116px);overflow:auto;z-index:2147483646;background:rgba(8,14,18,.96);border:1px solid rgba(255,216,77,.55);border-radius:8px;color:#eef6f6;font:13px system-ui,-apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.45);display:none}
      #trenchTokenomics.open{display:block}
      #trenchTokenomics header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.12)}
      #trenchTokenomics h2{font-size:15px;margin:0}
      #trenchTokenomics h3{font-size:13px;margin:12px 0 6px;color:#ffd84d}
      #trenchTokenomics .body{padding:10px 12px}
      #trenchTokenomics .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #trenchTokenomics label{display:block;font-size:11px;color:#b7c7c9;margin-bottom:3px}
      #trenchTokenomics input,#trenchTokenomics select,#trenchTokenomics textarea{width:100%;background:#0d1820;color:#eef6f6;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:7px;font:inherit}
      #trenchTokenomics textarea{min-height:88px;resize:vertical}
      #trenchTokenomics button{background:#246bfe;color:white;border:none;border-radius:6px;padding:8px 10px;font-weight:800;cursor:pointer}
      #trenchTokenomics button.secondary{background:#263542}
      #trenchTokenomics button.good{background:#28c76f;color:#061218}
      #trenchTokenomics button.warn{background:#ffd84d;color:#181200}
      #trenchTokenomics button.danger{background:#ff4d4d}
      #trenchTokenomics .row{display:flex;gap:8px;align-items:center;margin:8px 0}
      #trenchTokenomics .row>*{flex:1}
      #trenchTokenomics .metric{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px}
      #trenchTokenomics .metric b{display:block;font-size:12px;color:#ffd84d;margin-top:2px}
      #trenchTokenomics .bar{height:8px;border-radius:999px;background:#1d2b34;overflow:hidden}
      #trenchTokenomics .bar span{display:block;height:100%;background:#ffd84d;width:0%}
      #trenchTokenomics .small{font-size:11px;color:#aebfc2;line-height:1.35}
      #trenchTokenomics .pill{display:inline-block;padding:2px 6px;border-radius:999px;background:rgba(255,216,77,.16);color:#ffe58a;font-size:11px}
      #trenchTokenToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;background:#0d1820;color:#eef6f6;border:1px solid #ffd84d;border-radius:8px;padding:9px 12px;display:none;box-shadow:0 10px 32px rgba(0,0,0,.35);font:13px system-ui}
    `;
    document.head.appendChild(style);

    const toggle = document.createElement('button');
    toggle.id = 'trenchTokenToggle';
    toggle.textContent = 'Tokenomics';
    document.body.appendChild(toggle);

    const panel = document.createElement('section');
    panel.id = 'trenchTokenomics';
    panel.innerHTML = `
      <header>
        <h2>Coin Game Engine <span class="pill" id="ttModePill">Simulation</span></h2>
        <button class="secondary" id="ttClose">Close</button>
      </header>
      <div class="body">
        <div class="grid">
          <div><label>Coin name</label><input id="ttCoinName"></div>
          <div><label>Symbol</label><input id="ttSymbol"></div>
          <div><label>Mint address</label><input id="ttMint" placeholder="Pump.fun/Solana mint"></div>
          <div><label>Decimals</label><input id="ttDecimals" type="number" min="0" max="12"></div>
        </div>

        <h3>Run Economics</h3>
        <div class="grid">
          <div><label>Entry cost</label><input id="ttEntry" type="number" min="0" step="0.000001"></div>
          <div><label>Rug penalty</label><input id="ttRug" type="number" min="0" step="0.000001"></div>
          <div><label>Snipe penalty</label><input id="ttSnipe" type="number" min="0" step="0.000001"></div>
          <div><label>Daily winner % of vault</label><input id="ttDailyPct" type="number" min="0" max="100" step="0.1"></div>
          <div><label>Burn % of penalties</label><input id="ttBurnPct" type="number" min="0" max="100" step="0.1"></div>
          <div><label>Reward vault %</label><input id="ttVaultPct" type="number" min="0" max="100" step="0.1"></div>
          <div><label>Min vault reserve</label><input id="ttReserve" type="number" min="0" step="0.000001"></div>
          <div><label>DEX fund per play USD</label><input id="ttDexEach" type="number" min="0" step="0.01"></div>
        </div>

        <h3>Reusable Coin Skin</h3>
        <div class="grid">
          <div><label>Profile name</label><input id="ttProfile"></div>
          <div><label>DEX goal USD</label><input id="ttDexGoal" type="number" min="0" step="1"></div>
        </div>
        <div class="row">
          <button class="warn" id="ttOpenArt">Open Art Settings</button>
          <button class="secondary" id="ttSaveDefaults">Save Art/Settings Defaults</button>
        </div>

        <h3>Balances</h3>
        <div class="grid">
          <div class="metric">Player balance<b id="ttPlayerBal"></b></div>
          <div class="metric">Reward vault<b id="ttRewardVault"></b></div>
          <div class="metric">Burned total<b id="ttBurned"></b></div>
          <div class="metric">Escrow / active run<b id="ttEscrow"></b></div>
        </div>
        <div class="metric" style="margin-top:8px">DEX Screener fund<b id="ttDexFund"></b><div class="bar"><span id="ttDexBar"></span></div></div>

        <h3>Wallet / Test Controls</h3>
        <div class="row">
          <button class="good" id="ttConnect">Connect Phantom</button>
          <button class="secondary" id="ttSeed">Seed Test Balance</button>
        </div>
        <div class="row">
          <button id="ttStartRun">Start Token Run</button>
          <button class="danger" id="ttCancelRun">Cancel Active Run</button>
        </div>
        <div class="small" id="ttWallet"></div>
        <div class="small" style="margin-top:8px">Current build uses simulation accounting first. The same profile fields are the config we will point at a Solana escrow program when we move to devnet/mainnet.</div>

        <h3>Profile Export / Import</h3>
        <div class="row">
          <button class="secondary" id="ttExport">Export Profile</button>
          <button class="secondary" id="ttImport">Import Profile</button>
        </div>
        <textarea id="ttProfileJson" spellcheck="false" placeholder="Exported profile JSON appears here"></textarea>
      </div>
    `;
    document.body.appendChild(panel);

    const toast = document.createElement('div');
    toast.id = 'trenchTokenToast';
    document.body.appendChild(toast);

    toggle.addEventListener('click', () => panel.classList.toggle('open'));
    $('ttClose').addEventListener('click', () => panel.classList.remove('open'));

    bindInputs();
    bindActions();
  }

  function ensurePlayerUi() {
    if ($('trenchPlayerLock')) return;
    const style = document.createElement('style');
    style.id = 'trenchPlayerLock';
    style.textContent = `
      #settingsBtn,
      #drawer,
      #passwordPrompt,
      #openArtSettingsHelper,
      #trenchTokenToggle,
      #trenchTokenomics,
      #vvc-root,
      #vvc-mask,
      #vvc-panel,
      #vvc-guard,
      #vvc-password-modal,
      #vvc-warn { display:none !important; pointer-events:none !important; }
      #playBtn,#pauseBtn{display:inline-flex !important}
      #trenchPlayerStatus{position:fixed;left:10px;top:58px;z-index:2147483645;background:rgba(8,14,18,.86);color:#eef6f6;border:1px solid rgba(255,216,77,.55);border-radius:8px;padding:8px 10px;font:12px system-ui,-apple-system,Segoe UI,Arial,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.32)}
      #trenchPlayerStatus b{color:#ffd84d}
    `;
    document.head.appendChild(style);

    const status = document.createElement('div');
    status.id = 'trenchPlayerStatus';
    document.body.appendChild(status);

    const hideAdmin = () => {
      for (const id of ['settingsBtn', 'drawer', 'passwordPrompt', 'openArtSettingsHelper', 'trenchTokenToggle', 'trenchTokenomics', 'vvc-root', 'vvc-mask', 'vvc-panel', 'vvc-guard', 'vvc-password-modal', 'vvc-warn']) {
        const el = $(id);
        if (el) el.style.display = 'none';
      }
      renderPlayerStatus();
    };
    hideAdmin();
    setInterval(hideAdmin, 1500);
  }

  function toast(message) {
    const el = $('trenchTokenToast');
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 2300);
  }

  function numberFrom(id) {
    return Number($(id).value || 0);
  }

  function bindInputs() {
    const fields = {
      ttCoinName: 'coinName',
      ttSymbol: 'symbol',
      ttMint: 'mint',
      ttDecimals: 'decimals',
      ttEntry: 'entryCost',
      ttRug: 'rugPenalty',
      ttSnipe: 'snipePenalty',
      ttBurnPct: 'burnPercent',
      ttVaultPct: 'rewardVaultPercent',
      ttDailyPct: 'dailyWinnerPercent',
      ttReserve: 'minVaultReserve',
      ttDexEach: 'dexContributionUsd',
      ttDexGoal: 'dexGoalUsd',
      ttProfile: 'profileName'
    };
    for (const [id, key] of Object.entries(fields)) {
      $(id).addEventListener('change', () => {
        const current = state();
        const value = ['coinName', 'symbol', 'mint', 'profileName'].includes(key) ? $(id).value : numberFrom(id);
        current[key] = value;
        if (key === 'burnPercent') current.rewardVaultPercent = Math.max(0, 100 - value);
        if (key === 'rewardVaultPercent') current.burnPercent = Math.max(0, 100 - value);
        setState(current);
      });
    }
  }

  function bindActions() {
    $('ttSeed').addEventListener('click', () => {
      const s = state();
      setState({ playerBalance: Math.max(Number(s.playerBalance || 0), 10000) });
      toast('Seeded simulation balance');
    });

    $('ttConnect').addEventListener('click', async () => {
      const provider = window.solana && window.solana.isPhantom ? window.solana : null;
      if (!provider) {
        toast('Phantom not found. Staying in simulation mode.');
        return;
      }
      try {
        const res = await provider.connect();
        setState({ walletAddress: String(res.publicKey), mode: 'wallet-detected' });
        toast('Wallet detected. Transactions are still simulation until devnet wiring.');
      } catch (_) {
        toast('Wallet connection cancelled');
      }
    });

    $('ttStartRun').addEventListener('click', () => startTokenRun(true));
    $('ttCancelRun').addEventListener('click', () => {
      const run = currentRun();
      if (!run) return toast('No active token run');
      const s = state();
      setState({ playerBalance: Number(s.playerBalance) + Number(run.entryCost), escrowBalance: Math.max(0, Number(s.escrowBalance) - Number(run.entryCost)) });
      setRun(null);
      toast('Active run refunded in simulation');
    });

    $('ttOpenArt').addEventListener('click', () => {
      const helper = $('openArtSettingsHelper');
      if (helper) helper.click();
      else {
        const btn = $('settingsBtn');
        if (btn) btn.click();
      }
    });

    $('ttSaveDefaults').addEventListener('click', () => {
      const btn = $('saveDefaultsBtn');
      if (btn) {
        btn.click();
        mirrorGameKeysToScoped();
        toast('Saved current game art/settings as defaults for this coin skin');
      } else {
        toast('Could not find game defaults button');
      }
    });

    $('ttExport').addEventListener('click', exportProfile);
    $('ttImport').addEventListener('click', importProfile);
  }

  function render() {
    if (IS_PLAYER_BUILD) {
      renderPlayerStatus();
      return;
    }
    if (!$('trenchTokenomics')) return;
    const s = state();
    const run = currentRun();
    $('ttModePill').textContent = s.mode === 'simulation' ? 'Simulation' : 'Wallet Detected';
    $('ttCoinName').value = s.coinName;
    $('ttSymbol').value = s.symbol;
    $('ttMint').value = s.mint;
    $('ttDecimals').value = s.decimals;
    $('ttEntry').value = s.entryCost;
    $('ttRug').value = s.rugPenalty;
    $('ttSnipe').value = s.snipePenalty;
    $('ttBurnPct').value = s.burnPercent;
    $('ttVaultPct').value = s.rewardVaultPercent;
    $('ttDailyPct').value = s.dailyWinnerPercent;
    $('ttReserve').value = s.minVaultReserve;
    $('ttDexEach').value = s.dexContributionUsd;
    $('ttDexGoal').value = s.dexGoalUsd;
    $('ttProfile').value = s.profileName;
    $('ttPlayerBal').textContent = token(s.playerBalance, s);
    $('ttRewardVault').textContent = token(s.rewardVaultBalance, s);
    $('ttBurned').textContent = token(s.burnedTotal, s);
    $('ttEscrow').textContent = run ? `${token(run.entryCost, s)} active` : token(s.escrowBalance, s);
    $('ttDexFund').textContent = `$${money(s.dexFundUsd)} / $${money(s.dexGoalUsd)}`;
    $('ttDexBar').style.width = `${Math.max(0, Math.min(100, Number(s.dexFundUsd || 0) / Math.max(1, Number(s.dexGoalUsd || 1)) * 100))}%`;
    $('ttWallet').textContent = s.walletAddress ? `Wallet: ${s.walletAddress}` : 'No wallet connected. Simulation balances are local to this browser.';
  }

  function renderPlayerStatus() {
    const el = $('trenchPlayerStatus');
    if (!el) return;
    const s = state();
    const run = currentRun();
    el.innerHTML = `<b>${s.symbol || 'TOKEN'}</b> Entry: ${money(s.entryCost, 4)} | Rug: ${money(s.rugPenalty, 4)} | Snipe: ${money(s.snipePenalty, 4)} | Vault: ${money(s.rewardVaultBalance, 2)}${run ? ' | RUN ACTIVE' : ''}`;
  }

  function startTokenRun(manual) {
    const s = state();
    if (currentRun()) {
      if (manual) toast('A token run is already active');
      return true;
    }
    if (Number(s.playerBalance) < Number(s.entryCost)) {
      toast(`Need ${token(s.entryCost, s)} to start`);
      return false;
    }
    const run = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      day: nowDay(),
      entryCost: Number(s.entryCost),
      startedAt: new Date().toISOString(),
      startScore: 0
    };
    setState({
      playerBalance: Number(s.playerBalance) - Number(s.entryCost),
      escrowBalance: Number(s.escrowBalance) + Number(s.entryCost),
      dexFundUsd: Number(s.dexFundUsd) + Number(s.dexContributionUsd)
    });
    setRun(run);
    if (manual) {
      const play = $('playBtn');
      if (play) play.click();
    }
    toast(`Run escrowed: ${token(run.entryCost, s)} + $${money(s.dexContributionUsd)} DEX fund`);
    return true;
  }

  function settleRun(reason) {
    const run = currentRun();
    if (!run || run.settled) return;

    const s = state();
    const isSnipe = /snip/i.test(reason || '');
    const penalty = isSnipe ? Number(s.snipePenalty) : Number(s.rugPenalty);
    const boundedPenalty = Math.min(Number(run.entryCost), penalty);
    const burn = boundedPenalty * Number(s.burnPercent) / 100;
    const toVault = boundedPenalty * Number(s.rewardVaultPercent) / 100;
    const refund = Math.max(0, Number(run.entryCost) - boundedPenalty);
    const collectedAfterPenalty = window.__world ? Number(window.__world.collected || 0) : 0;
    const originalCoins = extractOriginalCoins();
    const collected = Number.isFinite(originalCoins) ? originalCoins : collectedAfterPenalty;
    const score = window.__world ? Math.floor(Number(window.__world.score || 0)) : 0;

    setState({
      playerBalance: Number(s.playerBalance) + refund,
      escrowBalance: Math.max(0, Number(s.escrowBalance) - Number(run.entryCost)),
      rewardVaultBalance: Number(s.rewardVaultBalance) + toVault,
      burnedTotal: Number(s.burnedTotal) + burn,
      leaderboard: updateLeaderboard(s.leaderboard || [], score, collected)
    });
    setRun(null);

    const row = {
      id: run.id,
      day: run.day,
      reason: isSnipe ? 'sniped' : 'rugged',
      entryCost: run.entryCost,
      penalty: boundedPenalty,
      burn,
      rewardVault: toVault,
      refund,
      collected,
      collectedAfterPenalty,
      score,
      settledAt: new Date().toISOString()
    };
    addHistory(row);
    writeSettlement(row);
    toast(`${row.reason.toUpperCase()}: burned ${token(burn, s)}, vault +${token(toVault, s)}, refund ${token(refund, s)}`);
  }

  function updateLeaderboard(rows, score, collected) {
    const s = state();
    const wallet = s.walletAddress || 'LOCAL-DEMO';
    const next = rows.concat([{ day: nowDay(), wallet, score, collected, at: new Date().toISOString() }]);
    return next.sort((a, b) => b.score - a.score).slice(0, 50);
  }

  function writeSettlement(row) {
    const el = $('penaltySub');
    if (!el) return;
    const s = state();
    const payout = dailyPreview(s);
    el.innerHTML = `${el.textContent || ''}<br>Token settlement: ${row.reason} penalty ${token(row.penalty, s)} | burn ${token(row.burn, s)} | reward vault +${token(row.rewardVault, s)} | refund ${token(row.refund, s)}<br>Coins collected this run: ${row.collected} before penalty, ${row.collectedAfterPenalty} after penalty.<br>Daily vault prize preview: ${token(payout, s)} (${s.dailyWinnerPercent}% of available vault).`;
  }

  function extractOriginalCoins() {
    const text = (($('penaltySub') && $('penaltySub').textContent) || '').replace(/,/g, '');
    const match = text.match(/Coins:\s*(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : NaN;
  }

  function dailyPreview(s) {
    const available = Math.max(0, Number(s.rewardVaultBalance) - Number(s.minVaultReserve));
    return available * Number(s.dailyWinnerPercent) / 100;
  }

  function exportProfile() {
    const payload = {
      version: PROFILE_EXPORT_VERSION,
      tokenomics: state(),
      gameSettings: load('vvc_settings_v716', null),
      artPack: load('vvc_art_pack_v83', null),
      defaults: {
        gameSettings: load('vvc_settings_defaults_v716', null),
        artPack: load('vvc_art_defaults_v83', null)
      }
    };
    $('ttProfileJson').value = JSON.stringify(payload, null, 2);
    toast('Profile exported');
  }

  function importProfile() {
    try {
      const payload = JSON.parse($('ttProfileJson').value);
      if (!payload || payload.version !== PROFILE_EXPORT_VERSION) throw new Error('Unsupported profile');
      if (payload.tokenomics) setState(payload.tokenomics);
      if (payload.gameSettings) { save('vvc_settings_v716', payload.gameSettings); save(scopedGameKey('vvc_settings_v716'), payload.gameSettings); }
      if (payload.artPack) { save('vvc_art_pack_v83', payload.artPack); save(scopedGameKey('vvc_art_pack_v83'), payload.artPack); }
      if (payload.defaults && payload.defaults.gameSettings) { save('vvc_settings_defaults_v716', payload.defaults.gameSettings); save(scopedGameKey('vvc_settings_defaults_v716'), payload.defaults.gameSettings); }
      if (payload.defaults && payload.defaults.artPack) { save('vvc_art_defaults_v83', payload.defaults.artPack); save(scopedGameKey('vvc_art_defaults_v83'), payload.defaults.artPack); }
      toast('Profile imported. Reload to fully apply art/settings.');
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    }
  }

  function installPlayInterceptor() {
    const play = $('playBtn');
    if (!play || play._trenchTokenHooked) return;
    play._trenchTokenHooked = true;
    play.addEventListener('click', (event) => {
      if (currentRun()) return;
      const ok = startTokenRun(false);
      if (!ok) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function installEndObserver() {
    const gameover = $('gameover');
    if (!gameover || gameover._trenchTokenObserved) return;
    gameover._trenchTokenObserved = true;
    const observer = new MutationObserver(() => {
      const visible = getComputedStyle(gameover).display !== 'none';
      if (!visible) return;
      const title = ($('goTitle') && $('goTitle').textContent) || '';
      settleRun(title);
    });
    observer.observe(gameover, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  function boot() {
    applyEmbeddedProfileOnce();
    save(STORE, state());
    ensureUi();
    installPlayInterceptor();
    installEndObserver();
    if (!IS_PLAYER_BUILD) {
      mirrorGameKeysToScoped();
      setInterval(mirrorGameKeysToScoped, 2500);
    }
    render();
  }

  function scopedGameKey(key) {
    return `${KEY_PREFIX}${key}`;
  }

  function applyEmbeddedProfileOnce() {
    const profile = window.TrenchEmbeddedProfile;
    if (!profile) return;
    const appliedKey = `${KEY_PREFIX}embedded_profile_applied_v1`;
    if (load(appliedKey, false)) return;
    if (profile.tokenomics) save(STORE, Object.assign({}, defaults, profile.tokenomics));
    if (profile.gameSettings) save(scopedGameKey('vvc_settings_v716'), profile.gameSettings);
    if (profile.artPack) save(scopedGameKey('vvc_art_pack_v83'), profile.artPack);
    if (profile.defaults && profile.defaults.gameSettings) save(scopedGameKey('vvc_settings_defaults_v716'), profile.defaults.gameSettings);
    if (profile.defaults && profile.defaults.artPack) save(scopedGameKey('vvc_art_defaults_v83'), profile.defaults.artPack);
    save(appliedKey, true);
  }

  function mirrorGameKeysToScoped() {
    for (const key of ['vvc_settings_v716', 'vvc_art_pack_v83', 'vvc_settings_defaults_v716', 'vvc_art_defaults_v83']) {
      const value = load(key, null);
      if (value !== null) save(scopedGameKey(key), value);
    }
  }

  window.TrenchTokenomics = {
    state,
    setState,
    startTokenRun,
    settleRun,
    exportProfile,
    importProfile
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
