/* ============================================================================
   World Cup 2026 — Family Draw  ·  data updater
   ----------------------------------------------------------------------------
   Pulls the World Cup fixtures + group standings from football-data.org and
   writes everything the website needs into data.json.

   Run it with your free API token:
       FOOTBALL_DATA_TOKEN=xxxxx node update.mjs

   The GitHub Action runs this automatically twice a day. You never need to
   touch data.json by hand.

   Why this approach is "precise without guessing":
     - Group positions come straight from football-data's official standings.
     - Who's knocked out is read from the real bracket: once the knockout
       fixtures exist, any team not in them is out; in the knockouts, the loser
       of a finished match is out. We never re-derive FIFA's tiebreakers.
   ============================================================================ */

const TOKEN = process.env.FOOTBALL_DATA_TOKEN;
if (!TOKEN) {
  console.error("Missing FOOTBALL_DATA_TOKEN environment variable.");
  process.exit(1);
}

const BASE = "https://api.football-data.org/v4/competitions/WC";
const HEADERS = { "X-Auth-Token": TOKEN };

// --- Map football-data's team names to the exact names used in app.js --------
// We normalise (lowercase, strip accents/punctuation) before looking up, so
// small spelling differences don't matter. Any team that fails to map is
// reported loudly so we can add it here.
const ALIASES = {
  "croatia": "Croatia",
  "sweden": "Sweden",
  "jordan": "Jordan",
  "cape verde": "Cape Verde", "cabo verde": "Cape Verde", "cape verde islands": "Cape Verde",
  "saudi arabia": "Saudi Arabia",
  "portugal": "Portugal",
  "spain": "Spain",
  "curacao": "Curaçao",
  "morocco": "Morocco",
  "scotland": "Scotland",
  "tunisia": "Tunisia",
  "czechia": "Czechia", "czech republic": "Czechia",
  "senegal": "Senegal",
  "belgium": "Belgium",
  "netherlands": "Netherlands",
  "iraq": "Iraq",
  "south korea": "South Korea", "korea republic": "South Korea", "republic of korea": "South Korea",
  "england": "England",
  "brazil": "Brazil",
  "uruguay": "Uruguay",
  "ivory coast": "Ivory Coast", "cote divoire": "Ivory Coast", "cote d ivoire": "Ivory Coast",
  "germany": "Germany",
  "norway": "Norway",
  "ecuador": "Ecuador",
  "japan": "Japan",
  "panama": "Panama",
  "paraguay": "Paraguay",
  "algeria": "Algeria",
  "dr congo": "DR Congo", "congo dr": "DR Congo", "democratic republic of congo": "DR Congo", "congo": "DR Congo",
  "ghana": "Ghana",
  "argentina": "Argentina",
  "egypt": "Egypt",
  "australia": "Australia",
  "france": "France",
  "bosnia": "Bosnia", "bosnia and herzegovina": "Bosnia", "bosnia herzegovina": "Bosnia",
  "turkiye": "Türkiye", "turkey": "Türkiye",
  "new zealand": "New Zealand",
  "austria": "Austria",
  "canada": "Canada",
  "colombia": "Colombia",
  "south africa": "South Africa",
  "uzbekistan": "Uzbekistan",
  "switzerland": "Switzerland",
  "usa": "USA", "united states": "USA", "united states of america": "USA",
  "haiti": "Haiti",
  "qatar": "Qatar",
  "mexico": "Mexico",
  "iran": "Iran", "ir iran": "Iran", "iran islamic republic": "Iran",
};

const normalize = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // strip accents
    .toLowerCase()
    .replace(/[^a-z ]+/g, " ")          // drop punctuation
    .replace(/\s+/g, " ")
    .trim();

const unmapped = new Set();
function canon(name) {
  const hit = ALIASES[normalize(name)];
  if (!hit) unmapped.add(name);
  return hit || name; // fall back to raw name so nothing crashes
}

// football-data stage -> our short stage codes
const STAGE_MAP = {
  GROUP_STAGE: "group",
  LAST_32: "r32",
  ROUND_OF_32: "r32",
  LAST_16: "r16",
  ROUND_OF_16: "r16",
  QUARTER_FINALS: "qf",
  QUARTER_FINAL: "qf",
  SEMI_FINALS: "sf",
  SEMI_FINAL: "sf",
  THIRD_PLACE: "third",
  FINAL: "final",
};
const KO_ORDER = ["r32", "r16", "qf", "sf", "final"]; // knockout depth order

// "GROUP_A" / "Group A" -> "A"
const groupLetter = (g) => ((g || "").replace(/^group[\s_]*/i, "").trim() || null);

async function api(path) {
  const res = await fetch(BASE + path, { headers: HEADERS });
  if (!res.ok) throw new Error(`football-data ${path} -> ${res.status} ${res.statusText}`);
  return res.json();
}

function winnerOf(match) {
  // Prefer the API's own winner; fall back to penalties then full-time score.
  const s = match.score || {};
  if (s.winner === "HOME_TEAM") return "home";
  if (s.winner === "AWAY_TEAM") return "away";
  const pen = s.penalties || {};
  if (pen.home != null && pen.away != null && pen.home !== pen.away)
    return pen.home > pen.away ? "home" : "away";
  const ft = s.fullTime || {};
  if (ft.home != null && ft.away != null && ft.home !== ft.away)
    return ft.home > ft.away ? "home" : "away";
  return null; // undecided / draw
}

