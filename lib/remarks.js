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

// Bloc de prompt. Les remarques priment sur les règles d'écriture générales
// (ex : « pas d'émojis » l'emporte sur « 1 à 6 émojis »).
// Garde : l'IA ne connaît pas les vrais clients de l'auteur, elle ne doit pas inventer
// de noms, de chiffres ou de faits présentés comme réels quand une remarque demande un exemple.
export function remarksPromptBlock(remarks) {
  if (!remarks?.length) return "";
  const lines = remarks.map((r, i) => `  ${i + 1}. ${r.text.replace(/\s+/g, " ").trim()}`).join("\n");
  return `\n- Remarques de l'auteur sur ses posts (À RESPECTER ; en cas de conflit, elles priment sur les règles d'écriture générales ; tu ne connais pas les clients réels de l'auteur : n'invente jamais de nom, de chiffre ou de fait présenté comme réel, formule tout exemple comme un cas type, ex. « Prenons un transporteur… ») :\n${lines}`;
}
