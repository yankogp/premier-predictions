import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 500 });
  }

  const res = await fetch(
    "https://api.football-data.org/v4/competitions/PL/standings?season=2026",
    {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 3600 },
    }
  );

  if (!res.ok) {
    return NextResponse.json(
      { error: "API error", details: await res.text() },
      { status: 500 }
    );
  }

  const data = await res.json();
  const table = data.standings?.[0]?.table || [];

  return NextResponse.json({
    ok: true,
    table: table.map((row: any) => ({
      position: row.position,
      team: row.team?.name,
      crest: row.team?.crest,
      played: row.playedGames,
      won: row.won,
      draw: row.draw,
      lost: row.lost,
      gf: row.goalsFor,
      ga: row.goalsAgainst,
      gd: row.goalDifference,
      points: row.points,
    })),
  });
}