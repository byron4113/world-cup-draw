# World Cup 2026 — Family Draw 🏆

A tiny website showing Mom, Byron, and Melissa's teams, who's still in, who's
ahead, and upcoming matches. Updates itself twice a day. Free to host.

Just want to share it? → see **Setup** below. Then send everyone the link.

## How it works

- `index.html` / `style.css` — the page.
- `app.js` — the draw (who owns which team, flags) + all display logic. Rarely touched.
- `data.json` — the live results. **Written automatically — don't edit by hand.**
- `update.mjs` — fetches results from [football-data.org](https://www.football-data.org)
  and rewrites `data.json`.
- `.github/workflows/update.yml` — runs `update.mjs` twice a day on GitHub's servers.

"Who's still in" is taken from the **real** results: group positions come from
football-data's official standings, and knockouts from the actual bracket
(a team that loses is out; once the Round of 32 is set, anyone not in it is out).
No guesswork.

## Setup (one time, ~5 minutes)

### 1. Get a free data key

1. Go to <https://www.football-data.org/client/register> and register (email only, no card).
2. They email you an **API token** (a long string). Copy it.

### 2. Put the code on GitHub

1. Create a new **public** repo, e.g. `world-cup-draw`.
2. Upload all these files (drag-and-drop in the browser works, *including* the
   `.github` folder — or use `git push`).

### 3. Add your key as a secret

1. Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `FOOTBALL_DATA_TOKEN`  ·  Value: paste your token. Save.

### 4. Turn on the auto-updater

1. Repo → **Actions** tab → enable workflows if prompted.
2. Click **Update World Cup data** → **Run workflow** (this fills in `data.json`
   for the first time). It takes a few seconds and commits the results.

### 5. Publish the site

1. Repo → **Settings** → **Pages** → Source: **Deploy from a branch**, branch
   `main`, folder `/ (root)`. Save.
2. Wait ~1 minute. Your link is `https://<your-username>.github.io/world-cup-draw/`.

That's it. The site refreshes itself at 07:00 and 19:00 UTC every day. You can
also hit **Run workflow** any time to update on demand.

## Running it locally (optional)

```bash
FOOTBALL_DATA_TOKEN=your_token_here node update.mjs
```

This rewrites `data.json` with the latest data. If a team name doesn't map, the
script prints a warning telling you exactly what to add to the `ALIASES` list in
`update.mjs`.

## Tweaks

- **Change update times:** edit the `cron` line in `.github/workflows/update.yml`.
- **Fix a team name / flag:** edit the `TEAMS` list in `app.js`.
- **Colours / styling:** `style.css` (the `:root` variables up top).
