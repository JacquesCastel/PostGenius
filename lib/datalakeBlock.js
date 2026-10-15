import { knowledgeFor } from "./knowledge";
import { elementsFor } from "./languageStore";
import { languageBlock } from "./languageElements";
import { styleExamplesFor } from "./styleCorpus";
import { memoryFor } from "./postMemory";
import { prisma } from "./db";

// Datalake de l'entreprise principale sous forme de bloc de prompt, pour le copilote (recommandations, chat) :
// sources les plus proches du sujet (par le sens et par les mots) + éléments de langage validés. Jamais bloquant.
export async function datalakeBlockFor(userId, topic, contextId = null) {
  try {
    const [k, els] = await Promise.all([knowledgeFor(userId, topic, contextId), elementsFor(userId, contextId)]);
    return `${k.block}${languageBlock(els)}`;
  } catch (e) {
    console.error("[datalake] bloc du copilote indisponible :", e.message);
    return "";
  }
}

// Ce que l'auteur a déposé, sous forme de bloc de prompt pour les générateurs secondaires (post d'événement, réécriture,
// réponse à un commentaire) : sources proches du sujet, éléments de langage, exemples de voix et, si demandé, mémoire
// éditoriale (ce qu'il a déjà dit). Mêmes sélections que la génération d'un post. Jamais bloquant : vide en cas d'échec.
export async function authorBlockFor(userId, topic, { contextId = null, memory = false } = {}) {
  if (!userId) return "";
  try {
    const [datalake, mem, fixed] = await Promise.all([
      datalakeBlockFor(userId, topic, contextId),
      memory ? memoryFor(userId, topic, { contextId }) : Promise.resolve({ block: "" }),
      prisma.user.findUnique({ where: { id: userId }, select: { styleExamples: true } }).catch(() => null),
    ]);
    const style = await styleExamplesFor(userId, topic, fixed?.styleExamples);
    return `${style}${datalake}${mem.block}`;
  } catch (e) {
    console.error("[datalake] bloc de l'auteur indisponible :", e.message);
    return "";
  }
}
