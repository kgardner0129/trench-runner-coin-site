# Trench Runner Coin Website

This is the public website folder for the first Trench Runner coin launch.

Upload this folder to GitHub. The public game entry is `play.html`.

Do not upload the admin/dev controller to the public website.

## Files

- `index.html` - coin website homepage
- `play.html` - protected player game
- `coin_config.js` - small launch config for the Pump.fun mint and holder minimum
- `profile_part_001.js` through `profile_part_007.js` - saved game images, videos, and settings split for GitHub upload
- `profile.js` - loader that rebuilds the saved game profile
- `profile.json` - small manifest only
- `trench_live_client.js` - frontend bridge for the settlement API
- `trench_wallet_gate.js` - Phantom holder verification gate
- `assets/` - optional place for coin images, logos, and social preview images

## Before Pump.fun Launch

1. Replace the placeholder links in `index.html`.
2. Add your social links.
3. After Pump.fun creates the coin, paste the mint address into `coin_config.js` at `mint`.
4. Deploy with GitHub Pages.
5. Use the custom domain URL as the Pump.fun website URL.

## Holder Gate

`trench_wallet_gate.js` checks Phantom wallets against the mint in `coin_config.js`.

If `mint` is blank, the game stays open for demo/testing.

After `mint` is set, players must connect Phantom and hold at least `minHoldTokens` tokens to unlock play.

## Settlement API

The game can be connected to the backend later by editing `coin_config.js`.

Set:

```js
settlementApiBase: "https://your-backend-url"
```

Leave it blank until the backend is deployed and tested. Holder verification still works without it.
