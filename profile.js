(function () {
  const chunks = window.TrenchProfileChunks || [];
  if (!chunks.length) throw new Error('Trench profile chunks are missing. Upload every profile_part_###.js file.');
  const raw = chunks.join('');
  const profile = JSON.parse(raw);
  window.TrenchProfileId = profile.profileId || 'trench';
  window.TrenchEmbeddedProfile = profile;
  window.TrenchBuildMode = 'player';
  window.TRENCH_PLAYER_BUILD = true;
})();