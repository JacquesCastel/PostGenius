"use client";

import { useState, useEffect } from "react";
import { Linkedin, RefreshCw, AlertCircle, Check, KeyRound } from "lucide-react";

// Page ouverte depuis le lien email : /reset-password?token=...

export default function ResetPassword() {
  const [token, setToken] = useState(undefined); // undefined = lecture URL en cours
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`Erreur serveur (${res.status}).`);
      }
      if (!res.ok) throw new Error(data.error || "Erreur");
      setDone(true);
      setTimeout(() => (window.location.href = "/app"), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl">
            <Linkedin size={24} />
          </div>
          <h1 className="font-bold text-xl">PostGenius</h1>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
            <KeyRound size={18} className="text-indigo-600" /> Nouveau mot de passe
          </h2>

          {done ? (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 flex items-center gap-2">
              <Check size={16} /> Mot de passe modifié. Redirection…
            </p>
          ) : token === undefined ? (
            <p className="text-sm text-gray-400 flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" /> Chargement…
            </p>
          ) : !token ? (
            <p className="text-sm text-red-600 flex items-center gap-2">
              <AlertCircle size={16} /> Lien invalide : token manquant. Refaites une demande depuis la
              page de connexion.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <input
                type="password"
                required
                minLength={8}
                placeholder="Nouveau mot de passe (8 caractères min.)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Confirmer le mot de passe"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {error && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle size={14} /> {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
              >
                {loading && <RefreshCw size={16} className="animate-spin" />}
                Changer mon mot de passe
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
