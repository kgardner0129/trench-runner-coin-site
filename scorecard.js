(function(){
  const gameId = document.body?.dataset?.gameId || location.pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "vaultverse-game";
  const gameTitle = document.body?.dataset?.gameTitle || document.title.replace(/\s*[-|].*$/, "") || "VaultVerse Game";
  const leaderboardKey = `vvc_leaderboard_${gameId}`;

  function text(id){ return document.getElementById(id)?.textContent?.trim() || ""; }
  function scoreValue(){
    const raw = text("score") || text("scoreVal") || "0";
    const match = raw.match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  }
  function coinsValue(){
    const raw = text("coinCount") || text("coins") || "0";
    const match = raw.match(/-?\d+/);
    return match ? Number(match[0]) : 0;
  }
  function load(key, fallback){ try{ const raw=localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }catch(_){ return fallback; } }
  function save(key, value){ localStorage.setItem(key, JSON.stringify(value)); }

  function recordScore(){
    const score = scoreValue();
    if(!score) return;
    const rows = load(leaderboardKey, []);
    const last = rows[0];
    if(last && Date.now() - last.at < 4000 && last.score === score) return;
    const entry = { name: "Player", score, coins: coinsValue(), at: Date.now(), gameTitle, gameId };
    rows.push(entry);
    rows.sort((a,b)=>b.score-a.score);
    save(leaderboardKey, rows.slice(0, 25));
    if(window.VVCBackend && window.VVCBackend.enabled && window.VVCBackend.enabled()){
      window.VVCBackend.submitScore(entry).catch(error => console.warn("Supabase score submit failed", error));
    }
  }

  function ensureButton(){
    const card = document.getElementById("goCard") || document.getElementById("gameover") || document.body;
    if(!card || document.getElementById("vvcShareScoreBtn")) return;
    const btn = document.createElement("button");
    btn.id = "vvcShareScoreBtn";
    btn.type = "button";
    btn.textContent = "Share Score";
    btn.style.cssText = "margin:10px auto 0;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(138,255,193,.45);border-radius:10px;background:#38d982;color:#04140b;padding:10px 14px;font-weight:900;cursor:pointer";
    btn.addEventListener("click", createShareCard);
    card.appendChild(btn);
  }

  function createShareCard(){
    recordScore();
    const score = scoreValue();
    const coins = coinsValue();
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0,0,1200,630);
    grad.addColorStop(0, "#071216");
    grad.addColorStop(.55, "#10252a");
    grad.addColorStop(1, "#050809");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,1200,630);
    ctx.fillStyle = "rgba(72,214,210,.18)";
    ctx.beginPath(); ctx.arc(1020, 120, 230, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,212,71,.14)";
    ctx.beginPath(); ctx.arc(140, 520, 260, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#ffd447";
    ctx.font = "900 42px system-ui, sans-serif";
    ctx.fillText("VAULTVERSECOINS.COM", 72, 86);
    ctx.fillStyle = "#f3f8f7";
    ctx.font = "950 74px system-ui, sans-serif";
    wrap(ctx, gameTitle, 72, 190, 760, 82);
    ctx.fillStyle = "#38d982";
    ctx.font = "950 118px system-ui, sans-serif";
    ctx.fillText(String(score), 72, 430);
    ctx.fillStyle = "#a8bbb8";
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.fillText(`Score${coins ? `  |  Coins ${coins}` : ""}`, 78, 478);
    ctx.fillStyle = "#48d6d2";
    ctx.font = "850 32px system-ui, sans-serif";
    ctx.fillText("Play weekly community arcade games.", 72, 560);
    ctx.strokeStyle = "rgba(255,255,255,.16)";
    ctx.lineWidth = 2;
    ctx.strokeRect(34,34,1132,562);

    const url = canvas.toDataURL("image/png");
    showShareModal(url, score);
  }

  function wrap(ctx, value, x, y, maxWidth, lineHeight){
    const words = String(value).split(/\s+/);
    let line = "";
    for(const word of words){
      const test = line ? `${line} ${word}` : word;
      if(ctx.measureText(test).width > maxWidth && line){
        ctx.fillText(line, x, y);
        line = word;
        y += lineHeight;
      } else {
        line = test;
      }
    }
    if(line) ctx.fillText(line, x, y);
  }

  function showShareModal(imageUrl, score){
    let modal = document.getElementById("vvcScoreModal");
    if(!modal){
      modal = document.createElement("div");
      modal.id = "vvcScoreModal";
      modal.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px";
      modal.innerHTML = `<div style="width:min(720px,96vw);background:#0e1b21;border:1px solid rgba(255,255,255,.18);border-radius:12px;padding:16px;color:#f3f8f7"><h2 style="margin:0 0 10px">Share Score</h2><img id="vvcScoreImg" alt="Shareable score card" style="width:100%;border-radius:8px;border:1px solid rgba(255,255,255,.14)"><div class="actions" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><a id="vvcDownloadScore" style="padding:10px 14px;border-radius:8px;background:#38d982;color:#04140b;font-weight:900;text-decoration:none" download="vaultverse-score.png">Save Image</a><a id="vvcXShare" target="_blank" rel="noopener" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;font-weight:900;text-decoration:none">Post on X</a><button id="vvcCloseScore" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,.08);color:#fff;font-weight:900;border:1px solid rgba(255,255,255,.16)">Close</button></div></div>`;
      document.body.appendChild(modal);
      modal.querySelector("#vvcCloseScore").addEventListener("click", () => modal.style.display = "none");
    }
    modal.style.display = "flex";
    modal.querySelector("#vvcScoreImg").src = imageUrl;
    modal.querySelector("#vvcDownloadScore").href = imageUrl;
    const shareText = `I scored ${score} in ${gameTitle} on VaultVerseCoins.com`;
    modal.querySelector("#vvcXShare").href = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(location.href)}`;
  }

  function watchGameOver(){
    const go = document.getElementById("gameover");
    if(!go) return;
    const observer = new MutationObserver(() => {
      const visible = getComputedStyle(go).display !== "none";
      if(visible){ recordScore(); ensureButton(); }
    });
    observer.observe(go, { attributes:true, attributeFilter:["style","class"] });
    if(getComputedStyle(go).display !== "none"){ recordScore(); ensureButton(); }
  }

  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchGameOver);
  else watchGameOver();
})();
