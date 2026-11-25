// Typographie française des titres : les coupures de ligne ne doivent pas séparer ce qui va ensemble.
// Pur : aucune dépendance. Utilisé pour les titres du nouveau style (gabarit v2), statiques ou venant de la base (titres d'articles).
//   - un mot de trois lettres ou moins (« de », « la », « une », « que », « pas »…) reste lié au mot qui le suit ;
//   - pas de ligne qui commence par « : ; ? ! » ou par un guillemet fermant ; le guillemet ouvrant reste lié au mot suivant ;
//   - quelques expressions ne se coupent pas (« mise en forme », « ne mesure pas »…) ;
//   - les deux derniers mots d'un titre ne se séparent pas : jamais un mot seul sur la dernière ligne ;
//   - mais jamais un bloc insécable trop long (par défaut plus de 18 caractères) : il déborderait d'une colonne étroite.
//     Un bloc trop long est coupé à l'endroit qui équilibre le mieux ses deux moitiés (et laisse au moins deux mots à droite).
export const NB = " ";

const EXPRESSIONS = ["mise en forme", "pas une prédiction", "ne mesure pas", "ne dit pas", "ne prouve pas", "ne fait pas", "rien de plus", "à chaque étape", "étape par étape", "noir sur blanc"];
const nu = (t) => t.replace(/[,.;:!?»«]+$/u, "").toLowerCase();

function decouper(run, max) {
  // run : { mots: [...], mous: [bool entre deux mots] } ; coupe aux liaisons « molles » seulement
  const longueur = (m) => m.join(" ").replace(/[.,;:!?»]+$/u, "").length; // la ponctuation finale ne compte pas
  if (run.mots.length < 2 || longueur(run.mots) <= max) return [run];
  const choix = [];
  for (let j = 0; j < run.mous.length; j++) if (run.mous[j]) choix.push(j);
  if (!choix.length) return [run];
  const score = (j) => Math.max(longueur(run.mots.slice(0, j + 1)), longueur(run.mots.slice(j + 1)));
  const deuxMots = choix.filter((j) => run.mots.length - (j + 1) >= 2);
  const parmi = run.mots.length >= 3 && deuxMots.length ? deuxMots : choix;
  const j = parmi.reduce((a, b) => (score(b) < score(a) ? b : a));
  const gauche = { mots: run.mots.slice(0, j + 1), mous: run.mous.slice(0, j) };
  const droite = { mots: run.mots.slice(j + 1), mous: run.mous.slice(j + 1) };
  return [...decouper(gauche, max), ...decouper(droite, max)];
}

export function liaisons(texte, { fin = true, max = 18 } = {}) {
  const src = String(texte ?? "").replace(/ /g, " ").trim();
  const mots = src.split(/ +/).filter(Boolean);
  if (mots.length < 2) return src;
  const n = mots.length;
  const dur = Array(n - 1).fill(false); // ponctuation haute, guillemets : jamais coupés
  const mou = Array(n - 1).fill(false); // mots courts, expressions, fin de titre : coupés seulement si le bloc est trop long
  for (let i = 0; i < n - 1; i++) {
    const suivant = mots[i + 1];
    if (/^[:;?!»]/u.test(suivant) || /«$/u.test(mots[i])) dur[i] = true;
    else if (/^\p{L}{1,3}$/u.test(mots[i]) && /^[\p{L}«\[(]/u.test(suivant)) mou[i] = true;
  }
  for (const e of EXPRESSIONS) {
    const ew = e.split(" ");
    for (let i = 0; i + ew.length <= n; i++) {
      if (ew.every((w, k) => nu(mots[i + k]) === w)) for (let k = 0; k < ew.length - 1; k++) if (!dur[i + k]) mou[i + k] = true;
    }
  }
  if (fin && !dur[n - 2]) mou[n - 2] = true;
  // blocs : suites de mots liés (durement ou mollement)
  const blocs = []; let courant = { mots: [mots[0]], mous: [] };
  for (let i = 0; i < n - 1; i++) {
    if (dur[i] || mou[i]) { courant.mots.push(mots[i + 1]); courant.mous.push(!dur[i]); }
    else { blocs.push(courant); courant = { mots: [mots[i + 1]], mous: [] }; }
  }
  blocs.push(courant);
  return blocs.flatMap((b) => decouper(b, max)).map((b) => b.mots.join(NB)).join(" ");
}

// Titre en deux morceaux (début ordinaire + fin mise en valeur par <em>) : les liaisons sont calculées sur la phrase entière,
// puis le résultat est coupé à la frontière. Renvoie [début (avec son séparateur final), fin] ; à afficher `{début}<em>{fin}</em>`.
export function liaisonsEm(debut, accent, options) {
  const nAccent = String(accent ?? "").trim().split(/ +/).filter(Boolean).length;
  const complet = liaisons(`${String(debut ?? "").trim()} ${String(accent ?? "").trim()}`, options);
  const parts = complet.split(/([ \u00a0])/); // mot, séparateur, mot, séparateur… (nombre impair d'éléments)
  const coupe = parts.length - (2 * nAccent - 1); // index du premier mot de l'accent
  return [parts.slice(0, coupe).join(""), parts.slice(coupe).join("")]; // le séparateur de la frontière reste à la fin du début
}
