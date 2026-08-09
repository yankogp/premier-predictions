const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://listuioxhddfxadiahql.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpc3R1aW94aGRkZnhhZGlhaHFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNDM1NDUsImV4cCI6MjEwMTcxOTU0NX0.cFrG2l-mTAqoHDZwaz2DfF-n1WA0_m6IJ5tSCPh5L0k";
const FOOTBALL_TOKEN = "97ff940c23be49c8b1dff3580e28cebb";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
async function importMatches() {
  console.log("Изтегляне на мачове от football-data.org...");

  const response = await fetch(
    "https://api.football-data.org/v4/competitions/PL/matches?season=2026",
    {
      headers: {
        "X-Auth-Token": FOOTBALL_TOKEN,
      },
    }
  );

  if (!response.ok) {
    console.error("Грешка от API:", response.status, await response.text());
    return;
  }

  const data = await response.json();
  const matches = data.matches || [];

  console.log(`Намерени ${matches.length} мача`);

  const rows = matches.map((match) => {
    const utcDate = new Date(match.utcDate);

    return {
      round: match.matchday,
      match_date: utcDate.toISOString().split("T")[0], // YYYY-MM-DD
      match_time: utcDate.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/London",
      }),
      home_team: match.homeTeam?.name || match.homeTeam?.shortName || "TBD",
      away_team: match.awayTeam?.name || match.awayTeam?.shortName || "TBD",
      home_score: match.score?.fullTime?.home ?? null,
      away_score: match.score?.fullTime?.away ?? null,
      status: match.status?.toLowerCase() || "scheduled",
    };
  });

  console.log("Записване в Supabase...");

  // Изтриваме старите мачове (за всеки случай)
  await supabase.from("matches").delete().neq("id", 0);

  // Записваме на партиди по 50
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("matches").insert(chunk);

    if (error) {
      console.error("Грешка при запис:", error);
      return;
    }
    console.log(`Записани ${Math.min(i + chunkSize, rows.length)} / ${rows.length}`);
  }

  console.log("✅ Готово! Всички мачове са заредени.");
}

importMatches().catch(console.error);