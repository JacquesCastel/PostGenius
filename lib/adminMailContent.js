// Envoi manuel d'un e-mail depuis l'Administration : validation du message libre (pur, testable).
export const MAX_SUBJECT = 120;
export const MAX_BODY = 3000;
export const MAX_PARAGRAPHS = 12;
export const TEMPLATES = ["leads", "custom"];

// Message libre : objet et corps en texte simple ; les paragraphes sont séparés par une ligne vide. Aucun HTML n'est accepté (échappé à l'envoi).
export function cleanCustom({ subject, body } = {}) {
  const s = String(subject ?? "").replace(/\s+/g, " ").trim();
  const b = String(body ?? "").replace(/\r\n?/g, "\n").trim();
  if (!s) return { error: "Indiquez l'objet du message." };
  if (s.length > MAX_SUBJECT) return { error: `L'objet est trop long (${MAX_SUBJECT} caractères au maximum).` };
  if (!b) return { error: "Le message est vide." };
  if (b.length > MAX_BODY) return { error: `Le message est trop long (${MAX_BODY} caractères au maximum).` };
  const paragraphs = b.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > MAX_PARAGRAPHS) return { error: `Trop de paragraphes (${MAX_PARAGRAPHS} au maximum).` };
  return { subject: s, paragraphs };
}
