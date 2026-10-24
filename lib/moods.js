// Humeur éditoriale d'un post : influence l'angle, le rythme et le vocabulaire, pas le sujet.
// PUR : navigateur et serveur. Aucune humeur = comportement historique (prompt inchangé).

export const MOODS = [
  { code: "fierte", sample: "Le contrat est signé.\n\nIl y a un an, ce client ne nous connaissait pas. Aujourd'hui, il nous confie un projet de trois ans. Merci à ceux qui ont cru au projet, un par un.\n\nEt vous, quelle est la dernière étape dont vous êtes fier ?", example: "Le contrat est signé. Merci à ceux qui ont cru au projet.", emoji: "🏆", label: "Fierté", hint: "assumé, victoire, étape franchie",
    brief: "fier : une étape franchie ou un résultat obtenu, raconté avec assurance et sans arrogance, en remerciant ceux qui ont contribué" },
  { code: "coup-de-gueule", sample: "45 jours de retard sur une facture. Pas par mauvaise foi, juste parce que personne ne relance.\n\nMa règle depuis ce mois-ci : acompte à la commande, rappel à J+7. Fini les mails gênés.\n\nEt vous, vous relancez comment ?", example: "45 jours de retard sur une facture, ça suffit. Voici ma règle.", emoji: "😤", label: "Coup de gueule", hint: "franc, tranché, indigné mais argumenté",
    brief: "un coup de gueule : prise de position tranchée et assumée sur un sujet qui agace, phrases courtes et percutantes, ton direct ; reste argumenté, jamais insultant, ne vise ni personne ni entreprise nommément" },
  { code: "inspire", sample: "Et si on construisait l'entreprise qu'on aurait aimé avoir comme client ?\n\nPas un slogan : une façon de répondre vite, de dire non quand il le faut, et de tenir ses promesses.\n\nPar quoi commenceriez-vous ?", example: "Et si on construisait l'entreprise qu'on aurait aimé avoir comme client ?", emoji: "✨", label: "Inspiré", hint: "visionnaire, motivant",
    brief: "inspiré et motivant : vision, élan, conviction qui donne envie d'agir ; images concrètes plutôt que slogans" },
  { code: "humour", sample: "Mon agenda m'a dit « tu as le temps ». Mon agenda a menti.\n\nRésultat : trois rendez-vous, un café froid et une liste de tâches qui a pris de l'avance sur moi.\n\nVous aussi, vous croyez encore aux journées de huit heures ?", example: "Mon agenda m'a dit « tu as le temps ». Mon agenda a menti.", emoji: "😄", label: "Humour", hint: "léger, autodérision",
    brief: "plein d'humour : légèreté, autodérision, une chute ou un décalage, sans perdre le message professionnel" },
  { code: "stress", sample: "Gros rendez-vous demain, et je ne vais pas faire semblant d'être serein.\n\nCe qui m'aide : préparer trois questions plutôt que cent réponses, et dormir.\n\nEt vous, comment vous préparez-vous quand l'enjeu est grand ?", example: "Gros rendez-vous demain, et je ne vais pas faire semblant d'être serein.", emoji: "😰", label: "Stress", hint: "vulnérable, honnête sur la pression",
    brief: "stressé et vulnérable : l'auteur parle honnêtement de la pression ou de l'incertitude qu'il traverse, sans dramatiser ; sincérité, rythme un peu haché, et une ouverture constructive en fin de post" },
  { code: "nostalgie", sample: "Il y a cinq ans, je lançais mon activité sur la table de ma cuisine.\n\nPremier client, premier devis écrit à la main, première erreur. Je les referais tous.\n\nQu'est-ce que vous referiez sans hésiter ?", example: "Il y a cinq ans, je lançais mon activité sur la table de ma cuisine.", emoji: "🌅", label: "Nostalgie", hint: "rétrospectif, souvenirs, chemin parcouru",
    brief: "nostalgique et rétrospectif : un regard sur le chemin parcouru, un souvenir marquant et ce qu'il enseigne aujourd'hui" },
  { code: "gratitude", sample: "Merci à ceux qui m'ont fait confiance cette année, un par un.\n\nÀ celle qui a signé sans devis détaillé. À celui qui m'a recommandée sans que je le demande.\n\nQui avez-vous envie de remercier aujourd'hui ?", example: "Merci à ceux qui m'ont fait confiance cette année, un par un.", emoji: "🙏", label: "Gratitude", hint: "reconnaissant, remerciements sincères",
    brief: "reconnaissant : remercier sincèrement des personnes précises pour ce qu'elles ont apporté, avec des détails concrets plutôt que des formules, sans en faire trop" },
  { code: "doute", sample: "Faut-il accepter ce gros contrat qui me prendrait tout mon temps ?\n\nJe pèse le pour et le contre, et je n'ai pas encore la réponse.\n\nVous auriez fait quoi, à ma place ?", example: "Faut-il accepter ce gros contrat qui me prendrait tout mon temps ?", emoji: "🤔", label: "Doute", hint: "questionnement, remise en cause",
    brief: "hésitant et réflexif : l'auteur se pose des questions, remet en cause une certitude, invite l'audience à donner son avis" },
  { code: "calme", sample: "Une journée sans urgence. J'en profite pour remettre de l'ordre dans mes priorités.\n\nTrois choses, pas une de plus. Le reste attendra, et ce n'est pas grave.\n\nEt vous, qu'est-ce que vous remettez à plat en ce moment ?", example: "Une journée sans urgence. J'en profite pour remettre de l'ordre dans mes priorités.", emoji: "🌿", label: "Calme", hint: "posé, apaisé, sans urgence",
    brief: "calme et posé : un ton apaisé, des phrases simples et aérées, un regard tranquille sur le sujet, sans urgence ni dramatisation" },
  { code: "joie", legacy: true, example: "Un client vient de nous faire confiance pour trois ans. Merci.", emoji: "🥳", label: "Joie", hint: "enthousiaste, énergie positive, gratitude, célébration",
    brief: "joyeux et enthousiaste : énergie positive, gratitude, envie de partager une bonne nouvelle ; phrases vives, exclamations rares mais sincères" },
  { code: "frustration", legacy: true, example: "Troisième relance pour la même facture. Il doit y avoir une meilleure méthode.", emoji: "😩", label: "Frustration", hint: "lassitude, ras-le-bol constructif",
    brief: "frustré : un ras-le-bol sincère face à une situation récurrente, exprimé avec franchise puis transformé en piste d'amélioration concrète" },
];

