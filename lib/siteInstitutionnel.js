// Pages institutionnelles du nouveau site : /a-propos et /legal. Elles engagent l'éditeur (identité, responsabilité) :
// elles ne s'ouvrent que si l'interrupteur est posé ET si plus aucun champ à compléter ne reste (sinon 404, même interrupteur posé).
export const MARQUEUR_A_COMPLETER = /\[\s*À COMPLÉTER|À compléter/i;

export const aProposOuvert = (env = process.env, manquants = []) => env?.SITE_APROPOS === "1" && manquants.length === 0;
export const legalOuvert = (env = process.env, textes = []) => env?.SITE_LEGAL === "1" && !textes.some((t) => MARQUEUR_A_COMPLETER.test(String(t ?? "")));
export const textesALegalCompleter = (textes = []) => textes.filter((t) => MARQUEUR_A_COMPLETER.test(String(t ?? ""))).length;
