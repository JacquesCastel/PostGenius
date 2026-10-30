"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// Écran d'autorisation OAuth : un assistant (claude.ai…) demande l'accès au compte. Connexion si besoin, choix du compte (offre Agence),
// puis « Autoriser » ou « Refuser ». L'adresse de retour est vérifiée côté serveur avant tout affichage.

const card = "bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 w-full max-w-md";
const btn = "text-sm font-bold px-4 py-2.5 rounded-xl disabled:opacity-50";

function Shell({ children }) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-10 bg-slate-100" data-testid="oauth-page">
      <p className="text-xl font-extrabold mb-5 text-[#1b2a4a]">LinkeePost</p>
      {children}
    </main>
  );
}

function LoginForm({ onDone }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Connexion impossible.");
      onDone();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3" data-testid="oauth-login">
      <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Adresse e-mail" data-testid="oauth-email" className="w-full border border-[#cbd5e1] rounded-xl px-3 py-2 text-sm" />
      <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" data-testid="oauth-password" className="w-full border border-[#cbd5e1] rounded-xl px-3 py-2 text-sm" />
      {error && <p role="alert" className="text-sm text-[#b42318]" data-testid="oauth-login-error">{error}</p>}
      <button type="submit" disabled={busy} data-testid="oauth-login-submit" className={`${btn} w-full text-white bg-[#d63b42] hover:bg-[#c2343a]`}>{busy ? "Connexion…" : "Se connecter"}</button>
      <p className="text-xs text-gray-500 text-center">Pas encore de compte ? <a href="/app" className="font-semibold text-[#0a66c2] hover:underline">Créer un compte</a> · <a href="/app" className="font-semibold text-[#0a66c2] hover:underline">Mot de passe oublié</a></p>
    </form>
  );
}

function Authorize() {
  const sp = useSearchParams();
  const q = useMemo(() => ({
    client_id: sp.get("client_id") ?? "", redirect_uri: sp.get("redirect_uri") ?? "", code_challenge: sp.get("code_challenge") ?? "",
    code_challenge_method: sp.get("code_challenge_method") ?? "", state: sp.get("state") ?? "", response_type: sp.get("response_type") ?? "",
  }), [sp]);
  const [ctx, setCtx] = useState(null);
  const [fatal, setFatal] = useState(null);
  const [subject, setSubject] = useState(null);
  const [write, setWrite] = useState(false); // les brouillons ne sont jamais autorisés par défaut
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (q.response_type !== "code" || !q.code_challenge || q.code_challenge_method !== "S256") { setFatal("Ce lien de connexion est incomplet. Relancez la connexion depuis votre assistant."); return; }
    const res = await fetch(`/api/oauth/authorize?${new URLSearchParams({ client_id: q.client_id, redirect_uri: q.redirect_uri })}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setFatal(d.message || "Ce lien de connexion n'est pas valide."); return; }
    setCtx(d);
    setSubject((d.subjects ?? [])[0]?.id ?? null);
  }, [q]);
  useEffect(() => { load().catch(() => setFatal("Chargement impossible. Réessayez.")); }, [load]);

  const goBack = (params) => { const u = new URL(q.redirect_uri); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); window.location.assign(u.toString()); };
  const quitSupport = async () => {
    setBusy(true);
    try { await fetch("/api/agency/impersonate", { method: "DELETE" }); await load(); } finally { setBusy(false); }
  };
  const deny = () => goBack({ error: "access_denied", ...(q.state ? { state: q.state } : {}) });
  const allow = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/oauth/authorize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...q, subject_id: subject, write }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || "Autorisation impossible.");
      window.location.assign(d.redirect);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  if (fatal) return <Shell><div className={card} data-testid="oauth-fatal"><h1 className="text-lg font-extrabold">Connexion impossible</h1><p className="text-sm text-gray-700 mt-2">{fatal}</p></div></Shell>;
  if (!ctx) return <Shell><p className="text-sm text-gray-500">Chargement…</p></Shell>;
  const name = ctx.client.name;

  if (ctx.support) return (
    <Shell><div className={card} data-testid="oauth-support">
      <h1 className="text-lg font-extrabold">Vous êtes en vue support</h1>
      <p className="text-sm text-gray-700 mt-2">Ce navigateur affiche un compte client en lecture seule : aucune autorisation n&apos;est possible dans ce mode. Quittez la vue support, puis autorisez {name} depuis votre propre compte.</p>
      <div className="flex gap-3 mt-5"><button type="button" onClick={quitSupport} disabled={busy} data-testid="oauth-support-quit" className={`${btn} text-white bg-[#d63b42] hover:bg-[#c2343a]`}>{busy ? "…" : "Quitter la vue support"}</button></div>
    </div></Shell>
  );

  if (ctx.needLogin) return (
    <Shell><div className={card}>
      <h1 className="text-lg font-extrabold" data-testid="oauth-title">Connectez-vous pour autoriser {name}</h1>
      <p className="text-sm text-gray-700 mt-2">{name} demande l&apos;accès à votre compte LinkeePost. Connectez-vous d&apos;abord.</p>
      <LoginForm onDone={() => load()} />
    </div></Shell>
  );

  if (!ctx.allowed) return (
    <Shell><div className={card} data-testid="oauth-locked">
      <h1 className="text-lg font-extrabold">Cet accès est inclus dans les offres Pro et Agence</h1>
      <p className="text-sm text-gray-700 mt-2">{ctx.lockedMessage}</p>
      <div className="flex gap-3 mt-5"><a href="/tarifs" className={`${btn} text-white bg-[#d63b42] hover:bg-[#c2343a]`}>Voir les offres</a><button type="button" onClick={deny} className={`${btn} text-[#33415c] border border-[#cbd5e1]`}>Retour à {name}</button></div>
    </div></Shell>
  );

  return (
    <Shell><div className={card} data-testid="oauth-consent">
      <h1 className="text-lg font-extrabold" data-testid="oauth-title">{name} demande l&apos;accès à votre compte</h1>
      <p className="text-sm text-gray-600 mt-1">Connecté en tant que <b data-testid="oauth-user">{ctx.user.email}</b></p>

      {ctx.subjects.length > 1 && (
        <fieldset className="mt-4" data-testid="oauth-subjects">
          <legend className="text-sm font-bold mb-1.5">Sur quel compte ?</legend>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {ctx.subjects.map((s) => (
              <label key={s.id} className={`flex items-center gap-2 text-sm rounded-xl border px-3 py-2 cursor-pointer ${subject === s.id ? "border-[#f3a3a6] bg-[#fff8f8]" : "border-[#e2e8f0]"}`}>
                <input type="radio" name="subject" checked={subject === s.id} onChange={() => setSubject(s.id)} data-testid="oauth-subject" />
                <span className="min-w-0 truncate">{s.label}{s.self ? " (mon compte)" : ""}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="mt-4 text-sm">
        <p className="font-bold">{name} pourra :</p>
        <ul className="mt-1 space-y-0.5 text-gray-700"><li>✓ lire vos posts et votre planning</li><li>✓ lire vos résultats et les conseils du coach</li></ul>
        <label className="flex items-start gap-2 mt-3 cursor-pointer"><input type="checkbox" className="mt-1" checked={write} onChange={(e) => setWrite(e.target.checked)} data-testid="oauth-write" /><span>Autoriser aussi à <b>créer des brouillons et ajouter des sources</b> (vous les relisez avant toute publication)</span></label>
        <p className="font-bold mt-4">{name} ne pourra jamais :</p>
        <ul className="mt-1 space-y-0.5 text-gray-700"><li>✗ programmer ou publier un post</li><li>✗ lire votre mot de passe ni vos jetons LinkedIn</li></ul>
      </div>

      <p className="text-xs text-gray-500 mt-4">Vous serez renvoyé vers <b data-testid="oauth-host">{ctx.client.host}</b>. Vous pourrez retirer cet accès à tout moment dans Mon profil.</p>
      {error && <p role="alert" className="text-sm text-[#b42318] mt-3" data-testid="oauth-error">{error}</p>}
      <div className="flex gap-3 mt-5 justify-end">
        <button type="button" onClick={deny} disabled={busy} data-testid="oauth-deny" className={`${btn} text-[#33415c] border border-[#cbd5e1] hover:bg-gray-50`}>Refuser</button>
        <button type="button" onClick={allow} disabled={busy || !subject} data-testid="oauth-allow" className={`${btn} text-white bg-[#d63b42] hover:bg-[#c2343a]`}>{busy ? "Autorisation…" : "Autoriser l'accès"}</button>
      </div>
    </div></Shell>
  );
}

export default function Page() {
  return <Suspense fallback={null}><Authorize /></Suspense>;
}
