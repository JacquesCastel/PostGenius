// Contenus spéciaux d'un post LinkedIn : sondage et carrousel PDF (document). Nettoyage commun au serveur.
export const POLL_DURATIONS = { ONE_DAY: "24 heures", THREE_DAYS: "3 jours", SEVEN_DAYS: "7 jours", FOURTEEN_DAYS: "14 jours" };
export const POLL_QUESTION_MAX = 140; // limites de LinkedIn
export const POLL_OPTION_MAX = 30;
export const MAX_SLIDES = 20;

const one = (t, n) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);

// { question, options: [2 à 4 textes], duration } ou null si le sondage est vide ou incomplet
export function cleanPoll(raw) {
  let p = raw;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { return null; } }
  const question = one(p?.question, POLL_QUESTION_MAX);
  const options = (Array.isArray(p?.options) ? p.options : []).map((o) => one(o, POLL_OPTION_MAX)).filter(Boolean).filter((o, i, a) => a.indexOf(o) === i).slice(0, 4);
  if (!question || options.length < 2) return null;
  return { question, options, duration: POLL_DURATIONS[p?.duration] ? p.duration : "THREE_DAYS" };
}

// Messages à afficher quand un sondage est incomplet (null = valable)
export function pollProblem(raw) {
  let p = raw;
  if (typeof p === "string") { try { p = JSON.parse(p); } catch { return "Sondage illisible."; } }
  if (!one(p?.question, 1)) return "Le sondage a besoin d'une question.";
  const n = (Array.isArray(p?.options) ? p.options : []).map((o) => one(o, POLL_OPTION_MAX)).filter(Boolean).length;
  return n < 2 ? "Le sondage a besoin d'au moins 2 réponses." : null;
}

const SLIDE_URL = /^\/api\/images\/[a-f0-9]{16}\.png$/;
// Adresses des images d'un carrousel (celles de notre stockage uniquement), dans l'ordre ; [] si rien de valable
export function cleanSlides(raw) {
  let a = raw;
  if (typeof a === "string") { try { a = JSON.parse(a); } catch { return []; } }
  return (Array.isArray(a) ? a : []).filter((u) => typeof u === "string" && SLIDE_URL.test(u)).slice(0, MAX_SLIDES);
}
