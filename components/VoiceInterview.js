"use client";
import { useState, useEffect } from "react";
import VoiceRecorder from "./VoiceRecorder";

// Interview guidée : trois questions, une réponse dictée (ou écrite) pour chacune ; renvoie les réponses réunies, à relire.
export default function VoiceInterview({ topic = "", language = "", autoStart = false, onDone, onCancel }) {
  const [questions, setQuestions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState(["", "", ""]);
  const [typing, setTyping] = useState(false);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/transcribe/interview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Interview indisponible.");
      setQuestions(d.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (autoStart) start(); }, []); // depuis l'écran dédié, le clic sur « Commencer » a déjà eu lieu

  if (!questions) {
    return (
      <div className="space-y-2 mb-3" data-testid="interview-intro">
        <p className="text-xs text-gray-500">Trois questions, une réponse à la voix pour chacune (30 secondes à 2 minutes). LinkeePost les réunit ensuite en un texte que vous relisez.</p>
        {error && <p className="text-xs text-red-600" data-testid="interview-error">{error}</p>}
        <div className="flex gap-3 items-center">
          <button type="button" onClick={start} disabled={loading} data-testid="interview-start" className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg">{loading ? "Préparation des questions…" : "Commencer l'interview"}</button>
          <button type="button" onClick={onCancel} className="text-sm text-gray-500 underline">Dicter librement</button>
        </div>
      </div>
    );
  }

  const answer = answers[step];
  const setAnswer = (t) => setAnswers((a) => a.map((x, i) => (i === step ? t : x)));
  const last = step === questions.length - 1;
  const next = () => {
    const all = answers.map((a) => a.trim()).filter(Boolean).join("\n\n");
    setTyping(false);
    if (!last) setStep(step + 1);
    else if (all) onDone(all);
  };
  return (
    <div className="space-y-2 mb-3" data-testid="interview">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400" data-testid="interview-step">Question {step + 1} sur {questions.length}</p>
      <p className="text-sm font-medium text-gray-800" data-testid="interview-question">{questions[step]}</p>
      {answer === "" && !typing ? (
        <>
          <VoiceRecorder key={step} language={language} onText={setAnswer} />
          <div className="flex gap-3 text-xs text-gray-500">
            <button type="button" onClick={() => setTyping(true)} className="underline" data-testid="interview-type">Répondre au clavier</button>
            <button type="button" onClick={next} className="underline" data-testid="interview-skip">Passer cette question</button>
          </div>
        </>
      ) : (
        <>
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={5} maxLength={4000} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]" data-testid="interview-answer" />
          <div className="flex gap-3 items-center">
            <button type="button" onClick={next} disabled={last && !answers.some((a) => a.trim())} data-testid="interview-next" className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg">{last ? "Terminer" : "Question suivante"}</button>
            <button type="button" onClick={() => { setAnswer(""); setTyping(false); }} className="text-sm text-gray-500 underline" data-testid="interview-redo">Réenregistrer</button>
          </div>
        </>
      )}
    </div>
  );
}
