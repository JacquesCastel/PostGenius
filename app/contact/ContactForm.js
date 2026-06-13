"use client";

import { useState } from "react";

export default function ContactForm() {
  const [f, setF] = useState({ name: "", email: "", subject: "", message: "" });
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState(null);
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));

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
    return (
      <div className="bg-green-50 border border-green-100 rounded-2xl p-8 text-center">
        <p className="text-2xl mb-2">✅</p>
        <p className="font-semibold text-green-800">Message envoyé !</p>
        <p className="text-sm text-green-700 mt-1">Nous revenons vers vous au plus vite à l'adresse indiquée.</p>
      </div>
    );
  }

  const input =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

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
        placeholder="Votre message"
        value={f.message}
        onChange={set("message")}
        required
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium px-6 py-2.5 rounded-xl"
      >
        {state === "sending" ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
