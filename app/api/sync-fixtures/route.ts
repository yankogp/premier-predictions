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

  // В production изискваме cron header или Bearer secret
  if (process.env.NODE_ENV === "production") {
    const ok =
      isVercelCron ||
      (cronSecret && authHeader === `Bearer ${cronSecret}`);
    if (!ok) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!FOOTBALL_TOKEN) {
    return NextResponse.json(
      { error: "Missing FOOTBALL_DATA_TOKEN" },
      { status: 500 }
    );
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
      const text = await response.text();
      return NextResponse.json(
        { error: "Football API error", details: text },
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
      const status = (api.status || "scheduled").toLowerCase();
      const round = api.matchday;

      const homeN = normalize(api.homeTeam?.name || "");
      const awayN = normalize(api.awayTeam?.name || "");

      // 1) отбори + кръг; 2) fallback само отбори
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

      const needsUpdate =
        db.match_date !== match_date ||
        db.match_time !== match_time ||
        db.home_score !== home_score ||
        db.away_score !== away_score ||
        db.status !== status ||
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
          status,
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
        `${db.home_team} vs ${db.away_team}: ${db.match_date} ${db.match_time} → ${match_date} ${match_time}`
      );
    }

    return NextResponse.json({
      ok: true,
      totalFromApi: apiMatches.length,
      updated,
      unchanged,
      notFound,
      changes: changes.slice(0, 30),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}