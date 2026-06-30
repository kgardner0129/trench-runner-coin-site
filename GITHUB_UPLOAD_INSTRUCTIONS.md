# GitHub Upload Instructions

Upload the contents of this folder to a new GitHub repository.

Folder to upload:

```text
C:\Users\Kendall Gardner\Documents\Codex\2026-06-25\find\outputs\trench_runner_recovered\public_coin_site
```

Required public files:

```text
.nojekyll
index.html
play.html
coin_config.js
profile_part_001.js
profile_part_002.js
profile_part_003.js
profile_part_004.js
profile_part_005.js
profile_part_006.js
profile_part_007.js
profile.js
profile.json
trench_live_client.js
trench_dex_fund.js
trench_wallet_gate.js
trench_performance.js
trench_tokenomics.js
GITHUB_UPLOAD_INSTRUCTIONS.md
README.md
assets/
```

Do not upload:

```text
admin.html
admin_game.html
tokenized_game.html
first_coin_profile.json
launch/settlement-api/.env
```

## GitHub Pages

1. Create a new GitHub repo.
2. Upload every file from this folder.
3. Go to repo Settings.
4. Open Pages.
5. Set Source to `Deploy from a branch`.
6. Select branch `main` and folder `/root`.
7. Save.
8. Wait for GitHub to publish the site URL.

Use the custom domain URL as the Pump.fun website URL.

## After Pump.fun Gives You The Mint

Edit `coin_config.js`.

Find:

```js
mint: "",
```

Replace the blank value with the Pump.fun/Solana mint address, then upload the updated `coin_config.js` to GitHub.

The player game checks this value when players connect Phantom.

Also paste the direct Pump.fun page URL into:

```js
purchaseUrl: ""
```

## After Settlement API Is Deployed

Edit `coin_config.js` again.

Find:

```js
settlementApiBase: ""
```

Replace the blank value with the HTTPS URL for the settlement API, then upload the updated `coin_config.js` to GitHub.

To enable real SOL DEX-fund contributions, also set:

```js
dexFundWallet: ""
dexContributionUsd: 1
dexGoalUsd: 299
```