// Humeurs proposées à l'écran (les anciennes restent comprises pour les posts et campagnes déjà créés)
export const MOOD_CHOICES = MOODS.filter((m) => !m.legacy);

// Actualités du moment : de quoi la vie professionnelle est faite un jour donné. Chacune propose un point de départ et une humeur
// (modifiables) : on peut célébrer une victoire comme râler parce qu'une facture n'est toujours pas réglée.
export const NEWS_STARTERS = [
  { code: "contrat", label: "Un contrat signé", theme: "Je viens de signer un nouveau contrat.", mood: "fierte" },
  { code: "client", label: "Un client satisfait", theme: "Un client vient de me dire merci pour notre travail.", mood: "gratitude" },
  { code: "facture", label: "Une facture impayée", theme: "Une facture est toujours impayée malgré mes relances.", mood: "coup-de-gueule" },
  { code: "salon", label: "Un salon ou un événement", theme: "Je participe à un salon ou à un événement professionnel.", mood: "inspire" },
  { code: "echec", label: "Un échec instructif", theme: "Un projet n'a pas marché comme prévu : voici ce que j'en retiens.", mood: "doute" },
  { code: "rdv", label: "Un gros rendez-vous", theme: "J'ai un rendez-vous important qui approche.", mood: "stress" },
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
