/* ============================================================================
   World Cup 2026 — Family Draw tracker
   ----------------------------------------------------------------------------
   This file holds the STATIC stuff that never changes:
     - who owns which team
     - flags + display names
     - the tournament stages and how we score "who's ahead"

   The LIVE stuff (who's still in, scores, upcoming matches) lives in data.json
   so it can be updated on its own — by hand or by the auto-updater later.
   ============================================================================ */

// --- The three players -------------------------------------------------------
const OWNERS = ["Mom", "Byron", "Melissa"];

// --- The draw: every team, its owner, and a flag -----------------------------
// flag is just an emoji so we never need to ship any image files.
const TEAMS = [
  // Mom
  { name: "Croatia",       owner: "Mom",     flag: "🇭🇷" },
  { name: "Sweden",        owner: "Mom",     flag: "🇸🇪" },
  { name: "Jordan",        owner: "Mom",     flag: "🇯🇴" },
  { name: "Cape Verde",    owner: "Mom",     flag: "🇨🇻" },
  { name: "Saudi Arabia",  owner: "Mom",     flag: "🇸🇦" },
  { name: "Portugal",      owner: "Mom",     flag: "🇵🇹" },
  { name: "Spain",         owner: "Mom",     flag: "🇪🇸" },
  { name: "Curaçao",       owner: "Mom",     flag: "🇨🇼" },
  { name: "Morocco",       owner: "Mom",     flag: "🇲🇦" },
  { name: "Scotland",      owner: "Mom",     flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿" },
  { name: "Tunisia",       owner: "Mom",     flag: "🇹🇳" },
  { name: "Czechia",       owner: "Mom",     flag: "🇨🇿" },
  { name: "Senegal",       owner: "Mom",     flag: "🇸🇳" },
  { name: "Belgium",       owner: "Mom",     flag: "🇧🇪" },
  { name: "Netherlands",   owner: "Mom",     flag: "🇳🇱" },
  { name: "Iraq",          owner: "Mom",     flag: "🇮🇶" },

  // Byron
  { name: "South Korea",   owner: "Byron",   flag: "🇰🇷" },
  { name: "England",       owner: "Byron",   flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { name: "Brazil",        owner: "Byron",   flag: "🇧🇷" },
  { name: "Uruguay",       owner: "Byron",   flag: "🇺🇾" },
  { name: "Ivory Coast",   owner: "Byron",   flag: "🇨🇮" },
  { name: "Germany",       owner: "Byron",   flag: "🇩🇪" },
  { name: "Norway",        owner: "Byron",   flag: "🇳🇴" },
  { name: "Ecuador",       owner: "Byron",   flag: "🇪🇨" },
  { name: "Japan",         owner: "Byron",   flag: "🇯🇵" },
  { name: "Panama",        owner: "Byron",   flag: "🇵🇦" },
  { name: "Paraguay",      owner: "Byron",   flag: "🇵🇾" },
  { name: "Algeria",       owner: "Byron",   flag: "🇩🇿" },
  { name: "DR Congo",      owner: "Byron",   flag: "🇨🇩" },
  { name: "Ghana",         owner: "Byron",   flag: "🇬🇭" },
  { name: "Argentina",     owner: "Byron",   flag: "🇦🇷" },
  { name: "Egypt",         owner: "Byron",   flag: "🇪🇬" },

  // Melissa
  { name: "Australia",     owner: "Melissa", flag: "🇦🇺" },
  { name: "France",        owner: "Melissa", flag: "🇫🇷" },
  { name: "Bosnia",        owner: "Melissa", flag: "🇧🇦" },
  { name: "Türkiye",       owner: "Melissa", flag: "🇹🇷" },
  { name: "New Zealand",   owner: "Melissa", flag: "🇳🇿" },
  { name: "Austria",       owner: "Melissa", flag: "🇦🇹" },
  { name: "Canada",        owner: "Melissa", flag: "🇨🇦" },
  { name: "Colombia",      owner: "Melissa", flag: "🇨🇴" },
  { name: "South Africa",  owner: "Melissa", flag: "🇿🇦" },
  { name: "Uzbekistan",    owner: "Melissa", flag: "🇺🇿" },
  { name: "Switzerland",   owner: "Melissa", flag: "🇨🇭" },
  { name: "USA",           owner: "Melissa", flag: "🇺🇸" },
  { name: "Haiti",         owner: "Melissa", flag: "🇭🇹" },
  { name: "Qatar",         owner: "Melissa", flag: "🇶🇦" },
  { name: "Mexico",        owner: "Melissa", flag: "🇲🇽" },
  { name: "Iran",          owner: "Melissa", flag: "🇮🇷" },
];

// --- Tournament stages, in order, with a "depth score" -----------------------
// The further a team gets, the more it's worth — this powers "who's ahead".
const STAGES = {
  group:    { label: "Group stage",   short: "Groups", score: 1 },
  r32:      { label: "Round of 32",   short: "R32",    score: 2 },
  r16:      { label: "Round of 16",   short: "R16",    score: 3 },
  qf:       { label: "Quarter-final", short: "QF",     score: 4 },
  sf:       { label: "Semi-final",    short: "SF",     score: 5 },
  final:    { label: "Final",         short: "Final",  score: 6 },
  champion: { label: "Champions",     short: "🏆",      score: 8 },
};
const STAGE_ORDER = Object.keys(STAGES);

// One colour accent per player.
const OWNER_COLORS = {
  Mom:     "#e0457b",
  Byron:   "#2d8cff",
  Melissa: "#27a981",
};

/* ============================================================================
   Rendering
   ============================================================================ */

const $ = (sel) => document.querySelector(sel);

// Look up the live status for a team, defaulting to "alive / group stage"
// for any team not yet mentioned in data.json.
function statusFor(teamName, live) {
  const s = (live.teams && live.teams[teamName]) || {};
  return {
    status: s.status || "alive",      // "alive" | "out"
    reached: s.reached || "group",    // furthest stage reached / lost at
    group: s.group ?? null,           // group letter
    rank: s.rank ?? null,             // position in group
    points: s.points ?? null,         // group points
    played: s.played ?? null,         // group games played
  };
}

function teamWithStatus(team, live) {
  return { ...team, ...statusFor(team.name, live) };
}

async function loadLive() {
  try {
    const res = await fetch("data.json", { cache: "no-store" });
    if (!res.ok) throw new Error("no data.json");
    return await res.json();
  } catch (e) {
    // No data file yet — that's fine, everyone starts alive.
    return { lastUpdated: null, champion: null, teams: {}, fixtures: [] };
  }
}

// e.g. 2 -> "2nd". Used for group position.
function ordinal(n) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function render(live) {
  const teams = TEAMS.map((t) => teamWithStatus(t, live));
  renderLeaderboard(teams, live);
  renderRosters(teams);
  renderFixtures(live.fixtures || []);
  renderFooter(live);
}

// --- "Who's ahead" leaderboard ----------------------------------------------
function renderLeaderboard(teams, live) {
  const stats = OWNERS.map((owner) => {
    const mine = teams.filter((t) => t.owner === owner);
    const alive = mine.filter((t) => t.status === "alive");
    const score = mine.reduce((sum, t) => sum + STAGES[t.reached].score, 0);
    // Deepest run among this owner's teams (alive teams count for more).
    const deepest = mine.reduce((best, t) => {
      const idx = STAGE_ORDER.indexOf(t.reached);
      return idx > best.idx ? { idx, team: t } : best;
    }, { idx: -1, team: null });
    return { owner, total: mine.length, alive: alive.length, score, deepest };
  });

  // Rank: most teams still alive wins; ties broken by depth score.
  const ranked = [...stats].sort(
    (a, b) => b.alive - a.alive || b.score - a.score
  );
  const leader = ranked[0];
  const isTie = ranked.filter((r) => r.alive === leader.alive && r.score === leader.score).length > 1;

  const championOwner = live.champion
    ? (TEAMS.find((t) => t.name === live.champion) || {}).owner
    : null;

  let banner;
  if (championOwner) {
    banner = `🏆 <strong>${championOwner}</strong> wins the family draw — ${live.champion} are World Champions!`;
  } else if (isTie) {
    banner = `It's neck and neck — ${leader.alive} teams each still standing.`;
  } else {
    banner = `<strong>${leader.owner}</strong> is ahead with <strong>${leader.alive}</strong> teams still alive.`;
  }
  $("#banner").innerHTML = banner;

  $("#leaderboard").innerHTML = ranked
    .map((r, i) => {
      const medal = ["🥇", "🥈", "🥉"][i] || "";
      const champ = championOwner === r.owner;
      const deepestLabel = r.deepest.team
        ? `${r.deepest.team.flag} ${r.deepest.team.name} · ${STAGES[r.deepest.team.reached].short}`
        : "—";
      return `
        <div class="podium-card ${champ ? "is-champion" : ""}" style="--accent:${OWNER_COLORS[r.owner]}">
          <div class="podium-rank">${champ ? "🏆" : medal}</div>
          <div class="podium-name">${r.owner}</div>
          <div class="podium-alive"><span class="big">${r.alive}</span><span class="lbl">still in</span></div>
          <div class="podium-meta">of ${r.total} teams · depth score ${r.score}</div>
          <div class="podium-deepest">Best run: ${deepestLabel}</div>
        </div>`;
    })
    .join("");
}

// --- Each player's roster ----------------------------------------------------
function renderRosters(teams) {
  $("#rosters").innerHTML = OWNERS.map((owner) => {
    const mine = teams.filter((t) => t.owner === owner);
    // Alive first, then by how far they got.
    mine.sort((a, b) => {
      if (a.status !== b.status) return a.status === "alive" ? -1 : 1;
      return STAGE_ORDER.indexOf(b.reached) - STAGE_ORDER.indexOf(a.reached);
    });
    const aliveCount = mine.filter((t) => t.status === "alive").length;

    const chips = mine
      .map((t) => {
        const out = t.status === "out";
        let tag;
        if (out) {
          tag = `out · ${STAGES[t.reached].short}`;
        } else if (t.reached === "group") {
          // Still in the group stage — show live position + points if we have them.
          if (t.group && t.rank) {
            const pts = t.points != null ? ` · ${t.points} pt${t.points === 1 ? "" : "s"}` : "";
            tag = `Grp ${t.group} · ${ordinal(t.rank)}${pts}`;
          } else if (t.group) {
            tag = `Grp ${t.group}`;
          } else {
            tag = STAGES.group.short;
          }
        } else {
          // Into the knockouts.
          tag = t.reached === "champion" ? "🏆 Champion" : `into ${STAGES[t.reached].short}`;
        }
        return `
          <li class="team ${out ? "is-out" : ""}">
            <span class="team-flag">${t.flag}</span>
            <span class="team-name">${t.name}</span>
            <span class="team-tag">${tag}</span>
          </li>`;
      })
      .join("");

    return `
      <section class="roster" style="--accent:${OWNER_COLORS[owner]}">
        <header class="roster-head">
          <h2>${owner}</h2>
          <span class="roster-count">${aliveCount}/${mine.length} alive</span>
        </header>
        <ul class="team-list">${chips}</ul>
      </section>`;
  }).join("");
}

// --- Upcoming / recent matches ----------------------------------------------
function ownerBadge(teamName) {
  const t = TEAMS.find((x) => x.name === teamName);
  if (!t) return "";
  return `<span class="who" style="background:${OWNER_COLORS[t.owner]}">${t.owner}</span>`;
}
function flagFor(teamName) {
  const t = TEAMS.find((x) => x.name === teamName);
  return t ? t.flag : "";
}

function renderFixtures(fixtures) {
  const wrap = $("#fixtures");
  if (!fixtures.length) {
    wrap.innerHTML = `<p class="empty">Match schedule will appear here once live data is connected.</p>`;
    return;
  }
  const fmt = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  };
  const isDone = (f) => f.status === "FINISHED";
  const isLive = (f) => ["IN_PLAY", "PAUSED"].includes(f.status);

  // Show a tidy window: the last few results + anything live + what's coming up.
  const sorted = [...fixtures].sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = sorted.filter(isDone).slice(-5);
  const live = sorted.filter(isLive);
  const upcoming = sorted.filter((f) => !isDone(f) && !isLive(f)).slice(0, 8);
  const show = [...recent, ...live, ...upcoming];

  const row = (f) => {
    const done = isDone(f);
    const playing = isLive(f);
    let mid;
    if (done || playing) mid = `<span class="score">${f.hs ?? "–"} – ${f.as ?? "–"}</span>`;
    else mid = `<span class="vs">vs</span>`;
    const when = done
      ? STAGES[f.stage]?.short || f.stage
      : playing
      ? `<span class="live-dot">● LIVE</span>`
      : fmt(f.date);
    return `
      <div class="fixture ${done ? "done" : ""} ${playing ? "live" : ""}">
        <div class="fx-when">${when}</div>
        <div class="fx-team home">${ownerBadge(f.home)}<span>${flagFor(f.home)} ${f.home}</span></div>
        <div class="fx-mid">${mid}</div>
        <div class="fx-team away"><span>${f.away} ${flagFor(f.away)}</span>${ownerBadge(f.away)}</div>
      </div>`;
  };

  let html = "";
  if (recent.length || live.length) {
    html += `<h3 class="fx-head">Recent &amp; live</h3>` + [...recent, ...live].map(row).join("");
  }
  if (upcoming.length) {
    html += `<h3 class="fx-head">Coming up</h3>` + upcoming.map(row).join("");
  }
  wrap.innerHTML = html || `<p class="empty">No matches to show right now.</p>`;
}

function renderFooter(live) {
  if (live.lastUpdated) {
    const d = new Date(live.lastUpdated);
    $("#updated").textContent = "Last updated " + d.toLocaleString();
  } else {
    $("#updated").textContent = "Showing the draw — live results not connected yet.";
  }
}

// Go!
loadLive().then(render);
