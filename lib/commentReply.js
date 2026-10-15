import { publishVoiceBlock, isOrgUrn } from "./publishVoice";
import { remarksPromptBlock } from "./remarks";

// Réponse assistée à un commentaire reçu : trois variantes courtes dans la voix de l'auteur, jamais envoyées sans son clic.

export const REPLY_COUNT = 3;
export const REPLY_MAX_CHARS = 600; // LinkedIn accepte 1250 ; une réponse de commentaire reste brève
const clip = (t, n) => String(t ?? "").replace(/[ \t]+/g, " ").trim().slice(0, n);

export function buildReplyPrompt({ postText, commentText, target, profile, pageName, remarks }) {
  const voice = publishVoiceBlock(isOrgUrn(target) ? "org" : "person", pageName, profile?.styleNotes);
  const who = [profile?.headline && `titre : ${clip(profile.headline, 120)}`, profile?.tone && `ton : ${clip(profile.tone, 60)}`, profile?.styleNotes && `consignes de style : ${clip(profile.styleNotes, 300)}`].filter(Boolean).join(" ; ");
  return `Tu aides l'auteur d'un post LinkedIn à répondre à un commentaire reçu.${who ? `\nAuteur — ${who}.` : ""}${voice}${remarksPromptBlock(remarks)}

POST (extrait) :
"""
${clip(postText, 1200)}
"""

COMMENTAIRE reçu (l'identité de son auteur n'est pas communiquée) :
"""
${clip(commentText, 800)}
"""

Écris ${REPLY_COUNT} réponses différentes (angles distincts : remercier et prolonger, poser une question, apporter une précision). Règles :
- ${REPLY_MAX_CHARS} caractères maximum chacune, 1 à 3 phrases, naturelles, sans formule creuse ;
- ne pas s'adresser à la personne par son nom : on ne le connaît pas ;
- n'invente aucun fait, chiffre, client ou engagement ; ne promets rien ;
- pas de hashtags, pas d'émojis sauf si les consignes de style en demandent.

Réponds UNIQUEMENT en JSON : {"replies": ["…", "…", "…"]}`;
}

// Sortie du modèle → tableau de réponses nettoyées, bornées, sans doublon
export function cleanReplies(o) {
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(o?.replies) ? o.replies : []) {
    const t = clip(r, REPLY_MAX_CHARS);
    const k = t.toLowerCase();
    if (t.length < 2 || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= REPLY_COUNT) break;
  }
  return out;
}
