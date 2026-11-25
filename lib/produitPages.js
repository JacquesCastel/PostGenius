// Valeurs chiffrées écrites en toutes lettres dans les pages Produit. scripts/produit-pages.test.mjs vérifie qu'elles
// correspondent toujours au code (langues, seuils, plafonds) : si le code change, le test échoue avant que le site ne mente.
export const MOTS = {
  langues: "Neuf", // lib/languages.js : LANGUAGES.length
  seuilCoach: "huit", // lib/coach.js : MIN_MEASURED
  maxChiffres: "six", // lib/figureCheck.js : figuresToCheck(…, max = 6)
  minModifies: "trois", // lib/editLearning.js : MIN_MODIFIED
};
