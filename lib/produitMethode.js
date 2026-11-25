// Contenu de /produit/methode. Chaque phrase renvoie à une ligne de docs/site/fonctionnement-faits-verifies.md (règle : on n'invente rien).
// Les étiquettes « En test » (ETAT_TEST) reflètent la production au 12 novembre 2026 : le compagnon éditorial (analyse du brief, relecture
// indépendante) est activé sur le serveur mais réservé à des comptes sélectionnés. À retirer quand le périmètre passe à tous les comptes.
import { MOTS } from "./produitPages.js";

export const ETAT_TEST = "En test auprès de comptes sélectionnés";

export const MATIERE = [
  ["IA", "Lit chaque source et en tire un résumé, des thèmes, un vocabulaire, des positions et des faits."],
  ["Code", "Ne garde un fait que si tous ses nombres figurent dans le texte de la source. Un chiffre que l'IA aurait ajouté est écarté."],
  ["Vous", "Le moteur résume ce qu'il a appris de vous et vous l'affinez par échange. Rien n'est retenu sans votre accord, y compris vos mots à privilégier ou à éviter."],
];
export const REGLES_IA = [
  "Ne jamais inventer de nom, de chiffre, de statistique ou de fait présenté comme réel. À défaut d'information, formuler en termes généraux ou comme un cas type annoncé comme tel.",
  "Reprendre les chiffres de vos sources tels quels, sans les arrondir ni les déformer.",
  "Si deux informations se contredisent, n'en affirmer aucune comme établie.",
];
export const CONTROLES_ETAPES = [
  { quand: "Avant l'écriture", titre: "Le brief est-il écrivable honnêtement ?", acteurs: ["IA", "Code"], test: true,
    texte: "Si votre sujet contient des faits, un conseiller lit le brief. Il dit : prêt, il manque une information essentielle (trois questions au plus), ou deux affirmations se contredisent.", fort: "Le statut est calculé par le code, pas par l'IA." },
  { quand: "Pendant l'écriture", titre: "Les règles sont dans la consigne", acteurs: ["IA"],
    texte: "L'IA écrit avec vos sources et les règles ci-dessus.", fort: "Rien ne contrôle le texte pendant qu'il s'écrit", suite: " : le contrôle vient juste après." },
  { quand: "Après l'écriture", titre: "Les chiffres sont comparés à vos informations", acteurs: ["Code"], lien: ["/produit/verification", "Ce que ce contrôle vérifie, et ce qu'il ne vérifie pas"],
    texte: "Les nombres du post absents de ce que vous avez fourni sont signalés, avec leur unité." },
];
export const CONTROLES_APRES = [
  { titre: "La mise en forme est notée", acteurs: ["Code"], lien: ["/scoring", "Voir le contrôle de forme"], suite: " Inclus à partir de l'offre Pro.",
    texte: "Sept critères à règles fixes : accroche, longueur, aération, question, hashtags, format, émojis, appel à l'action." },
  { titre: "Une relecture indépendante, à la demande", acteurs: ["IA"], test: true,
    texte: "Un second modèle reçoit le brief, votre profil, vos sources et le texte, **sans** le raisonnement de rédaction. Il cite le passage exact de chaque ajout à confirmer. C'est un avis, pas une preuve." },
  { titre: "Dans une campagne : vos règles sont vérifiées", acteurs: ["Code", "IA"],
    texte: "Zéro émoji, nombre maximal de hashtags, termes interdits, lien exact. En cas d'écart, corrections sûres appliquées, puis **une seule** nouvelle rédaction. Les autres écarts vous sont signalés." },
];
export const CONSIGNES_TEXTE = "Après l'écriture, le code relit vos consignes et vérifie le texte affiché sur sept points explicites. Pour un post de page, la voix de la marque est lue en premier et l'emporte sur vos consignes personnelles. Un écart est montré sous le post ; **le texte n'est ni corrigé ni réécrit à votre place**.";
export const CONSIGNES_POINTS = ["Zéro émoji", "Hashtags au maximum", "Mots à éviter", "Longueur maximale", "Tutoiement ou vouvoiement", "Terminer par une question", "Voix de la marque, pour une page"];
export const CONSIGNES_LIMITE = "Une consigne ambiguë ou conditionnelle (« trois hashtags », « tutoiement seulement sur les posts personnels ») n'est pas contrôlée : aucune règle n'est devinée. Le ton, l'angle et le style sont transmis à l'IA, sans contrôle ensuite.";
export const GESTES = [
  ["Confirmer", "C'est exact. Aucune source indépendante n'a vérifié ce point : c'est dit."],
  ["Modifier", "Vous corrigez le passage dans l'éditeur."],
  ["Reformuler prudemment", "Une proposition que vous acceptez ou refusez."],
  ["Retirer", "Vous enlevez l'affirmation."],
  ["Garder tel quel", "Décision explicite et réversible."],
];
export const ACCOMPAGNEMENT = [
  ["Le copilote éditorial", "Propose des pistes de sujet, avec un angle et une justification, à partir de votre profil, de vos piliers éditoriaux, de votre historique et de votre base de connaissances. Il ne rédige pas : vous envoyez la piste au moteur d'écriture."],
  ["Le coach", `Compare vos posts mesurés à votre médiane, avec le nombre de posts et un niveau de confiance. Avant ${MOTS.seuilCoach} posts mesurés, il ne dit rien. Il ne prétend pas deviner l'algorithme de LinkedIn.`],
  ["Vos habitudes d'édition", `Après au moins ${MOTS.minModifies} posts que vous avez modifiés, il propose des consignes durables, avec la preuve calculée sur vos propres textes. Vous acceptez ou non.`],
];
export const GESTION = [
  ["Piliers éditoriaux", "Des catégories de contenu que vous renommez librement, pour équilibrer les pistes proposées."],
  ["Créneaux de publication", `Proposés à partir de vos mesures réelles, jamais avant ${MOTS.seuilCoach} posts mesurés. Vous adoptez d'un clic, ou vous ignorez.`],
  ["Campagnes", "Un document devient un brief que vous relisez avant de créer la campagne, puis un plan et un calendrier. Les règles du brief sont contrôlées sur chaque texte.", "Pro et Agence"],
];
export const LIMITES = [
  "Il ne garantit pas qu'un chiffre est exact : il signale ceux qui sont absents de vos informations.",
  "Il ne contrôle ni les noms propres, ni les citations, ni les études citées.",
  "Il ne contrôle par code que des consignes explicites (émojis, hashtags, mots à éviter, longueur, tutoiement ou vouvoiement, question finale, voix d'une page) : ton, angle et style ne sont pas vérifiés après l'écriture.",
  "Il ne cite pas ses sources dans le texte du post.",
  "La relecture indépendante est l'avis d'un second modèle, pas une preuve.",
  "Il ne prédit ni vues, ni réactions.",
];
