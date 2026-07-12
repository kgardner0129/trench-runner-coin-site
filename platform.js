(function(){
  const cfg = window.VVC_PLATFORM_CONFIG || { games: [], voting: { options: [] }, brand: {} };
  const keys = {
    suggestions: "vvc_platform_suggestions_v1",
    votes: "vvc_platform_votes_v1",
    winners: "vvc_platform_winners_v1",
    admin: "vvc_platform_admin_v1"
  };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const load = (key, fallback) => {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (_) { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  function mondayWeekId(date = new Date()){
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2,"0")}`;
  }

  function getAdmin(){
    return load(keys.admin, { featuredGame: cfg.featuredGame, approved: [], rejected: [] });
  }

  function setAdmin(admin){ save(keys.admin, admin); }

  function getSuggestions(){ return load(keys.suggestions, []); }
  function setSuggestions(items){ save(keys.suggestions, items); }

  function getVotes(){
    const current = mondayWeekId();
    const state = load(keys.votes, { weekId: current, byOption: {}, voted: false });
    if(state.weekId !== current){
      const winner = Object.entries(state.byOption || {}).sort((a,b)=>b[1]-a[1])[0];
      if(winner){
        const winners = load(keys.winners, []);
        winners.unshift({ weekId: state.weekId, optionId: winner[0], votes: winner[1], selectedAt: new Date().toISOString() });
        save(keys.winners, winners.slice(0, 20));
      }
      const next = { weekId: current, byOption: {}, voted: false };
      save(keys.votes, next);
      return next;
    }
    return state;
  }
  function setVotes(votes){ save(keys.votes, votes); }

  function approvedOptions(){
    const admin = getAdmin();
    const suggested = (admin.approved || []).map(s => ({
      id: s.id,
      name: s.coinName,
      xAccount: s.xAccount,
      website: s.website,
      description: s.description
    }));
    return [...(cfg.voting && cfg.voting.options || []), ...suggested];
  }

  function gameById(id){ return (cfg.games || []).find(g => g.id === id) || (cfg.games || [])[0]; }
  function featuredGame(){ return gameById(getAdmin().featuredGame || cfg.featuredGame); }
  function previousGames(){ return (cfg.games || []).filter(g => g.id !== (featuredGame() || {}).id); }

  function tags(tags){
    return `<div class="tag-row">${(tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>`;
  }

  function gameCard(game, extra=""){
    return `
      <article class="game-card">
        <img src="${game.image}" alt="${escapeHtml(game.title)} game art">
        <div class="game-card-body">
          <h3>${escapeHtml(game.title)}</h3>
          <p>${escapeHtml(game.description)}</p>
          ${tags(game.tags)}
          <div class="actions">
            <a class="btn primary" href="${game.playUrl}">Play</a>
            ${game.coinUrl ? `<a class="btn" href="${game.coinUrl}" target="_blank" rel="noopener">Buy Coin</a>` : ""}
            ${game.leaderboard ? `<button class="btn" data-leaderboard="${game.id}">Leaderboard</button>` : ""}
          </div>
          ${extra}
        </div>
      </article>
    `;
  }

  function renderHome(){
    const root = $("#homeApp");
    if(!root) return;
    const game = featuredGame();
    root.innerHTML = `
      <section class="hero">
        <div>
          <div class="eyebrow">This Week's Game</div>
          <h1>${escapeHtml(game.title)}</h1>
          <p class="lead">${escapeHtml(game.description)}</p>
          <div class="actions">
            <a class="btn primary" href="${game.playUrl}">Play Current Game</a>
            ${game.coinUrl ? `<a class="btn" href="${game.coinUrl}" target="_blank" rel="noopener">Buy Coin</a>` : ""}
            <a class="btn" href="./suggest.html">Suggest a Coin</a>
            <a class="btn" href="./vote.html">Vote Next Week</a>
          </div>
        </div>
        <div class="hero-art-wrap"><img class="hero-art" src="${game.image}" alt="${escapeHtml(game.title)} artwork"></div>
      </section>

      <section class="section" id="games">
        <h2>Current Game</h2>
        <div class="games">${gameCard(game)}</div>
      </section>

      <section class="section" id="previous">
        <h2>Previous Games</h2>
        <div class="games">
          ${previousGames().map(g => gameCard(g, `<p style="margin-top:12px">${escapeHtml(g.week || "Previous Game")}</p>`)).join("")}
          <article class="panel">
            <h3>Next Weekly Slot</h3>
            <p>Drop a new game file into the site, add artwork, then select it from the admin dashboard.</p>
            <div class="actions"><a class="btn" href="./previous-games.html">View Archive</a></div>
          </article>
        </div>
      </section>

      <section class="section" id="about">
        <h2>Built For Weekly Community Games</h2>
        <div class="grid">
          <div class="panel"><h3>Simple Releases</h3><p>Each weekly game is a standalone page with its own art, coin link, and optional leaderboard.</p></div>
          <div class="panel"><h3>Community Input</h3><p>Players can suggest coin communities and vote on what should get a game next.</p></div>
          <div class="panel"><h3>Easy Sharing</h3><p>Game sessions can create branded score cards for X and other social platforms.</p></div>
        </div>
      </section>
    `;
  }

  function renderPrevious(){
    const root = $("#previousApp");
    if(!root) return;
    root.innerHTML = `
      <section class="section">
        <h2>Previous Games</h2>
        <p>Archived VaultVerse weekly games stay playable from here.</p>
        <div class="games">${(cfg.games || []).map(g => gameCard(g, `<p style="margin-top:12px">${escapeHtml(g.week || "")}</p>`)).join("")}</div>
      </section>
    `;
  }

  function renderSuggest(){
    const form = $("#suggestForm");
    if(!form) return;
    form.addEventListener("submit", e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const item = {
        id: "coin-" + Date.now(),
        coinName: data.coinName.trim(),
        xAccount: data.xAccount.trim(),
        website: data.website.trim(),
        description: data.description.trim(),
        status: "pending",
        submittedAt: new Date().toISOString()
      };
      if(!item.coinName || !item.description){
        showNotice("suggestNotice", "Coin name and description are required.");
        return;
      }
      const list = getSuggestions();
      list.unshift(item);
      setSuggestions(list);
      form.reset();
      showNotice("suggestNotice", "Suggestion saved for admin review on this device. For public submissions across all users, connect the backend adapter.");
    });
  }

  function renderVote(){
    const root = $("#voteApp");
    if(!root) return;
    const options = approvedOptions();
    const votes = getVotes();
    const total = Object.values(votes.byOption || {}).reduce((a,b)=>a+b,0);
    if(!options.length){
      root.innerHTML = `<section class="section slim"><h2>Vote For Next Week</h2><p>No approved coin suggestions are ready for voting yet.</p><div class="actions"><a class="btn primary" href="./suggest.html">Suggest a Coin</a></div></section>`;
      return;
    }
    root.innerHTML = `
      <section class="section slim">
        <h2>Vote For ${escapeHtml((cfg.voting && cfg.voting.weekLabel) || "Next Week")}</h2>
        <p>Voting resets automatically by week in this lightweight static version.</p>
        <div class="list">
          ${options.map(opt => {
            const count = votes.byOption[opt.id] || 0;
            const pct = total ? Math.round(count / total * 100) : 0;
            return `<div class="row-card">
              <h3>${escapeHtml(opt.name)}</h3>
              <p>${escapeHtml(opt.description || "")}</p>
              <div class="vote-line"><div class="meter"><span style="width:${pct}%"></span></div><strong>${count}</strong></div>
              <div class="actions">
                <button class="btn primary" data-vote="${opt.id}">Vote</button>
                ${opt.xAccount ? `<a class="btn" href="${xUrl(opt.xAccount)}" target="_blank" rel="noopener">X</a>` : ""}
                ${opt.website ? `<a class="btn" href="${safeUrl(opt.website)}" target="_blank" rel="noopener">Link</a>` : ""}
              </div>
            </div>`;
          }).join("")}
        </div>
      </section>
    `;
    $$("[data-vote]").forEach(btn => btn.addEventListener("click", () => {
      const state = getVotes();
      state.byOption[btn.dataset.vote] = (state.byOption[btn.dataset.vote] || 0) + 1;
      state.voted = true;
      setVotes(state);
      renderVote();
    }));
  }

  function renderAdmin(){
    const root = $("#adminApp");
    if(!root) return;
    const suggestions = getSuggestions();
    const admin = getAdmin();
    const pending = suggestions.filter(s => s.status === "pending");
    root.innerHTML = `
      <section class="section">
        <h2>Admin Dashboard</h2>
        <p>This is a lightweight static admin workflow. Approvals and featured-game changes are stored locally here, then exported for the live site config.</p>
        <div class="grid">
          <div class="panel">
            <h3>Featured Game</h3>
            <div class="field">
              <label for="featuredSelect">Current weekly game</label>
              <select id="featuredSelect">${(cfg.games || []).map(g => `<option value="${g.id}" ${g.id === (admin.featuredGame || cfg.featuredGame) ? "selected" : ""}>${escapeHtml(g.title)}</option>`).join("")}</select>
            </div>
            <div class="actions"><button class="btn primary" id="saveFeatured">Save Featured</button></div>
          </div>
          <div class="panel">
            <h3>Export Config</h3>
            <p>Use this when you want local admin choices baked into the live site.</p>
            <div class="actions"><button class="btn" id="exportAdmin">Generate Export</button></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>Pending Suggestions</h2>
        <div class="list">
          ${pending.length ? pending.map(s => suggestionRow(s)).join("") : `<p>No pending suggestions on this device.</p>`}
        </div>
      </section>
      <section class="section">
        <h2>Approved For Voting</h2>
        <div class="list">${(admin.approved || []).map(s => suggestionRow(s, true)).join("") || `<p>No locally approved suggestions yet.</p>`}</div>
      </section>
      <section class="section">
        <h2>Export</h2>
        <textarea id="adminExport" style="width:100%;min-height:180px;background:#061014;color:#e8fffb;border:1px solid var(--line);border-radius:8px;padding:12px"></textarea>
      </section>
    `;
    $("#saveFeatured")?.addEventListener("click", () => {
      const next = getAdmin();
      next.featuredGame = $("#featuredSelect").value;
      setAdmin(next);
      alert("Featured game saved locally. Export config when ready to publish it for everyone.");
    });
    $("#exportAdmin")?.addEventListener("click", () => {
      $("#adminExport").value = JSON.stringify({ admin: getAdmin(), suggestions: getSuggestions(), votes: getVotes() }, null, 2);
    });
    $$("[data-approve]").forEach(btn => btn.addEventListener("click", () => {
      const list = getSuggestions();
      const item = list.find(s => s.id === btn.dataset.approve);
      if(item){
        item.status = "approved";
        const next = getAdmin();
        next.approved = [item, ...(next.approved || []).filter(s => s.id !== item.id)];
        setAdmin(next);
        setSuggestions(list);
        renderAdmin();
      }
    }));
    $$("[data-reject]").forEach(btn => btn.addEventListener("click", () => {
      const list = getSuggestions();
      const item = list.find(s => s.id === btn.dataset.reject);
      if(item) item.status = "rejected";
      setSuggestions(list);
      renderAdmin();
    }));
  }

  function suggestionRow(s, approved=false){
    return `<div class="row-card">
      <h3>${escapeHtml(s.coinName)}</h3>
      <p>${escapeHtml(s.description)}</p>
      <p>${escapeHtml(s.xAccount || "")} ${escapeHtml(s.website || "")}</p>
      ${approved ? "" : `<div class="actions"><button class="btn primary" data-approve="${s.id}">Approve</button><button class="btn danger" data-reject="${s.id}">Reject</button></div>`}
    </div>`;
  }

  function renderLeaderboards(){
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-leaderboard]");
      if(!btn) return;
      const id = btn.dataset.leaderboard;
      const rows = load(`vvc_leaderboard_${id}`, []).slice(0, 10);
      const text = rows.length ? rows.map((r,i)=>`${i+1}. ${r.name || "Player"} - ${r.score}`).join("\\n") : "No local scores yet.";
      alert(text);
    });
  }

  function showNotice(id, message){
    const el = document.getElementById(id);
    if(el){ el.textContent = message; el.hidden = false; }
  }

  function escapeHtml(value){
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  }
  function safeUrl(url){ return /^https?:\/\//i.test(url) ? url : `https://${url}`; }
  function xUrl(value){
    const handle = String(value || "").replace(/^@/, "");
    if(/^https?:\/\//i.test(handle)) return handle;
    return `https://x.com/${encodeURIComponent(handle)}`;
  }

  renderHome();
  renderPrevious();
  renderSuggest();
  renderVote();
  renderAdmin();
  renderLeaderboards();
})();