async function main() {
  const [matchesData, standingsData] = await Promise.all([
    api("/matches"),
    api("/standings").catch(() => ({ standings: [] })), // standings may 404 early
  ]);

  const matches = matchesData.matches || [];

  // ---- Build the team status map, seeded from the draw (everyone alive) -----
  // We list every team we know about from the fixtures.
  const teams = {}; // canonicalName -> { status, reached, group, played, ... }
  const ensure = (name) => {
    if (!teams[name]) teams[name] = { status: "alive", reached: "group", group: null };
    return teams[name];
  };

  // ---- Group standings: positions + records straight from the API ----------
  for (const block of standingsData.standings || []) {
    if (block.type && block.type !== "TOTAL") continue;
    const grp = groupLetter(block.group);
    for (const row of block.table || []) {
      const name = canon(row.team?.name);
      const t = ensure(name);
      if (grp) t.group = grp;
      t.rank = row.position;
      t.played = row.playedGames;
      t.won = row.won;
      t.draw = row.draw;
      t.lost = row.lost;
      t.gf = row.goalsFor;
      t.ga = row.goalsAgainst;
      t.gd = row.goalDifference;
      t.points = row.points;
    }
  }

  // ---- Walk every match to work out bracket depth + eliminations -----------
  const koFinished = []; // finished knockout matches
  let knockoutsStarted = false;
  let championName = null;

  for (const m of matches) {
    const stage = STAGE_MAP[m.stage] || "group";
    const home = m.homeTeam?.name ? canon(m.homeTeam.name) : null;
    const away = m.awayTeam?.name ? canon(m.awayTeam.name) : null;
    if (home) ensure(home);
    if (away) ensure(away);

    const isKO = KO_ORDER.includes(stage);
    if (isKO && (home || away)) knockoutsStarted = true;

    // "reached" = the deepest stage a team appears in (scheduled or played).
    const bump = (name) => {
      if (!name) return;
      const t = ensure(name);
      const cur = t.reached;
      const rank = (st) => (st === "group" ? 0 : KO_ORDER.indexOf(st) + 1);
      if (rank(stage) > rank(cur === "champion" ? "final" : cur)) t.reached = stage;
    };
    if (stage !== "third") { bump(home); bump(away); }

    if (m.status === "FINISHED" && isKO && stage !== "third") {
      koFinished.push({ ...m, _stage: stage, _home: home, _away: away });
    }
    if (m.stage === "FINAL" && m.status === "FINISHED") {
      const w = winnerOf(m);
      if (w === "home") championName = home;
      else if (w === "away") championName = away;
    }
  }

  // Knockout eliminations: the loser of a finished KO match is out.
  for (const m of koFinished) {
    const w = winnerOf(m);
    if (!w) continue;
    const loser = w === "home" ? m._away : m._home;
    if (!loser) continue;
    const t = ensure(loser);
    t.status = "out";
    t.reached = m._stage; // they got knocked out at this stage
  }

  // Group eliminations: once the knockout bracket exists, any team not in it is out.
  if (knockoutsStarted) {
    const inBracket = new Set();
    for (const m of matches) {
      const stage = STAGE_MAP[m.stage] || "group";
      if (!KO_ORDER.includes(stage)) continue;
      if (m.homeTeam?.name) inBracket.add(canon(m.homeTeam.name));
      if (m.awayTeam?.name) inBracket.add(canon(m.awayTeam.name));
    }
    for (const [name, t] of Object.entries(teams)) {
      if (!inBracket.has(name)) { t.status = "out"; t.reached = "group"; }
    }
  }

  // Champion!
  if (championName) {
    const t = ensure(championName);
    t.status = "alive";
    t.reached = "champion";
  }

  // ---- Compact fixtures list for the "Matches" section ----------------------
  const fixtures = matches
    .map((m) => ({
      date: m.utcDate,
      stage: STAGE_MAP[m.stage] || "group",
      group: groupLetter(m.group),
      home: m.homeTeam?.name ? canon(m.homeTeam.name) : "TBD",
      away: m.awayTeam?.name ? canon(m.awayTeam.name) : "TBD",
      hs: m.score?.fullTime?.home ?? null,
      as: m.score?.fullTime?.away ?? null,
      status: m.status,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const out = {
    lastUpdated: new Date().toISOString(),
    champion: championName,
    teams,
    fixtures,
  };

  const { writeFileSync } = await import("node:fs");
  writeFileSync(new URL("./data.json", import.meta.url), JSON.stringify(out, null, 2));

  console.log(`Wrote data.json — ${Object.keys(teams).length} teams, ${fixtures.length} fixtures.`);
  if (championName) console.log(`Champion: ${championName}`);
  if (unmapped.size) {
    console.warn("\n⚠️  Unmapped team names (add to ALIASES in update.mjs):");
    for (const n of unmapped) console.warn("   - " + n);
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
