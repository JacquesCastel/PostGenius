import { knowledgeFor } from "./knowledge";
import { elementsFor } from "./languageStore";
import { languageBlock } from "./languageElements";

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
