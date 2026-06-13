"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Sparkles } from "lucide-react";

const GREETING = {
  role: "assistant",
  content:
    "Bonjour 👋 Je suis l'assistant PostGenius. Posez-moi vos questions sur le fonctionnement, les fonctionnalités ou les offres — je vous explique tout !",
};

const SUGGESTIONS = ["Comment ça marche ?", "Quelle offre choisir ?", "Qu'est-ce qu'une campagne ?"];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [teaser, setTeaser] = useState(false);
  const scrollRef = useRef(null);
  const seenRef = useRef(false);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  // Relance proactive : invite après ~75 s si le chat n'a pas été ouvert (une fois par session)
  useEffect(() => {
    try {
      if (sessionStorage.getItem("pg_chat_seen")) {
        seenRef.current = true;
        return;
      }
    } catch {}
    const t = setTimeout(() => {
      if (!seenRef.current) setTeaser(true);
    }, 75000);
    return () => clearTimeout(t);
  }, []);

  const markSeen = () => {
    seenRef.current = true;
    setTeaser(false);
    try {
      sessionStorage.setItem("pg_chat_seen", "1");
    } catch {}
  };

  const openChat = () => {
    setOpen(true);
    markSeen();
  };

  const send = async (text) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.filter((m) => m !== GREETING) }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.ok ? data.reply : data.error || "Désolé, une erreur est survenue." },
      ]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Désolé, je ne suis pas joignable pour le moment." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Invite proactive */}
      {teaser && !open && (
        <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-72 max-w-xs">
          <div className="relative bg-white rounded-2xl shadow-2xl shadow-rose-200/50 border border-rose-100 p-3.5 pr-8">
            <button
              onClick={markSeen}
              aria-label="Fermer l'invite"
              className="absolute top-2 right-2 text-gray-300 hover:text-gray-500"
            >
              <X size={14} />
            </button>
            <button onClick={openChat} className="text-left w-full">
              <p className="text-sm font-semibold text-[#1b2a4a]">Une question sur PostGenius ? 👋</p>
              <p className="text-xs text-[#5a6b85] mt-0.5">
                Je peux vous expliquer le fonctionnement et vous aider à choisir votre offre. Cliquez pour discuter.
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          markSeen();
        }}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant"}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-[#ff5a5f] hover:bg-[#f63d44] text-white shadow-xl shadow-rose-300/50 flex items-center justify-center transition-colors"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Panneau */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 max-w-sm bg-white rounded-3xl shadow-2xl shadow-rose-200/50 border border-rose-100 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white p-4 flex items-center gap-2">
            <Sparkles size={18} />
            <div>
              <p className="font-bold leading-tight">Assistant PostGenius</p>
              <p className="text-[11px] text-white/80">Réponses instantanées</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 max-h-96 min-h-[16rem] bg-rose-50/40">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === "user" ? "bg-[#ff5a5f] text-white" : "bg-white border border-rose-100 text-[#1b2a4a]"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-rose-100 rounded-2xl px-3.5 py-2.5 text-sm text-gray-400">
                  L'assistant écrit…
                </div>
              </div>
            )}
            {messages.length === 1 && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs bg-white border border-rose-200 text-[#ff5a5f] rounded-full px-3 py-1.5 hover:bg-[#fff1f1] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="p-3 border-t border-rose-100 flex items-center gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Votre question…"
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Envoyer"
              className="w-9 h-9 rounded-full bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white flex items-center justify-center shrink-0 transition-colors"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
