(function () {
  'use strict';

  const SETTINGS_KEY = 'trench_perf_settings_v1';
  const defaults = {
    enabled: true,
    maxUploadSize: 512,
    jpegQuality: 0.82,
    maxCacheSize: 128,
    showFps: true
  };

  const state = Object.assign({}, defaults, load(SETTINGS_KEY, {}));
  const cache = new Map();
  let originalDrawImage = null;
  let frameCount = 0;
  let fpsLast = performance.now();
  let fps = 0;

  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
    } catch (_) {}
  }

  function isDataImage(src) {
    return typeof src === 'string' && src.startsWith('data:image/');
  }

  function optimizeDataUrl(dataUrl, maxSize, quality) {
    return new Promise((resolve) => {
      if (!isDataImage(dataUrl)) return resolve(dataUrl);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const longest = Math.max(w, h);
        if (!longest || longest <= maxSize && dataUrl.length < 400000) return resolve(dataUrl);

        const scale = Math.min(1, maxSize / longest);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function optimizeStoredArt(key) {
    const art = load(key, null);
    if (!art || typeof art !== 'object') return false;
    let changed = false;

    for (const [kind, value] of Object.entries(art)) {
      if (Array.isArray(value)) {
        const next = [];
        for (const url of value) {
          const optimized = await optimizeDataUrl(url, state.maxUploadSize, state.jpegQuality);
          next.push(optimized);
          if (optimized !== url) changed = true;
        }
        art[kind] = next;
      } else if (isDataImage(value)) {
        const optimized = await optimizeDataUrl(value, state.maxUploadSize, state.jpegQuality);
        art[kind] = optimized;
        if (optimized !== value) changed = true;
      }
    }

    if (changed) {
      try { localStorage.setItem(key, JSON.stringify(art)); } catch (_) {}
    }
    return changed;
  }

  function installDrawCache() {
    if (originalDrawImage || !window.CanvasRenderingContext2D) return;
    originalDrawImage = CanvasRenderingContext2D.prototype.drawImage;

    CanvasRenderingContext2D.prototype.drawImage = function (...args) {
      if (!state.enabled) return originalDrawImage.apply(this, args);
      if (args.length !== 5 && args.length !== 9) return originalDrawImage.apply(this, args);

      const img = args[0];
      if (!img || !(img instanceof HTMLImageElement) || !img.complete) {
        return originalDrawImage.apply(this, args);
      }

      const dw = args.length === 5 ? args[3] : args[7];
      const dh = args.length === 5 ? args[4] : args[8];
      if (!Number.isFinite(dw) || !Number.isFinite(dh) || dw <= 0 || dh <= 0 || dw > 256 || dh > 256) {
        return originalDrawImage.apply(this, args);
      }

      const src = img.currentSrc || img.src || '';
      if (!isDataImage(src)) return originalDrawImage.apply(this, args);

      const key = `${src.slice(0, 96)}:${Math.round(dw)}x${Math.round(dh)}`;
      let cached = cache.get(key);
      if (!cached) {
        cached = document.createElement('canvas');
        cached.width = Math.max(1, Math.round(dw));
        cached.height = Math.max(1, Math.round(dh));
        const cctx = cached.getContext('2d');
        cctx.imageSmoothingEnabled = true;
        cctx.imageSmoothingQuality = 'medium';
        originalDrawImage.call(cctx, img, 0, 0, cached.width, cached.height);
        cache.set(key, cached);
        trimCache();
      }

      if (args.length === 5) {
        return originalDrawImage.call(this, cached, args[1], args[2], args[3], args[4]);
      }
      return originalDrawImage.call(this, cached, args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8]);
    };
  }

  function trimCache() {
    while (cache.size > state.maxCacheSize) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
  }

  function addUi() {
    if (document.getElementById('trenchPerfPanel')) return;
    const style = document.createElement('style');
    style.textContent = `
      #trenchPerfPanel{position:fixed;left:10px;top:94px;z-index:2147483645;background:rgba(8,14,18,.9);color:#eef6f6;border:1px solid rgba(138,255,193,.45);border-radius:8px;padding:8px 10px;font:12px system-ui;display:flex;gap:8px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.32)}
      #trenchPerfPanel button{background:#8affc1;color:#082014;border:none;border-radius:6px;padding:6px 8px;font-weight:800;cursor:pointer}
      #trenchPerfPanel label{display:flex;gap:4px;align-items:center}
      #trenchPerfFps{min-width:52px;color:#ffd84d;font-weight:800}
    `;
    document.head.appendChild(style);

    const panel = document.createElement('div');
    panel.id = 'trenchPerfPanel';
    panel.innerHTML = `
      <label><input id="trenchPerfEnabled" type="checkbox"> Perf</label>
      <span id="trenchPerfFps">-- fps</span>
      <button id="trenchPerfOptimize">Optimize Art</button>
    `;
    document.body.appendChild(panel);

    const enabled = document.getElementById('trenchPerfEnabled');
    enabled.checked = !!state.enabled;
    enabled.addEventListener('change', () => {
      state.enabled = enabled.checked;
      save();
    });

    document.getElementById('trenchPerfOptimize').addEventListener('click', async () => {
      const btn = document.getElementById('trenchPerfOptimize');
      btn.textContent = 'Optimizing...';
      btn.disabled = true;
      const keys = ['vvc_art_pack_v83'];
      const profileId = window.TrenchProfileId;
      if (profileId) keys.push(`trench_${String(profileId).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 48)}_vvc_art_pack_v83`);
      let changed = false;
      for (const key of keys) changed = await optimizeStoredArt(key) || changed;
      cache.clear();
      btn.textContent = changed ? 'Reloading...' : 'Optimized';
      setTimeout(() => location.reload(), changed ? 500 : 900);
    });
  }

  function fpsLoop(now) {
    frameCount++;
    if (now - fpsLast >= 1000) {
      fps = Math.round(frameCount * 1000 / (now - fpsLast));
      frameCount = 0;
      fpsLast = now;
      const el = document.getElementById('trenchPerfFps');
      if (el) el.textContent = `${fps} fps`;
    }
    requestAnimationFrame(fpsLoop);
  }

  function boot() {
    installDrawCache();
    addUi();
    requestAnimationFrame(fpsLoop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
