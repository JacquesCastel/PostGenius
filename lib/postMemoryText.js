// Mémoire éditoriale : ce que l'auteur a DÉJÀ dit (posts publiés, programmés ou à valider de l'entreprise).
// Alimente chaque rédaction pour assurer la continuité et éviter les répétitions. Fonctions PURES.

import { tokens } from "./knowledgeText";
import { norm } from "./campaignBrief";

export const MEMORY_RECENT = 3; // les plus récents (continuité)
export const MEMORY_RELATED = 3; // les plus proches du sujet (sens, sinon mots)
export const MEMORY_MIN_SIM = 0.4;
const EXCERPT = 320;

export function textHash(t) {
  let h = 5381;
  const s = String(t ?? "");
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return String(h);
}

const when = (p) => p.publishedAt ?? p.scheduledAt ?? p.createdAt;
const excerpt = (t) => String(t ?? "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, EXCERPT);

// posts : [{ id, text, status, target, publishedAt, scheduledAt, createdAt }] ; sims : Map id → cosinus avec le sujet (ou null)
export function pickMemory(posts, topic, sims, now = new Date()) {
  const dated = posts.filter((p) => String(p.text ?? "").trim().length > 40).sort((a, b) => new Date(when(b)) - new Date(when(a)));
  // Continuité : les plus récents déjà parus ou à venir proches ; on part de maintenant vers le passé, puis les prévus
  const recent = dated.filter((p) => new Date(when(p)) <= now).slice(0, MEMORY_RECENT);
  const rest = dated.filter((p) => !recent.includes(p));
  let related;
  if (sims) {
    related = rest.map((p) => ({ p, s: sims.get(p.id) ?? 0 })).filter((x) => x.s >= MEMORY_MIN_SIM).sort((a, b) => b.s - a.s).map((x) => x.p);
  } else {
    const q = new Set(tokens(topic));
    related = rest.map((p) => ({ p, s: tokens(p.text).filter((t) => q.has(t)).length })).filter((x) => x.s >= 2).sort((a, b) => b.s - a.s).map((x) => x.p);
  }
  return [...recent, ...related.slice(0, MEMORY_RELATED)];
}

const dayFr = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
export function memoryBlock(picked) {
  if (!picked.length) return "";
  const lines = picked.map((p) => `- ${dayFr(when(p))} · ${p.target && p.target !== "person" ? "page" : "profil"} · ${p.status === "publié" ? "publié" : "prévu"} : « ${excerpt(p.text)}${String(p.text).length > EXCERPT ? "…" : ""} »`);
  return `\n\nCE QUE L'AUTEUR A DÉJÀ DIT (posts publiés ou prévus ; mémoire éditoriale) :\n${lines.join("\n")}\nRègles d'usage : assure la continuité avec ces posts (tu peux y faire une référence légère) ; ne répète ni leur accroche, ni leur angle, ni leurs formulations ; n'en tire aucun fait nouveau.`;
}

// Première phrase (accroche) : mots significatifs, pour repérer deux posts qui commencent de la même façon
const hookWords = (t) => new Set(tokens(String(t ?? "").replace(/https?:\/\/\S+/g, "").split(/(?<=[.!?…])\s|\n/)[0] ?? "").slice(0, 14));
export function hookSimilarity(a, b) {
  const A = hookWords(a), B = hookWords(b);
  if (A.size < 3 || B.size < 3) return 0;
  let c = 0;
  for (const w of A) if (B.has(w)) c++;
  return c / Math.min(A.size, B.size);
}
export const normText = norm;
