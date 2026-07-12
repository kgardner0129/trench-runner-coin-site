# VaultVerse Supabase Setup

This turns VaultVerseCoins from browser-local storage into shared community data for:

- public coin suggestions
- admin approval
- weekly voting
- shared game leaderboards
- featured game selection

## 1. Create the Supabase project

1. Go to https://supabase.com/dashboard
2. Create a new project.
3. Wait for the project to finish provisioning.

## 2. Run the database setup

1. Open your Supabase project.
2. Go to SQL Editor.
3. Open `SUPABASE_SETUP.sql` from this repo.
4. Replace `YOUR_EMAIL_HERE@example.com` with the email you want to use for the admin dashboard.
5. Run the SQL.

## 3. Allow the admin login redirect

1. In Supabase, go to Authentication > URL Configuration.
2. Set Site URL to:

   `https://vaultversecoins.com`

3. Add this Redirect URL:

   `https://vaultversecoins.com/admin.html`

## 4. Paste your public keys into the site

1. In Supabase, go to Project Settings > API.
2. Copy your Project URL.
3. Copy your anon public key.
4. Edit `supabase-config.js`:

```js
window.VVC_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_ID.supabase.co",
  anonKey: "YOUR_ANON_PUBLIC_KEY"
};
```

Use the anon public key only. Do not paste the service role key into GitHub or any website file.

## 5. Publish to GitHub

Upload or push these new/changed files:

- `supabase-config.js`
- `supabase-backend.js`
- `SUPABASE_SETUP.sql`
- `SUPABASE_SETUP.md`
- `platform.js`
- `scorecard.js`
- `index.html`
- `suggest.html`
- `vote.html`
- `previous-games.html`
- `admin.html`
- `play.html`
- `rizz-bull.html`

## 6. Test

1. Visit `https://vaultversecoins.com/suggest.html` and submit a test suggestion.
2. Visit `https://vaultversecoins.com/admin.html`.
3. Enter your admin email and click `Send Login Link`.
4. Open the email link.
5. Approve the suggestion.
6. Visit `https://vaultversecoins.com/vote.html` and vote for it.
7. Play a game and finish a run. The score should submit to the shared leaderboard.

## Weekly workflow

1. Build or upload the new game page.
2. Add the game entry to `platform-data.js`.
3. Open `admin.html`.
4. Choose the featured game.
5. Save Featured.

Suggestions and votes live in Supabase, so you do not need to edit GitHub every time someone submits or votes.
