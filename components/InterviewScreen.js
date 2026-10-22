"use client";
import { useState } from "react";
import { Mic } from "lucide-react";
import VoiceInterview from "./VoiceInterview";

// Écran « Interview guidée » : présente le principe, puis un bouton lance l'interview (trois questions, une réponse vocale chacune).
export default function InterviewScreen({ language = "", initialTopic = "", onDone, onFree }) {
  const [started, setStarted] = useState(false);
  const [topic, setTopic] = useState(initialTopic);

  if (started) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl" data-testid="interview-screen">
        <VoiceInterview autoStart topic={topic} language={language} onDone={onDone} onCancel={() => setStarted(false)} />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl space-y-5" data-testid="interview-screen">
      <div className="flex items-start gap-3">
        <span className="p-2.5 rounded-xl bg-[#fff1f1] text-[#ff5a5f] shrink-0"><Mic size={20} /></span>
        <div>
          <h2 className="text-lg font-bold" data-testid="interview-title">Interview guidée</h2>
          <p className="text-sm text-gray-500 mt-0.5">Trois questions, une réponse à la voix pour chacune. LinkeePost réunit vos réponses en un texte que vous relisez, puis qui devient la matière d&apos;un post.</p>
        </div>
      </div>
      <ol className="space-y-2 text-sm">
        {["Une situation que vous avez vécue récemment", "Ce que vous en avez retiré ou changé", "Le conseil que vous donneriez"].map((t, i) => (
          <li key={t} className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-[#fff1f1] text-[#ff5a5f] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
            <span className="text-gray-700">{t}</span>
          </li>
        ))}
      </ol>
      <label className="block text-xs text-gray-500">
        Sujet (facultatif) : les questions s&apos;adaptent à ce que vous voulez aborder
        <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder="ex : l'accueil des nouveaux collaborateurs" data-testid="interview-topic" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setStarted(true)} data-testid="interview-start" className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow-sm">Commencer l&apos;interview</button>
        <button type="button" onClick={onFree} data-testid="interview-free" className="text-sm text-gray-500 underline">Dicter librement plutôt</button>
      </div>
      <p className="text-[11px] text-gray-400">Chaque réponse dure de 5 secondes à 3 minutes et compte dans vos minutes de dictée du mois. L&apos;enregistrement n&apos;est pas conservé ; vous pouvez aussi répondre au clavier.</p>
    </div>
  );
}
