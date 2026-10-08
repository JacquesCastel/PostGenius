import { userContextBlock } from "../campaign";

// Discussion avec le copilote éditorial. Un seul échange sert trois usages :
//  1. retravailler une piste précise quand le client en sélectionne une (« plus concret ») ;
//  2. parler stratégie (le résumé cumulé devient la note du copilote, User.editorialNote) ;
//  3. apprendre ses goûts au fil du temps : le modèle relit tout l'historique et peut proposer des
//     consignes durables, que le client accepte ou non (RemarkSuggestion, puis PostRemark, qui est
//     injectée dans les prompts de génération des posts).
// Fonctions pures (aucune base de données) sauf chatTurn, qui appelle le modèle.

export const MAX_MESSAGE_CHARS = 500;
export const HISTORY_FOR_MODEL = 20; // derniers messages relus à chaque échange
export const MAX_REMEMBER = 2;
export const REMEMBER_CHARS = 140;

// Champs d'une piste que la discussion peut modifier, avec leur longueur maximale (le pilier ne change jamais)
export const RECO_FIELDS = { topic: 300, angle: 500, rationale: 500, hook: 300, cta: 200, objective: 120 };
const POST_TYPES = ["simple", "carrousel", "video"];

const SYSTEM_PROMPT = `Tu es le copilote éditorial LinkedIn d'un client. Tu dialogues avec lui pour :
1. retravailler une PISTE de contenu précise quand il en a sélectionné une ;
2. comprendre sa stratégie et ses goûts ;
3. apprendre, au fil des échanges, sa façon d'écrire et de choisir ses sujets.
Vouvoiement. Réponses courtes (1 à 3 phrases). Si la demande est vague, pose UNE question de clarification.
Tu relis tout l'historique de la discussion : appuie-toi sur ce que le client a déjà dit, ne le fais pas se répéter.

Tu réponds UNIQUEMENT avec un objet JSON valide, sans backticks ni texte autour :
{"reply": "ta réponse",
 "reco": null ou {"topic": "...", "angle": "...", "hook": "...", "cta": "...", "rationale": "...", "objective": "...", "postType": "simple|carrousel|video"},
 "note": null ou "synthèse cumulée de toutes les orientations stratégiques données (500 caractères maximum)",
 "remember": []}

Règles :
- "reco" : UNIQUEMENT si une piste est sélectionnée ET que le message demande clairement un changement. Renvoie alors la piste COMPLÈTE modifiée (tous les champs), en gardant tel quel ce que la demande ne touche pas. Sinon null. Ne change jamais le pilier. N'invente aucun fait, chiffre ou nom de client présenté comme réel : formule tout exemple comme un cas type. La justification ("rationale") reste en une à deux phrases et explique pourquoi cette piste, ainsi modifiée, est pertinente pour CE client.
- "note" : seulement si la discussion fait émerger une orientation durable sur la stratégie éditoriale ; sinon null. Cumule les orientations précédentes de la note actuelle.
- "remember" : 0 à ${MAX_REMEMBER} consignes durables sur la façon d'écrire ou de choisir ses sujets, à l'impératif, ${REMEMBER_CHARS} caractères maximum (ex : « Privilégier des exemples chiffrés », « Éviter le ton provocateur »). UNIQUEMENT si le client exprime une préférence générale, ou si la même demande revient dans l'historique. Jamais pour une demande ponctuelle sur une seule piste. Ne reformule jamais une remarque déjà enregistrée.`;

export function recoBlock(reco) {
  if (!reco) return "\n\nAucune piste n'est sélectionnée : la discussion porte sur la stratégie.";
  const f = (k, v) => `\n- ${k} : ${v || "(vide)"}`;
  return `\n\nPISTE SÉLECTIONNÉE par le client (pilier : ${reco.pillar?.name ?? "aucun"}, non modifiable) :${f("topic", reco.topic)}${f("angle", reco.angle)}${f("hook", reco.hook)}${f("cta", reco.cta)}${f("rationale", reco.rationale)}${f("objective", reco.objective)}${f("postType", reco.postType)}`;
}

export function buildSystem({ user, reco, remarks, datalake = "" }) {
  const profile = userContextBlock(user) || "\n(profil peu renseigné)";
  const note = user.editorialNote ? `\nNote actuelle du copilote : ${user.editorialNote}` : "\nAucune note actuelle.";
  const known = remarks?.length
    ? `\n\nRemarques déjà enregistrées par le client (ne les reformule pas) :\n${remarks.map((r, i) => `  ${i + 1}. ${r.text}`).join("\n")}`
    : "";
  const lake = datalake ? `\n\nCe que le client a déposé dans son datalake éditorial (documents, éléments de langage) : appuie-toi dessus, n'invente rien de plus :${datalake}` : "";
  return `${SYSTEM_PROMPT}\n\nProfil du client :${profile}${note}${known}${lake}${recoBlock(reco)}`;
}

// Historique → messages du modèle : commence par un message du client, texte borné
export function historyToMessages(history, message) {
  const msgs = history.slice(-HISTORY_FOR_MODEL).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content ?? "").slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  msgs.push({ role: "user", content: message });
  return msgs;
}

const clip = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// Réponse du modèle → { reply, reco, note, remember } bornés ; lève si le JSON est illisible
export function parseChatOutput(raw) {
  const match = String(raw ?? "").match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Réponse IA non parsable");
  const o = JSON.parse(match[0]);
  const reply = clip(o.reply, 1200);
  if (!reply) throw new Error("Réponse IA vide");
  const note = o.note ? clip(o.note, 500) : null;
  const remember = [...new Set((Array.isArray(o.remember) ? o.remember : []).map((t) => clip(t, REMEMBER_CHARS)).filter((t) => t.length >= 8))].slice(0, MAX_REMEMBER);
  return { reply, reco: o.reco && typeof o.reco === "object" ? o.reco : null, note, remember };
}

// Modification proposée → champs réellement changés par rapport à la piste actuelle (ou null).
// `allowEmpty` : pour une restauration, hook et CTA peuvent redevenir vides.
export function sanitizeRecoPatch(raw, current, { allowEmpty = false } = {}) {
  if (!raw || typeof raw !== "object") return null;
  const patch = {};
  for (const [k, max] of Object.entries(RECO_FIELDS)) {
    if (!(k in raw)) continue;
    const v = raw[k] == null ? "" : clip(raw[k], max);
    if (!v) {
      if (allowEmpty && ["hook", "cta", "objective"].includes(k) && (current[k] ?? "") !== "") patch[k] = null;
      continue; // sujet, angle et justification ne sont jamais vidés
    }
    if (v !== (current[k] ?? "")) patch[k] = v;
  }
  if (raw.postType && POST_TYPES.includes(raw.postType) && raw.postType !== current.postType) patch.postType = raw.postType;
  return Object.keys(patch).length ? patch : null;
}

// Un échange avec le modèle (une relance si le JSON est illisible)
export async function chatTurn({ user, history, message, reco, remarks, datalake = "" }) {
  const body = {
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 900,
    system: buildSystem({ user, reco, remarks, datalake }),
    messages: historyToMessages(history, message),
  };
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("API Claude indisponible (" + res.status + ")");
    const data = await res.json();
    try {
      return { ...parseChatOutput(data.content?.[0]?.text), usage: data.usage };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}
