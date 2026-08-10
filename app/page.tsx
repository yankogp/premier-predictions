"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

type Match = {
  id: number;
  round: number;
  match_date: string;
  match_time: string | null;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type AllPrediction = {
  match_id: number;
  player_name: string;
  home_score: number;
  away_score: number;
};

type Standing = {
  player_name: string;
  points: number;
  exact: number;
  correct: number;
  total: number;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<{
    [key: number]: { home: string; away: string; saved?: boolean };
  }>({});
  const [allPredictions, setAllPredictions] = useState<AllPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [selectedRound, setSelectedRound] = useState<string>("upcoming");
  const [view, setView] = useState<"matches" | "standings">("matches");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      const name =
        session?.user?.user_metadata?.display_name ||
        session?.user?.email?.split("@")[0] ||
        "";
      setPlayerName(name);
      if (name) loadPredictions(name);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      const name =
        session?.user?.user_metadata?.display_name ||
        session?.user?.email?.split("@")[0] ||
        "";
      setPlayerName(name);
      if (name) loadPredictions(name);
    });

    loadMatches();
    loadAllPredictions();

    return () => subscription.unsubscribe();
  }, []);

  const loadMatches = async () => {
    setLoadingMatches(true);
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("round", { ascending: true })
      .order("match_date", { ascending: true })
      .order("match_time", { ascending: true });

    if (error) console.error(error);
    else setMatches(data || []);
    setLoadingMatches(false);
  };

  const loadPredictions = async (name: string) => {
    const { data, error } = await supabase
      .from("predictions")
      .select("*")
      .eq("player_name", name);

    if (error) {
      console.error(error);
      return;
    }

    if (data) {
      const loaded: any = {};
      data.forEach((item: any) => {
        loaded[item.match_id] = {
          home: item.home_score.toString(),
          away: item.away_score.toString(),
          saved: true,
        };
      });
      setPredictions(loaded);
    }
  };

  const loadAllPredictions = async () => {
    const { data, error } = await supabase
      .from("predictions")
      .select("match_id, player_name, home_score, away_score")
      .order("player_name");

    if (error) console.error(error);
    else setAllPredictions(data || []);
  };

  const handleRegister = async () => {
    setAuthError("");
    if (!email || !password || !displayName.trim()) {
      setAuthError("Моля, попълни всички полета.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Паролата трябва да е поне 6 символа.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName.trim(),
        },
      },
    });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
      return;
    }

    if (data.user) {
      setPlayerName(displayName.trim());
      loadPredictions(displayName.trim());
    }
  };

  const handleLogin = async () => {
    setAuthError("");
    if (!email || !password) {
      setAuthError("Моля, попълни имейл и парола.");
      return;
    }

    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setAuthLoading(false);

    if (error) {
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPlayerName("");
    setPredictions({});
    setEmail("");
    setPassword("");
    setDisplayName("");
  };

  const handlePredictionChange = (
    matchId: number,
    team: "home" | "away",
    value: string
  ) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team]: value,
        saved: false,
      },
    }));
  };

  const savePrediction = async (matchId: number) => {
    const pred = predictions[matchId];
    if (!pred?.home || !pred?.away) {
      alert("Моля, въведи резултат и за двата отбора!");
      return;
    }
    if (!playerName) {
      alert("Трябва да си влязъл в профила си!");
      return;
    }

    setLoading(true);

    const { data: existing } = await supabase
      .from("predictions")
      .select("id")
      .eq("player_name", playerName)
      .eq("match_id", matchId)
      .single();

    let error;
    if (existing) {
      const { error: updateError } = await supabase
        .from("predictions")
        .update({
          home_score: parseInt(pred.home),
          away_score: parseInt(pred.away),
        })
        .eq("id", existing.id);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from("predictions").insert({
        match_id: matchId,
        player_name: playerName,
        home_score: parseInt(pred.home),
        away_score: parseInt(pred.away),
      });
      error = insertError;
    }

    setLoading(false);

    if (error) {
      alert("Грешка при запазване: " + error.message);
      return;
    }

    setPredictions((prev) => ({
      ...prev,
      [matchId]: { ...prev[matchId], saved: true },
    }));
    loadAllPredictions();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "short",
    });
  };

  const calculateStandings = (): Standing[] => {
    const finishedMatches = matches.filter(
      (m) => m.home_score !== null && m.away_score !== null
    );

    const playerStats: Record<
      string,
      { points: number; exact: number; correct: number; total: number }
    > = {};

    allPredictions.forEach((pred) => {
      const match = finishedMatches.find((m) => m.id === pred.match_id);
      if (!match) return;

      if (!playerStats[pred.player_name]) {
        playerStats[pred.player_name] = {
          points: 0,
          exact: 0,
          correct: 0,
          total: 0,
        };
      }

      const stats = playerStats[pred.player_name];
      stats.total += 1;

      const actualHome = match.home_score!;
      const actualAway = match.away_score!;
      const predHome = pred.home_score;
      const predAway = pred.away_score;

      if (predHome === actualHome && predAway === actualAway) {
        stats.points += 5;
        stats.exact += 1;
        return;
      }

      const actualResult =
        actualHome > actualAway ? "H" : actualHome < actualAway ? "A" : "D";
      const predResult =
        predHome > predAway ? "H" : predHome < predAway ? "A" : "D";

      if (actualResult === predResult) {
        stats.points += 3;
        stats.correct += 1;
      }
    });

    return Object.entries(playerStats)
      .map(([player_name, stats]) => ({ player_name, ...stats }))
      .sort((a, b) => b.points - a.points || b.exact - a.exact);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allRounds = Array.from(new Set(matches.map((m) => m.round))).sort(
    (a, b) => a - b
  );

  let filteredMatches = matches;
  if (selectedRound === "upcoming") {
    filteredMatches = matches.filter((m) => {
      const d = new Date(m.match_date);
      d.setHours(0, 0, 0, 0);
      return d >= today;
    });
  } else if (selectedRound !== "all") {
    filteredMatches = matches.filter(
      (m) => m.round === parseInt(selectedRound)
    );
  }

  const matchesByRound = filteredMatches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b);

  const getPredictionsForMatch = (matchId: number) =>
    allPredictions.filter((p) => p.match_id === matchId);

  const standings = calculateStandings();

  // ===== ЕКРАН ЗА ЛОГИН / РЕГИСТРАЦИЯ =====
  if (!session || !user) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center px-4">
        <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-1 text-center">
            Premier League
          </h1>
          <p className="text-gray-600 mb-6 text-center">Predictions 2026/27</p>

          <div className="flex gap-2 mb-6">
            <button
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                authMode === "login"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Вход
            </button>
            <button
              onClick={() => {
                setAuthMode("register");
                setAuthError("");
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                authMode === "register"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              Регистрация
            </button>
          </div>

          {authMode === "register" && (
            <input
              type="text"
              placeholder="Твоето име (за класирането)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}

          <input
            type="email"
            placeholder="Имейл"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Парола (мин. 6 символа)"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              (authMode === "login" ? handleLogin() : handleRegister())
            }
          />

          {authError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {authError}
            </div>
          )}

          <button
            onClick={authMode === "login" ? handleLogin : handleRegister}
            disabled={authLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3.5 rounded-xl font-semibold text-lg transition"
          >
            {authLoading
              ? "Моля изчакай..."
              : authMode === "login"
              ? "Влез"
              : "Регистрирай се"}
          </button>
        </div>
      </main>
    );
  }

  // ===== ОСНОВНО ПРИЛОЖЕНИЕ =====
  return (
    <main className="min-h-screen bg-gray-50 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.06]"
        style={{
          backgroundImage: "url('/pl-logo.png')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundSize: "min(70vw, 500px)",
        }}
      />

      <header className="bg-gradient-to-r from-blue-900 to-indigo-800 text-white sticky top-0 z-10 shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold leading-tight">PL Predictions</h1>
              <p className="text-blue-200 text-sm">Сезон 2026/27</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                {playerName}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
              >
                Изход
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setView("matches")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                view === "matches"
                  ? "bg-white text-blue-900"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              Мачове
            </button>
            <button
              onClick={() => setView("standings")}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                view === "standings"
                  ? "bg-white text-blue-900"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              Класиране
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-2xl mx-auto px-4 py-6">
        {view === "standings" ? (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Класиране</h2>
            <p className="text-sm text-gray-500 mb-6">
              5 т. за точен резултат • 3 т. за правилен изход
            </p>

            {standings.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500">
                Все още няма изиграни мачове с резултати.
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">#</th>
                      <th className="text-left px-4 py-3 font-medium">Играч</th>
                      <th className="text-center px-3 py-3 font-medium">Тчн</th>
                      <th className="text-center px-3 py-3 font-medium">Изх</th>
                      <th className="text-center px-3 py-3 font-medium font-bold">
                        Точки
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s, index) => (
                      <tr
                        key={s.player_name}
                        className={`border-t border-gray-100 ${
                          s.player_name === playerName ? "bg-blue-50" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                          {s.player_name}
                          {s.player_name === playerName && (
                            <span className="ml-2 text-xs text-blue-600">
                              (ти)
                            </span>
                          )}
                        </td>
                        <td className="text-center px-3 py-3 text-gray-600">
                          {s.exact}
                        </td>
                        <td className="text-center px-3 py-3 text-gray-600">
                          {s.correct}
                        </td>
                        <td className="text-center px-3 py-3 font-bold text-blue-700 text-base">
                          {s.points}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
                Покажи:
              </label>
              <select
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="upcoming">Предстоящи кръгове</option>
                <option value="all">Всички кръгове</option>
                {allRounds.map((round) => (
                  <option key={round} value={round.toString()}>
                    Кръг {round}
                  </option>
                ))}
              </select>
            </div>

            {loadingMatches ? (
              <div className="text-center text-gray-500 py-20">
                Зареждане на мачове...
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center text-gray-500 py-20">
                Няма мачове за показване.
              </div>
            ) : (
              <div className="space-y-10">
                {rounds.map((round) => (
                  <div key={round}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="bg-blue-600 text-white text-sm font-bold px-4 py-1.5 rounded-full">
                        Кръг {round}
                      </div>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>

                    <div className="space-y-4">
                      {matchesByRound[round].map((match) => {
                        const pred = predictions[match.id];
                        const isSaved = pred?.saved;
                        const others = getPredictionsForMatch(match.id);
                        const hasResult =
                          match.home_score !== null &&
                          match.away_score !== null;

                        return (
                          <div
                            key={match.id}
                            className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6"
                          >
                            <div className="text-center text-sm text-gray-500 mb-4">
                              {formatDate(match.match_date)}
                              {match.match_time
                                ? ` • ${match.match_time}`
                                : ""}
                              {hasResult && (
                                <span className="ml-2 text-green-600 font-medium">
                                  Резултат: {match.home_score} –{" "}
                                  {match.away_score}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-3 mb-6">
                              <div className="flex-1 text-right">
                                <div className="font-semibold text-lg sm:text-xl text-gray-900">
                                  {match.home_team}
                                </div>
                              </div>
                              <div className="text-gray-400 font-medium text-sm px-2">
                                VS
                              </div>
                              <div className="flex-1 text-left">
                                <div className="font-semibold text-lg sm:text-xl text-gray-900">
                                  {match.away_team}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-3 sm:gap-4">
                              <input
                                type="number"
                                min="0"
                                max="15"
                                placeholder="0"
                                disabled={isSaved || loading || hasResult}
                                className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl text-gray-900 bg-white focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                value={pred?.home || ""}
                                onChange={(e) =>
                                  handlePredictionChange(
                                    match.id,
                                    "home",
                                    e.target.value
                                  )
                                }
                              />
                              <span className="text-2xl font-bold text-gray-300">
                                :
                              </span>
                              <input
                                type="number"
                                min="0"
                                max="15"
                                placeholder="0"
                                disabled={isSaved || loading || hasResult}
                                className="w-14 h-14 sm:w-16 sm:h-16 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl text-gray-900 bg-white focus:border-blue-500 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                                value={pred?.away || ""}
                                onChange={(e) =>
                                  handlePredictionChange(
                                    match.id,
                                    "away",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div className="mt-5 text-center">
                              {isSaved ? (
                                <div className="inline-flex items-center gap-2 text-green-600 font-medium bg-green-50 px-4 py-2 rounded-full text-sm">
                                  <span>✓</span>
                                  <span>
                                    Твоята: {pred.home} – {pred.away}
                                  </span>
                                </div>
                              ) : hasResult ? (
                                <div className="text-sm text-gray-500">
                                  Мачът е приключил
                                </div>
                              ) : (
                                <button
                                  onClick={() => savePrediction(match.id)}
                                  disabled={loading}
                                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:bg-blue-400 text-white px-8 py-2.5 rounded-xl font-medium transition"
                                >
                                  {loading
                                    ? "Запазване..."
                                    : "Запази прогноза"}
                                </button>
                              )}
                            </div>

                            {others.length > 0 && (
                              <div className="mt-5 pt-4 border-t border-gray-100">
                                <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">
                                  Прогнози на играчите
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {others.map((p, idx) => (
                                    <div
                                      key={idx}
                                      className={`text-sm px-3 py-1.5 rounded-full ${
                                        p.player_name === playerName
                                          ? "bg-blue-100 text-blue-800 font-medium"
                                          : "bg-gray-100 text-gray-900"
                                      }`}
                                    >
                                      <span className="font-medium">
                                        {p.player_name}
                                      </span>
                                      : {p.home_score} – {p.away_score}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-center text-gray-400 text-sm mt-10">
          Premier League Predictions • Само за приятели
        </p>
      </div>
    </main>
  );
}