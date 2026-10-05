// Humeur éditoriale d'un post : influence l'angle, le rythme et le vocabulaire, pas le sujet.
// PUR : navigateur et serveur. Aucune humeur = comportement historique (prompt inchangé).

export const MOODS = [
  { code: "joie", emoji: "🥳", label: "Joie", hint: "enthousiaste, énergie positive, gratitude, célébration",
    brief: "joyeux et enthousiaste : énergie positive, gratitude, envie de partager une bonne nouvelle ; phrases vives, exclamations rares mais sincères" },
  { code: "coup-de-gueule", emoji: "😤", label: "Coup de gueule", hint: "franc, tranché, indigné mais argumenté",
    brief: "un coup de gueule : prise de position tranchée et assumée sur un sujet qui agace, phrases courtes et percutantes, ton direct ; reste argumenté, jamais insultant, ne vise ni personne ni entreprise nommément" },
  { code: "stress", emoji: "😰", label: "Stress", hint: "vulnérable, honnête sur la pression",
    brief: "stressé et vulnérable : l'auteur parle honnêtement de la pression ou de l'incertitude qu'il traverse, sans dramatiser ; sincérité, rythme un peu haché, et une ouverture constructive en fin de post" },
  { code: "fierte", emoji: "🏆", label: "Fierté", hint: "assumé, victoire, étape franchie",
    brief: "fier : une étape franchie ou un résultat obtenu, raconté avec assurance et sans arrogance, en remerciant ceux qui ont contribué" },
  { code: "doute", emoji: "🤔", label: "Doute", hint: "questionnement, remise en cause",
    brief: "hésitant et réflexif : l'auteur se pose des questions, remet en cause une certitude, invite l'audience à donner son avis" },
  { code: "inspire", emoji: "✨", label: "Inspiré", hint: "visionnaire, motivant",
    brief: "inspiré et motivant : vision, élan, conviction qui donne envie d'agir ; images concrètes plutôt que slogans" },
  { code: "humour", emoji: "😄", label: "Humour", hint: "léger, autodérision",
    brief: "plein d'humour : légèreté, autodérision, une chute ou un décalage, sans perdre le message professionnel" },
  { code: "nostalgie", emoji: "🌅", label: "Nostalgie", hint: "rétrospectif, souvenirs, chemin parcouru",
    brief: "nostalgique et rétrospectif : un regard sur le chemin parcouru, un souvenir marquant et ce qu'il enseigne aujourd'hui" },
  { code: "frustration", emoji: "😩", label: "Frustration", hint: "lassitude, ras-le-bol constructif",
    brief: "frustré : un ras-le-bol sincère face à une situation récurrente, exprimé avec franchise puis transformé en piste d'amélioration concrète" },
];

export const isMood = (code) => MOODS.some((m) => m.code === code);
export const normalizeMood = (code) => (isMood(code) ? code : null);

// Bloc ajouté aux prompts de rédaction ; vide sans humeur.
export function moodInstruction(code) {
  const mood = MOODS.find((m) => m.code === code);
  if (!mood) return "";
  return `

HUMEUR ÉDITORIALE (À RESPECTER) : l'auteur écrit dans l'humeur « ${mood.label} » : le post est ${mood.brief}. Laisse cette humeur guider l'angle d'attaque, la construction, le rythme des phrases et le vocabulaire, sans changer la thématique ni les faits. L'émotion doit sonner vraie et rester compatible avec une image professionnelle sur LinkedIn.`;
}
