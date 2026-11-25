// Typographie française des titres : les coupures de ligne ne doivent pas séparer ce qui va ensemble.
// Pur : aucune dépendance. Utilisé pour les titres du nouveau style (gabarit v2), statiques ou venant de la base (titres d'articles).
//   - un mot de trois lettres ou moins (« de », « la », « une », « que », « pas »…) reste lié au mot qui le suit ;
//   - pas de ligne qui commence par « : ; ? ! » ou par un guillemet fermant ; le guillemet ouvrant reste lié au mot suivant ;
//   - quelques expressions ne se coupent pas (« mise en forme », « ne mesure pas »…) ;
//   - les deux derniers mots d'un titre ne se séparent pas : jamais un mot seul sur la dernière ligne.
export const NB = " ";

const EXPRESSIONS = ["mise en forme", "pas une prédiction", "ne mesure pas", "ne dit pas", "ne prouve pas", "ne fait pas", "rien de plus", "à chaque étape", "étape par étape", "noir sur blanc"];
const COURT = /(?<![\p{L}'’])(\p{L}{1,3})[  ](?=[\p{L}«\[(])/gu;

export function liaisons(texte, { fin = true } = {}) {
  let t = String(texte ?? "");
  for (const e of EXPRESSIONS) t = t.split(e).join(e.split(" ").join(NB));
  t = t.replace(COURT, `$1${NB}`);
  t = t.replace(/ ([:;?!»])/g, `${NB}$1`).replace(/« /g, `«${NB}`);
  if (fin) t = t.replace(/ (\S+)\s*$/u, `${NB}$1`);
  return t;
}
