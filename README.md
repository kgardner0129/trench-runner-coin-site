# VaultVerse Coins Arcade

This is the public website folder for VaultVerseCoins.com.

The site is now a free game hub. Trench Runner is the first playable game, and future games can be added to `index.html` as new game cards.

## Public Files

- `index.html` - VaultVerse arcade hub homepage
- `play.html` - free Trench Runner player game
- `coin_config.js` - free-play config used by the game wrapper
- `profile_part_001.js` through `profile_part_007.js` - saved Trench Runner images, videos, and settings
- `profile.js` - loader that rebuilds the saved game profile
- `profile.json` - small profile manifest
- `trench_performance.js` - optional performance helper for the game
- `trench-runner-hero.png` - homepage and social image
- `trench-runner-square.png` - icon/social image
- `trench-runner-launch.mp4` - trailer video

## Free Play Direction

Wallet connect, holder checks, DEX funding, and token settlement are no longer part of the public game.

Do not upload or link these old token/wallet add-ons unless you intentionally bring that direction back later:

- `trench_wallet_gate.js`
- `trench_dex_fund.js`
- `trench_live_client.js`
- `trench_tokenomics.js`

## Adding Future Games

1. Add the new game file to this folder, such as `new-game.html`.
2. Add the new artwork file to this folder.
3. Copy one of the game cards in `index.html`.
4. Change the title, description, tags, image, and play link.
5. Upload the changed files to GitHub.

Do not upload admin/dev controller files to the public website.
