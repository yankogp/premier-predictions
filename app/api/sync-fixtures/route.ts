import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FOOTBALL_TOKEN = process.env.FOOTBALL_DATA_TOKEN!;

function normalize(name: string) {
  return (name || "")
    .toLowerCase()
    .replace(/\s+fc$/g, "")
    .replace(/\s+afc$/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

export async function GET(request: Request) {
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV === "production") {
    const ok =
      isVercelCron || (cronSecret && authHeader === `Bearer ${cronSecret}`);
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!FOOTBALL_TOKEN) {
    return NextResponse.json({ error: "Missing token" }, { status: 500 });
  }

  try {
    const response = await fetch(
      "https://api.football-data.org/v4/competitions/PL/matches?season=2026",
      {
        headers: { "X-Auth-Token": FOOTBALL_TOKEN },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "API error", details: await response.text() },
        { status: 500 }
      );
    }

    const data = await response.json();
    const apiMatches = data.matches || [];

    const { data: dbMatches, error: fetchError } = await supabase
      .from("matches")
      .select(
        "id, round, home_team, away_team, match_date, match_time, home_score, away_score, status"
      );

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    let updated = 0;
    let unchanged = 0;
    let notFound = 0;
    const changes: string[] = [];

    for (const api of apiMatches) {
      const utc = new Date(api.utcDate);
      const match_date = utc.toLocaleDateString("en-CA", {
        timeZone: "Europe/Sofia",
      });
      const match_time = utc.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Sofia",
      });

      const home_score = api.score?.fullTime?.home ?? null;
      const away_score = api.score?.fullTime?.away ?? null;
      const apiStatus = (api.status || "scheduled").toLowerCase();
      const round = api.matchday;

      const homeN = normalize(api.homeTeam?.name || "");
      const awayN = normalize(api.awayTeam?.name || "");

      let db = dbMatches?.find(
        (m) =>
          normalize(m.home_team) === homeN &&
          normalize(m.away_team) === awayN &&
          m.round === round
      );
      if (!db) {
        db = dbMatches?.find(
          (m) =>
            normalize(m.home_team) === homeN &&
            normalize(m.away_team) === awayN
        );
      }

      if (!db) {
        notFound++;
        continue;
      }

      // Принудително обновяване ако API е finished, а в базата още няма резултат
      const forceUpdate =
        apiStatus === "finished" &&
        (db.home_score === null ||
          db.away_score === null ||
          db.status !== "finished");

      const needsUpdate =
        forceUpdate ||
        db.match_date !== match_date ||
        db.match_time !== match_time ||
        db.home_score !== home_score ||
        db.away_score !== away_score ||
        (db.status || "").toLowerCase() !== apiStatus ||
        db.round !== round;

      if (!needsUpdate) {
        unchanged++;
        continue;
      }

      const { error } = await supabase
        .from("matches")
        .update({
          match_date,
          match_time,
          home_score,
          away_score,
          status: apiStatus,
          round,
        })
        .eq("id", db.id);

      if (error) {
        return NextResponse.json(
          { error: error.message, matchId: db.id },
          { status: 500 }
        );
      }

      updated++;
      changes.push(
        `${db.home_team} vs ${db.away_team}: ${db.status || "?"} → ${apiStatus} (${home_score}-${away_score})`
      );
    }

    return NextResponse.json({
      ok: true,
      totalFromApi: apiMatches.length,
      updated,
      unchanged,
      notFound,
      changes: changes.slice(0, 40),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
