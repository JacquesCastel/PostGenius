import { prisma } from "./db";

// Remarques de l'utilisateur pour ses futurs posts : liste visible et supprimable,
// injectée dans les prompts de génération (post manuel, pilote automatique,
// réécriture) à côté des consignes de style du profil.

export const MAX_REMARKS = 10;
export const MAX_REMARK_LENGTH = 300;

export async function getRemarks(userId) {
  if (!userId) return [];
  return prisma.postRemark.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, text: true, createdAt: true },
  });
}

// Ajoute une remarque (saisie manuelle ou suggestion acceptée). Renvoie { remark } ou
// { error, status, code } : vide, trop longue, doublon, ou limite atteinte.
export async function addRemark(userId, text) {
  const clean = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (!clean) return { error: "Remarque vide.", status: 400 };
  if (clean.length > MAX_REMARK_LENGTH) {
    return { error: `Remarque trop longue (${MAX_REMARK_LENGTH} caractères maximum).`, status: 400 };
  }
  const existing = await getRemarks(userId);
  if (existing.some((r) => r.text.toLowerCase() === clean.toLowerCase())) {
    return { error: "Cette remarque est déjà enregistrée.", status: 409, code: "duplicate" };
  }
  if (existing.length >= MAX_REMARKS) {
    return {
      error: `${MAX_REMARKS} remarques maximum : supprimez-en une dans Profil pour en ajouter une nouvelle.`,
      status: 409,
      code: "limit",
    };
  }
  const remark = await prisma.postRemark.create({
    data: { userId, text: clean },
    select: { id: true, text: true, createdAt: true },
  });
  return { remark };
}

// Bloc de prompt. Les remarques priment sur les règles d'écriture générales
// (ex : « pas d'émojis » l'emporte sur « 1 à 6 émojis »).
// Garde : l'IA ne connaît pas les vrais clients de l'auteur, elle ne doit pas inventer
// de noms, de chiffres ou de faits présentés comme réels quand une remarque demande un exemple.
export function remarksPromptBlock(remarks) {
  if (!remarks?.length) return "";
  const lines = remarks.map((r, i) => `  ${i + 1}. ${r.text.replace(/\s+/g, " ").trim()}`).join("\n");
  return `\n- Remarques de l'auteur sur ses posts (À RESPECTER ; en cas de conflit, elles priment sur les règles d'écriture générales ; tu ne connais pas les clients réels de l'auteur : n'invente jamais de nom, de chiffre ou de fait présenté comme réel, formule tout exemple comme un cas type, ex. « Prenons un transporteur… ») :\n${lines}`;
}

// Variante pour le moteur de recommandations « Que publier aujourd'hui ? » : il choisit
// des sujets, angles, accroches et appels à l'action, il n'écrit pas de post. Les remarques
// sur le fond (sujets voulus ou à éviter, angle, cible) orientent donc les pistes ; celles
// qui ne portent que sur la mise en forme du texte (émojis, longueur…) ne le concernent pas.
export function remarksRecommendationsBlock(remarks) {
  if (!remarks?.length) return "";
  const lines = remarks.map((r, i) => `  ${i + 1}. ${r.text.replace(/\s+/g, " ").trim()}`).join("\n");
  return `\n\nRemarques du client sur ses posts (à respecter) :\n${lines}
Tiens-en compte pour choisir les sujets, les angles, les accroches et les appels à l'action proposés (sujets voulus, sujets à éviter, cible, ton). Ignore celles qui ne portent que sur la mise en forme du texte (émojis, longueur, phrases courtes…) : tu ne rédiges pas de post. N'invente aucun fait, nom de client ou chiffre présenté comme réel.`;
}
