(function(){
  const cfg = window.VVC_PLATFORM_CONFIG || { games: [], voting: { options: [] }, brand: {} };
  const backend = window.VVCBackend;
  const keys = {
    suggestions: "vvc_platform_suggestions_v1",
    votes: "vvc_platform_votes_v1",
    winners: "vvc_platform_winners_v1",
    admin: "vvc_platform_admin_v1"
  };

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const remoteOn = () => !!(backend && backend.enabled && backend.enabled());
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

  async function approvedOptions(){
    const localAdmin = getAdmin();
    let remote = [];
    if(remoteOn()){
      try { remote = await backend.approvedSuggestions(); }
      catch (error) { console.warn("Supabase approved suggestions failed", error); }
    }
    const local = (localAdmin.approved || []);
    const suggested = [...remote, ...local].map(s => ({
      id: s.id,
      name: s.coinName,
      xAccount: s.xAccount,
      website: s.website,
      description: s.description
    }));
    const all = [...(cfg.voting && cfg.voting.options || []), ...suggested];
    const seen = new Set();
    return all.filter(opt => {
      if(!opt || !opt.id || seen.has(opt.id)) return false;
      seen.add(opt.id);
      return true;
    });
  }

  function gameById(id){ return (cfg.games || []).find(g => g.id === id) || (cfg.games || [])[0]; }
  async function featuredGame(){
    let id = getAdmin().featuredGame || cfg.featuredGame;
    if(remoteOn()){
      try {
        const setting = await backend.getSetting("featured_game");
        if(setting && setting.gameId) id = setting.gameId;
      } catch (error) {
        console.warn("Supabase featured game failed", error);
      }
    }
    return gameById(id);
  }
  async function previousGames(){
    const featured = await featuredGame();
    return (cfg.games || []).filter(g => g.id !== (featured || {}).id);
  }

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

  async function renderHome(){
    const root = $("#homeApp");
    if(!root) return;
    const game = await featuredGame();
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
          ${(await previousGames()).map(g => gameCard(g, `<p style="margin-top:12px">${escapeHtml(g.week || "Previous Game")}</p>`)).join("")}
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
    form.addEventListener("submit", async e => {
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
      try {
        if(remoteOn()){
          await backend.submitSuggestion(item);
          showNotice("suggestNotice", "Suggestion sent for admin review. Once approved, it can appear in public voting.");
        } else {
          const list = getSuggestions();
          list.unshift(item);
          setSuggestions(list);
          showNotice("suggestNotice", "Suggestion saved locally. Add Supabase keys to make submissions public across all visitors.");
        }
        form.reset();
      } catch (error) {
        showNotice("suggestNotice", `Could not submit suggestion: ${error.message || error}`);
      }
    });
  }

  async function renderVote(){
    const root = $("#voteApp");
    if(!root) return;
    const options = await approvedOptions();
    const weekId = mondayWeekId();
    let byOption = {};
    if(remoteOn()){
      try { byOption = await backend.voteTotals(weekId); }
      catch (error) { console.warn("Supabase vote totals failed", error); }
    } else {
      byOption = getVotes().byOption || {};
    }
    const total = Object.values(byOption || {}).reduce((a,b)=>a+b,0);
    if(!options.length){
      root.innerHTML = `<section class="section slim"><h2>Vote For Next Week</h2><p>No approved coin suggestions are ready for voting yet.</p><div class="actions"><a class="btn primary" href="./suggest.html">Suggest a Coin</a></div></section>`;
      return;
    }
    root.innerHTML = `
      <section class="section slim">
        <h2>Vote For ${escapeHtml((cfg.voting && cfg.voting.weekLabel) || "Next Week")}</h2>
        <p>${remoteOn() ? "Live voting is connected. One vote is counted per browser each week." : "Voting is local until Supabase is configured."}</p>
        <div id="voteNotice" class="notice" hidden></div>
        <div class="list">
          ${options.map(opt => {
            const count = byOption[opt.id] || 0;
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
    $$("[data-vote]").forEach(btn => btn.addEventListener("click", async () => {
      try {
        if(remoteOn()){
          await backend.castVote(weekId, btn.dataset.vote);
        } else {
          const state = getVotes();
          state.byOption[btn.dataset.vote] = (state.byOption[btn.dataset.vote] || 0) + 1;
          state.voted = true;
          setVotes(state);
        }
        await renderVote();
      } catch (error) {
        const duplicate = String(error.message || "").toLowerCase().includes("duplicate");
        showNotice("voteNotice", duplicate ? "Your vote for this week is already counted from this browser." : `Vote failed: ${error.message || error}`);
      }
    }));
  }

  async function renderAdmin(){
    const root = $("#adminApp");
    if(!root) return;
    let user = null;
    let adminOk = false;
    if(remoteOn()){
      user = await backend.currentUser();
      adminOk = user ? await backend.isAdmin() : false;
    }
    const suggestions = remoteOn() && adminOk ? await safePendingSuggestions() : getSuggestions();
    const admin = getAdmin();
    const pending = suggestions.filter(s => s.status === "pending");
    root.innerHTML = `
      <section class="section">
        <h2>Admin Dashboard</h2>
        <p>${remoteOn() ? "Supabase is connected. Sign in with your approved admin email to approve suggestions and set the featured game." : "Supabase is not configured yet. This dashboard is using local-only fallback data."}</p>
        ${remoteOn() ? adminLoginBlock(user, adminOk) : ""}
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
            <p>Local export stays available as a backup, even with Supabase connected.</p>
            <div class="actions"><button class="btn" id="exportAdmin">Generate Export</button></div>
          </div>
        </div>
      </section>
      <section class="section">
        <h2>Pending Suggestions</h2>
        <div class="list">
          ${pending.length ? pending.map(s => suggestionRow(s)).join("") : `<p>No pending suggestions${remoteOn() && !adminOk ? " visible until admin sign-in is active" : ""}.</p>`}
        </div>
      </section>
      <section class="section">
        <h2>Approved For Voting</h2>
        <div class="list" id="approvedList">${await approvedRows()}</div>
      </section>
      <section class="section">
        <h2>Export</h2>
        <textarea id="adminExport" style="width:100%;min-height:180px;background:#061014;color:#e8fffb;border:1px solid var(--line);border-radius:8px;padding:12px"></textarea>
      </section>
    `;
    $("#adminSignIn")?.addEventListener("click", async () => {
      const email = $("#adminEmail")?.value || "";
      try {
        await backend.signIn(email);
        alert("Check your email for the Supabase login link, then come back to this admin page.");
      } catch (error) {
        alert(`Sign-in failed: ${error.message || error}`);
      }
    });
    $("#adminSignOut")?.addEventListener("click", async () => {
      await backend.signOut();
      location.reload();
    });
    $("#saveFeatured")?.addEventListener("click", async () => {
      const next = getAdmin();
      next.featuredGame = $("#featuredSelect").value;
      setAdmin(next);
      if(remoteOn()){
        try { await backend.saveSetting("featured_game", { gameId: next.featuredGame }); }
        catch (error) { alert(`Could not save to Supabase: ${error.message || error}`); return; }
      }
      alert(remoteOn() ? "Featured game saved live." : "Featured game saved locally. Export config when ready to publish it for everyone.");
    });
    $("#exportAdmin")?.addEventListener("click", () => {
      $("#adminExport").value = JSON.stringify({ admin: getAdmin(), suggestions: getSuggestions(), votes: getVotes() }, null, 2);
    });
    $$("[data-approve]").forEach(btn => btn.addEventListener("click", async () => {
      if(remoteOn()){
        try { await backend.approveSuggestion(btn.dataset.approve); }
        catch (error) { alert(`Approve failed: ${error.message || error}`); return; }
      } else {
        const list = getSuggestions();
        const item = list.find(s => s.id === btn.dataset.approve);
        if(item){
          item.status = "approved";
          const next = getAdmin();
          next.approved = [item, ...(next.approved || []).filter(s => s.id !== item.id)];
          setAdmin(next);
          setSuggestions(list);
        }
      }
      await renderAdmin();
    }));
    $$("[data-reject]").forEach(btn => btn.addEventListener("click", async () => {
      if(remoteOn()){
        try { await backend.rejectSuggestion(btn.dataset.reject); }
        catch (error) { alert(`Reject failed: ${error.message || error}`); return; }
      } else {
        const list = getSuggestions();
        const item = list.find(s => s.id === btn.dataset.reject);
        if(item) item.status = "rejected";
        setSuggestions(list);
      }
      await renderAdmin();
    }));
  }

  function adminLoginBlock(user, adminOk){
    if(user){
      return `<div class="panel"><h3>Admin Sign In</h3><p>Signed in as ${escapeHtml(user.email || "admin")} ${adminOk ? "(approved admin)" : "(not in vvc_admins yet)"}</p><div class="actions"><button class="btn" id="adminSignOut">Sign Out</button></div></div>`;
    }
    return `<div class="panel"><h3>Admin Sign In</h3><p>Enter the email you added to <code>vvc_admins</code>. Supabase will send a magic login link.</p><div class="field"><label for="adminEmail">Admin email</label><input id="adminEmail" type="email" placeholder="you@example.com"></div><div class="actions"><button class="btn primary" id="adminSignIn">Send Login Link</button></div></div>`;
  }

  async function safePendingSuggestions(){
    try { return await backend.pendingSuggestions(); }
    catch (error) { console.warn("Supabase pending suggestions failed", error); return []; }
  }

  async function approvedRows(){
    const rows = await approvedOptions();
    return rows.length ? rows.map(s => `<div class="row-card"><h3>${escapeHtml(s.name)}</h3><p>${escapeHtml(s.description)}</p><p>${escapeHtml(s.xAccount || "")} ${escapeHtml(s.website || "")}</p></div>`).join("") : `<p>No approved suggestions yet.</p>`;
  }

  function suggestionRow(s){
    return `<div class="row-card">
      <h3>${escapeHtml(s.coinName)}</h3>
      <p>${escapeHtml(s.description)}</p>
      <p>${escapeHtml(s.xAccount || "")} ${escapeHtml(s.website || "")}</p>
      <div class="actions"><button class="btn primary" data-approve="${s.id}">Approve</button><button class="btn danger" data-reject="${s.id}">Reject</button></div>
    </div>`;
  }

  function renderLeaderboards(){
    document.addEventListener("click", async e => {
      const btn = e.target.closest("[data-leaderboard]");
      if(!btn) return;
      const id = btn.dataset.leaderboard;
      let rows = [];
      if(remoteOn()){
        try { rows = await backend.leaderboard(id, 10); }
        catch (error) { console.warn("Supabase leaderboard failed", error); }
      }
      if(!rows.length) rows = load(`vvc_leaderboard_${id}`, []).slice(0, 10);
      const text = rows.length ? rows.map((r,i)=>`${i+1}. ${r.name || "Player"} - ${r.score}${r.coins ? ` (${r.coins} coins)` : ""}`).join("\n") : "No scores yet.";
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

  async function init(){
    await renderHome();
    renderPrevious();
    renderSuggest();
    await renderVote();
    await renderAdmin();
    renderLeaderboards();
  }

  init();
})();
