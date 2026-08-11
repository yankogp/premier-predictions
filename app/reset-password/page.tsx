"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase слага токените в URL hash след клик от имейла
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setError("Линкът е невалиден или е изтекъл. Заяви нов.");
      }
    });
  }, []);

  const handleUpdate = async () => {
    setError("");
    setMessage("");

    if (!password || password.length < 6) {
      setError("Паролата трябва да е поне 6 символа.");
      return;
    }
    if (password !== confirm) {
      setError("Паролите не съвпадат.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setMessage("Паролата е сменена успешно! Пренасочване...");
    setTimeout(() => router.push("/"), 2000);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-indigo-900 to-purple-900 flex items-center justify-center px-4">
      <div className="bg-white/95 backdrop-blur p-8 rounded-2xl shadow-2xl max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Нова парола
        </h1>
        <p className="text-gray-600 mb-6 text-center text-sm">
          Въведи новата си парола
        </p>

        <input
          type="password"
          placeholder="Нова парола"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <input
          type="password"
          placeholder="Повтори паролата"
          className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-4 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{ color: "#111827", WebkitTextFillColor: "#111827" }}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
            {message}
          </div>
        )}

        <button
          onClick={handleUpdate}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-3 rounded-xl font-semibold transition"
        >
          {loading ? "Запазване..." : "Смени паролата"}
        </button>
      </div>
    </main>
  );
}