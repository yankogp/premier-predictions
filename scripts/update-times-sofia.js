const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://listuioxhddfxadiahql.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3R1aW94aGRkZnhhZGlhaHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDM1NDUsImV4cCI6MjEwMTcxOTU0NX0.cFrG2l-mTAqoHDZwaz2DfF-n1WA0_m6IJ5tSCPh5L0k";
const FOOTBALL_TOKEN = "97ff940c23be49c8b1dff3580e28cebb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateTimes() {
  console.log("Изтегляне на мачове от API...");

  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?season=2026",
    { headers: { "X-Auth-Token": FOOTBALL_TOKEN } }
  );

  if (!response.ok) {
    console.error("API грешка:", response.status, await response.text());
    return;
  }

  const data = await response.json();
  const apiMatches = data.matches || [];
  console.log(`Намерени ${apiMatches.length} мача от API`);

  const { data: dbMatches, error } = await supabase
    .from("matches")
    .select("id, home_team, away_team, match_date, match_time");

  if (error) {
    console.error("Грешка при четене от Supabase:", error);
    return;
  }

  let updated = 0;

  for (const apiMatch of apiMatches) {
    const utcDate = new Date(apiMatch.utcDate);
    const matchDate = utcDate.toISOString().split("T")[0];
    const matchTime = utcDate.toLocaleTimeString("bg-BG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/Sofia",
    });

    const home = apiMatch.homeTeam?.name;
    const away = apiMatch.awayTeam?.name;

    const dbMatch = dbMatches.find(
      (m) =>
        m.home_team === home &&
        m.away_team === away &&
        m.match_date === matchDate
    );

    if (!dbMatch) continue;
    if (dbMatch.match_time === matchTime) continue;

    const { error: updateError } = await supabase
      .from("matches")
      .update({ match_time: matchTime })
      .eq("id", dbMatch.id);

    if (updateError) {
      console.error("Грешка при update:", updateError);
      continue;
    }

    updated++;
    console.log(
      `${home} – ${away} | ${dbMatch.match_time} → ${matchTime}`
    );
  }

  console.log(`\n✅ Готово. Обновени ${updated} мача (българско време).`);
}

updateTimes().catch(console.error);