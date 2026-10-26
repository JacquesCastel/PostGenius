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

// URN de commentaire sous sa forme canonique urn:li:comment:(urn:li:activity:123,456).
// LinkedIn renvoie parfois « urn:li:comment:(activity:123, 456) » (sans le préfixe urn:li:, avec une espace) : on accepte les deux.
export function normalizeCommentUrn(input) {
  const m = /^urn:li:comment:\(\s*(?:urn:li:)?(activity|share|ugcPost):(\d+)\s*,\s*(\d+)\s*\)$/.exec(String(input ?? "").trim());
  return m ? `urn:li:comment:(urn:li:${m[1]}:${m[2]},${m[3]})` : null;
}

// Lien d'un commentaire copié dans LinkedIn (« … » → « Copier le lien ») → URN canonique du commentaire, ou null.
// Formes reconnues : ?commentUrn=urn:li:comment:(activity:123,456) (encodé ou non), ?dashCommentUrn=urn:li:fsd_comment:(456,urn:li:activity:123),
// ou l'URN brut. Une réponse à un commentaire (?replyUrn=…) se rattache au commentaire de premier niveau (commentUrn).
export function parseCommentLink(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const direct = normalizeCommentUrn(raw);
  if (direct) return direct;
  let decoded = raw;
  for (let i = 0; i < 2; i++) { try { decoded = decodeURIComponent(decoded); } catch { break; } }
  let q = null;
  try { q = new URL(raw).searchParams; } catch {}
  const fromParam = q ? normalizeCommentUrn(q.get("commentUrn")) : null;
  if (fromParam) return fromParam;
  const m = /urn:li:comment:\(\s*(?:urn:li:)?(activity|share|ugcPost):(\d+)\s*,\s*(\d+)\s*\)/.exec(decoded);
  if (m) return `urn:li:comment:(urn:li:${m[1]}:${m[2]},${m[3]})`;
  const d = /fsd_comment:\(\s*(\d+)\s*,\s*urn:li:(activity|share|ugcPost):(\d+)\s*\)/.exec(decoded);
  if (d) return `urn:li:comment:(urn:li:${d[2]}:${d[3]},${d[1]})`;
  return null;
}
