// Identifier un post LinkedIn à partir de son adresse, pour réagir ou commenter.
// PUR : utilisé par le navigateur (vérification immédiate) et par l'API.

// Types de réaction de l'API LinkedIn (Reactions API) avec leur libellé affiché
export const REACTIONS = [
  { type: "LIKE", label: "J'aime", emoji: "👍" },
  { type: "PRAISE", label: "Bravo", emoji: "👏" },
  { type: "EMPATHY", label: "Soutien", emoji: "❤️" },
  { type: "APPRECIATION", label: "Génial", emoji: "🙌" },
  { type: "INTEREST", label: "Instructif", emoji: "💡" },
  { type: "ENTERTAINMENT", label: "Drôle", emoji: "😄" },
];
export const REACTION_TYPES = REACTIONS.map((r) => r.type);

const URN = /urn:li:(activity|share|ugcPost):(\d{10,25})/;

// Renvoie { urn } ou { error }. Formats : URN brut, /feed/update/urn:li:…/,
// /posts/nom_texte-activity-123…-xxxx (activity|share|ugcPost). Les liens courts
// (lnkd.in) ne sont pas résolus : il faut le lien complet du post.
export function parsePostUrn(input) {
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return { error: "Collez l'adresse du post LinkedIn." };

  const direct = URN.exec(raw);
  if (direct && /^urn:/.test(raw)) return { urn: direct[0] };

  let u;
  try {
    u = new URL(raw);
  } catch {
    return { error: "Adresse non reconnue. Collez le lien du post (linkedin.com/feed/update/… ou linkedin.com/posts/…)." };
  }
  const host = u.hostname.toLowerCase();
  if (host === "lnkd.in") return { error: "Lien court non pris en charge : ouvrez le post dans LinkedIn et copiez son adresse complète." };
  if (!/^https?:$/.test(u.protocol) || !(host === "linkedin.com" || host.endsWith(".linkedin.com"))) {
    return { error: "Ce n'est pas une adresse LinkedIn." };
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {}
  const inUrl = URN.exec(decoded);
  if (inUrl) return { urn: inUrl[0] };
  const slug = /-(activity|share|ugcPost)-(\d{10,25})(?:-|\/|$|\?)/.exec(u.pathname);
  if (slug) return { urn: `urn:li:${slug[1]}:${slug[2]}` };
  return { error: "Identifiant du post introuvable dans cette adresse. Utilisez « Copier le lien du post » dans LinkedIn." };
}
