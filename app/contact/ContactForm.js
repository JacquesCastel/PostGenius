"use client";

import { useState } from "react";

// variant : "classic" (style actuel) ou "v2" (nouveau style : étiquettes visibles, champs clairs, bouton framboise)
export default function ContactForm({ defaultSubject = "", messagePlaceholder = "Votre message", submitLabel = "Envoyer le message", variant = "classic" }) {
  const [f, setF] = useState({ name: "", email: "", subject: defaultSubject, message: "" });
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const v2 = variant === "v2";

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Erreur");
      setState("sent");
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  };

  if (state === "sent") {
    return v2 ? (
      <div className="bg-[#DCE9DF] rounded-2xl p-8 text-center" role="status">
        <p className="font-display text-2xl text-[#1F4030]">Message envoyé.</p>
        <p className="text-sm text-[#2F4A3C] mt-2">Nous revenons vers vous au plus vite à l&apos;adresse indiquée.</p>
      </div>
    ) : (
      <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="font-semibold text-green-800">Message envoyé !</p>
        <p className="text-sm text-green-700 mt-1">Nous revenons vers vous au plus vite à l'adresse indiquée.</p>
      </div>
    );
  }

  if (v2) {
    const input = "w-full border-[1.5px] border-[#E2D4D0] bg-[#FCF8F5] rounded-2xl px-4 py-3 text-base text-[#2E1F33] placeholder:text-[#8B7A90] focus:outline-none focus:border-[#C2456F] focus:ring-2 focus:ring-[#F6E3E0]";
    const label = "block text-sm font-semibold mb-1.5";
    return (
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="cf-name" className={label}>Votre nom</label>
          <input id="cf-name" className={input} placeholder="Prénom Nom" value={f.name} onChange={set("name")} required autoComplete="name" />
        </div>
        <div>
          <label htmlFor="cf-email" className={label}>Votre e-mail</label>
          <input id="cf-email" className={input} type="email" placeholder="vous@entreprise.fr" value={f.email} onChange={set("email")} required autoComplete="email" />
        </div>
        <div>
          <label htmlFor="cf-subject" className={label}>Sujet <span className="font-normal text-[#6B5A70]">(facultatif)</span></label>
          <input id="cf-subject" className={input} value={f.subject} onChange={set("subject")} />
        </div>
        <div>
          <label htmlFor="cf-message" className={label}>Votre message</label>
          <textarea id="cf-message" className={input} rows={5} placeholder={messagePlaceholder} value={f.message} onChange={set("message")} required />
        </div>
        {error && <p className="text-sm text-[#9E3157]" role="alert">{error}</p>}
        <button type="submit" disabled={state === "sending"} className="bg-[#C2456F] hover:bg-[#9E3157] disabled:bg-[#C9B8BD] text-white font-semibold px-7 py-3.5 rounded-full transition-colors">
          {state === "sending" ? "Envoi…" : submitLabel}
        </button>
      </form>
    );
  }

  const input =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3">
        <input className={input} placeholder="Votre nom" value={f.name} onChange={set("name")} required />
        <input className={input} type="email" placeholder="Votre email" value={f.email} onChange={set("email")} required />
      </div>
      <input className={input} placeholder="Sujet (optionnel)" value={f.subject} onChange={set("subject")} />
      <textarea
        className={input}
        rows={6}
        placeholder={messagePlaceholder}
        value={f.message}
        onChange={set("message")}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-medium px-6 py-2.5 rounded-xl"
      >
        {state === "sending" ? "Envoi…" : submitLabel}
      </button>
    </form>
  );
}
