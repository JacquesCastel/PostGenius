import { userContextBlock } from "../campaign";

// Échange conversationnel pour affiner la note du copilote éditorial —
// contrairement à une simple zone de texte, l'utilisateur peut discuter
// (préciser, corriger, répondre à une question) avant que la synthèse ne
// soit persistée comme note de profil (voir app/api/editorial/chat/route.js).

const SYSTEM_PROMPT = `Tu es l'assistant du copilote éditorial LinkedIn.
Ton rôle : dialoguer brièvement avec le client pour comprendre comment ajuster
ses recommandations de contenu ("Que publier aujourd'hui ?"). Sois concis
(1 à 3 phrases). Pose une question de clarification si le message est vague
ou ambigu. Dès que l'orientation est assez claire, synthétise-la.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour :
{"reply": "ta réponse conversationnelle", "note": "synthèse cumulée de toutes
les orientations données jusqu'ici dans la conversation (pas seulement le
dernier message), ou null si rien d'assez clair encore pour mettre à jour la note"}`;

export async function chatRefine({ user, messages }) {
  const profile = userContextBlock(user) || "\n(profil peu renseigné)";
  const priorNote = user.editorialNote ? `\nNote actuelle du copilote : ${user.editorialNote}` : "\nAucune note actuelle.";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\nProfil du client :${profile}${priorNote}`,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse IA non parsable");
  const parsed = JSON.parse(match[0]);
  return { reply: String(parsed.reply ?? ""), note: parsed.note ? String(parsed.note) : null, usage: data.usage };
}
