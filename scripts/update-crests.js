const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://listuioxhddfxadiahql.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3R1aW94aGRkZnhhZGlhaHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDM1NDUsImV4cCI6MjEwMTcxOTU0NX0.cFrG2l-mTAqoHDZwaz2DfF-n1WA0_m6IJ5tSCPh5L0k"
);
const FOOTBALL_TOKEN = "97ff940c23be49c8b1dff3580e28cebb";

function normalize(name) {
  return (name || "")
    .toLowerCase()
    .replace(/\s+fc$/g, "")
    .replace(/\s+afc$/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  console.log("Изтегляне на мачове...");
  const res = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?season=2026",
    { headers: { "X-Auth-Token": FOOTBALL_TOKEN } }
  );

  if (!res.ok) {
    console.error("API error:", res.status, await res.text());
    return;
  }

  const apiMatches = (await res.json()).matches || [];
  console.log("API мачове:", apiMatches.length);

  const { data: dbMatches, error } = await supabase
    .from("matches")
    .select("id, home_team, away_team, round");

  if (error) {
    console.error(error);
    return;
  }

  let updated = 0;

  for (const api of apiMatches) {
    const homeN = normalize(api.homeTeam?.name);
    const awayN = normalize(api.awayTeam?.name);
    const homeCrest = api.homeTeam?.crest || null;
    const awayCrest = api.awayTeam?.crest || null;

    if (!homeCrest && !awayCrest) continue;

    let db = dbMatches.find(
      (m) =>
        normalize(m.home_team) === homeN &&
        normalize(m.away_team) === awayN &&
        m.round === api.matchday
    );

    if (!db) {
      db = dbMatches.find(
        (m) =>
          normalize(m.home_team) === homeN && normalize(m.away_team) === awayN
      );
    }

    if (!db) continue;

    const { error: upErr } = await supabase
      .from("matches")
      .update({ home_crest: homeCrest, away_crest: awayCrest })
      .eq("id", db.id);

    if (upErr) {
      console.error("Update error:", upErr);
      return;
    }

    updated++;
  }

  console.log("✅ Обновени емблеми за", updated, "мача");
}

main().catch(console.error);
