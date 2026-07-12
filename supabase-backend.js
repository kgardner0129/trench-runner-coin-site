(function(){
  const config = window.VVC_SUPABASE_CONFIG || {};
  const hasClient = !!(window.supabase && config.url && config.anonKey);
  const client = hasClient ? window.supabase.createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  const voterKeyName = "vvc_public_voter_id_v1";

  function enabled(){ return !!client; }
  function playerKey(){
    let value = localStorage.getItem(voterKeyName);
    if(!value){
      value = (crypto && crypto.randomUUID) ? crypto.randomUUID() : `voter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(voterKeyName, value);
    }
    return value;
  }
  function clean(value, fallback = ""){
    return String(value == null ? fallback : value).trim();
  }
  function fromSuggestion(row){
    return {
      id: row.id,
      coinName: row.coin_name,
      xAccount: row.x_account || "",
      website: row.website || "",
      description: row.description || "",
      status: row.status || "pending",
      submittedAt: row.created_at
    };
  }

  async function requireClient(){
    if(!client) throw new Error("Supabase is not configured yet.");
    return client;
  }

  async function submitSuggestion(item){
    const db = await requireClient();
    const payload = {
      coin_name: clean(item.coinName),
      x_account: clean(item.xAccount),
      website: clean(item.website),
      description: clean(item.description),
      status: "pending"
    };
    const { error } = await db.from("vvc_coin_suggestions").insert(payload);
    if(error) throw error;
  }

  async function approvedSuggestions(){
    const db = await requireClient();
    const { data, error } = await db
      .from("vvc_coin_suggestions")
      .select("id, coin_name, x_account, website, description, status, created_at, approved_at")
      .eq("status", "approved")
      .order("approved_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
    if(error) throw error;
    return (data || []).map(fromSuggestion);
  }

  async function pendingSuggestions(){
    const db = await requireClient();
    const { data, error } = await db
      .from("vvc_coin_suggestions")
      .select("id, coin_name, x_account, website, description, status, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if(error) throw error;
    return (data || []).map(fromSuggestion);
  }

  async function approveSuggestion(id){
    const db = await requireClient();
    const { error } = await db
      .from("vvc_coin_suggestions")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", id);
    if(error) throw error;
  }

  async function rejectSuggestion(id){
    const db = await requireClient();
    const { error } = await db
      .from("vvc_coin_suggestions")
      .update({ status: "rejected" })
      .eq("id", id);
    if(error) throw error;
  }

  async function castVote(weekId, optionId){
    const db = await requireClient();
    const { error } = await db.from("vvc_votes").insert({
      week_id: weekId,
      option_id: optionId,
      voter_key: playerKey()
    });
    if(error) throw error;
  }

  async function voteTotals(weekId){
    const db = await requireClient();
    const { data, error } = await db
      .from("vvc_vote_totals")
      .select("week_id, option_id, votes")
      .eq("week_id", weekId);
    if(error) throw error;
    const totals = {};
    (data || []).forEach(row => { totals[row.option_id] = Number(row.votes) || 0; });
    return totals;
  }

  async function submitScore(row){
    const db = await requireClient();
    const score = Number(row.score) || 0;
    if(score <= 0) return;
    const payload = {
      game_id: clean(row.gameId, "vaultverse-game"),
      game_title: clean(row.gameTitle, "VaultVerse Game"),
      player_name: clean(row.name, "Player").slice(0, 32),
      score,
      coins: Number(row.coins) || 0
    };
    const { error } = await db.from("vvc_scores").insert(payload);
    if(error) throw error;
  }

  async function leaderboard(gameId, limit = 10){
    const db = await requireClient();
    const { data, error } = await db
      .from("vvc_scores")
      .select("game_id, game_title, player_name, score, coins, created_at")
      .eq("game_id", gameId)
      .order("score", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(limit);
    if(error) throw error;
    return (data || []).map(row => ({
      name: row.player_name || "Player",
      score: Number(row.score) || 0,
      coins: Number(row.coins) || 0,
      at: Date.parse(row.created_at) || Date.now(),
      gameTitle: row.game_title
    }));
  }

  async function getSetting(key){
    const db = await requireClient();
    const { data, error } = await db
      .from("vvc_settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if(error) throw error;
    return data ? data.value : null;
  }

  async function saveSetting(key, value){
    const db = await requireClient();
    const { error } = await db.from("vvc_settings").upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    });
    if(error) throw error;
  }

  async function signIn(email){
    const db = await requireClient();
    const { error } = await db.auth.signInWithOtp({
      email: clean(email),
      options: { emailRedirectTo: location.href.split("#")[0] }
    });
    if(error) throw error;
  }

  async function signOut(){
    const db = await requireClient();
    await db.auth.signOut();
  }

  async function currentUser(){
    if(!client) return null;
    const { data } = await client.auth.getUser();
    return data && data.user ? data.user : null;
  }

  async function isAdmin(){
    if(!client) return false;
    const { data, error } = await client.rpc("vvc_is_admin");
    if(error) return false;
    return !!data;
  }

  window.VVCBackend = {
    enabled,
    client,
    submitSuggestion,
    approvedSuggestions,
    pendingSuggestions,
    approveSuggestion,
    rejectSuggestion,
    castVote,
    voteTotals,
    submitScore,
    leaderboard,
    getSetting,
    saveSetting,
    signIn,
    signOut,
    currentUser,
    isAdmin
  };
})();
