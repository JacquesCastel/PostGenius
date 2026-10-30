// Contenu éditable des pages de pied de page (CGU, confidentialité, mentions légales).
// Stocké dans SiteContent avec des clés "page-cgu", "page-confidentialite", "page-mentions-legales".
// getFooterPage(key) lit depuis la DB et fusionne sur les défauts.

import { prisma } from "./db";
import { memo, MEMO_TTL } from "./memoCache";

export const FOOTER_PAGE_KEYS = ["cgu", "confidentialite", "mentions-legales", "securite"];

export const FOOTER_PAGE_LABELS = {
  "cgu": "Conditions générales d'utilisation",
  "confidentialite": "Politique de confidentialité",
  "mentions-legales": "Mentions légales",
  "securite": "Sécurité et confidentialité",
};

export const FOOTER_PAGE_DEFAULTS = {
  "cgu": {
    title: "Conditions générales d'utilisation",
    sections: [
      {
        heading: "1. Objet",
        body: "LinkeePost est un service SaaS d'aide à la création et à la gestion de campagnes de publication LinkedIn : génération de contenus assistée par IA, programmation, publication via l'API officielle LinkedIn et statistiques.",
      },
      {
        heading: "2. Compte et essai",
        body: "L'inscription est ouverte aux professionnels. L'essai gratuit dure 14 jours, sans engagement ni carte bancaire. Au-delà, l'accès aux fonctionnalités nécessite un abonnement payant, résiliable à tout moment avec effet en fin de période.",
      },
      {
        heading: "3. Responsabilité sur les contenus",
        body: "Les contenus générés par l'IA sont des propositions : l'utilisateur reste seul responsable des publications effectuées sur ses comptes LinkedIn, de leur véracité et de leur conformité aux conditions d'utilisation de LinkedIn et au droit applicable. Le mode de validation avant publication est disponible à cet effet.",
      },
      {
        heading: "4. Usage raisonnable",
        body: "Les plans « illimités » s'entendent dans le cadre d'un usage individuel raisonnable. Des limites techniques peuvent s'appliquer pour préserver la qualité du service. Tout usage abusif, automatisé hors fonctionnalités prévues, ou contraire aux CGU de LinkedIn peut entraîner la suspension du compte.",
      },
      {
        heading: "5. Disponibilité",
        body: "Le service est fourni « en l'état », avec une cible de disponibilité élevée mais sans garantie de continuité absolue, notamment en cas de maintenance ou d'indisponibilité des services tiers (LinkedIn, fournisseurs d'IA).",
      },
      {
        heading: "6. Tarifs et facturation",
        body: "Les tarifs en vigueur sont affichés sur la page d'accueil, en euros hors taxes. L'abonnement est mensuel, payable d'avance, sans engagement de durée.",
      },
      {
        heading: "7. Droit applicable",
        body: "Les présentes CGU sont soumises au droit français. Tout litige relèvera des tribunaux compétents de [À COMPLÉTER : ville du siège].",
      },
    ],
  },

  "confidentialite": {
    title: "Politique de confidentialité",
    sections: [
      {
        heading: "Responsable de traitement",
        body: "[À COMPLÉTER : raison sociale] — contact : contact@postgenius.network",
      },
      {
        heading: "Données collectées",
        body: "Données de compte (email, nom, mot de passe chiffré), profil de rédaction (contexte métier, préférences), contenus créés (posts, campagnes, images générées), jetons d'accès LinkedIn (chiffrés en base, révocables à tout moment), sources de veille, données de consommation du service, et statistiques de vos publications LinkedIn (via l'API officielle LinkedIn).",
      },
      {
        heading: "Finalités et bases légales",
        body: "Fourniture du service (exécution du contrat) : génération de contenus, publication LinkedIn, programmation, statistiques. Facturation et obligations légales. Amélioration du service et suivi de consommation (intérêt légitime).",
      },
      {
        heading: "Sous-traitants",
        body: "Hetzner (hébergement, Allemagne), Neon (base de données, UE), Anthropic (génération de texte), OpenAI (génération d'images), LinkedIn (publication et statistiques via API officielle), Brevo (emails transactionnels), OpenAI (transcription de la dictée vocale et des vidéos et enregistrements). Les contenus transmis aux services d'IA le sont uniquement pour produire vos posts.",
      },
      {
        heading: "Durées de conservation",
        body: "Les données sont conservées pendant la durée de vie du compte, puis supprimées dans un délai de 30 jours après sa clôture. Les jetons LinkedIn expirent automatiquement (≈60 jours) et sont supprimés à la déconnexion du compte LinkedIn.",
      },
      {
        heading: "Données reçues de LinkedIn (commentaires de votre page)",
        body: "Lorsque vous connectez une page entreprise, LinkeePost lit les commentaires reçus et peut les présenter dans l'application (alertes, écran Leads). Conformément aux règles de LinkedIn, le profil d'un commentateur (nom, poste) n'est conservé que 24 heures et son commentaire que 48 heures : passé ce délai, ces données sont effacées automatiquement, ainsi que la note calculée à partir d'elles. Elles ne sont ni exportées, ni vendues, ni partagées avec d'autres clients. Pour noter un lead, seuls le poste, l'entreprise et le texte du commentaire (jamais le nom) sont transmis à notre fournisseur d'IA, uniquement pour produire cette note ; pour rédiger un message d'approche que vous demandez, le prénom est aussi transmis, uniquement pour écrire ce message. Les contacts que vous saisissez vous-même restent à votre disposition jusqu'à leur suppression.",
      },
      {
        heading: "Dictée vocale",
        body: "Si vous utilisez la dictée vocale, l'enregistrement de votre voix est envoyé à OpenAI pour être transcrit en texte. Il n'est pas conservé par LinkeePost : seul le texte, que vous relisez, est gardé si vous l'utilisez. Le texte peut ensuite être nettoyé par Anthropic si vous le demandez. La dictée est facultative ; le micro n'est activé qu'après votre accord, à chaque enregistrement.",
      },
      {
        heading: "Vidéo et audio (Seconde vie d'un contenu)",
        body: "Si vous déposez une vidéo ou un enregistrement audio, le fichier est envoyé à notre serveur par morceaux, le son en est extrait puis envoyé à OpenAI pour être transcrit. Le fichier est supprimé dès que la transcription est faite, ou en cas d'échec : LinkeePost ne conserve jamais la vidéo ni l'audio. La transcription est conservée 24 heures au plus, le temps de la relire, puis effacée dès que l'analyse est faite, sauf si vous choisissez de la garder dans votre datalake éditorial. Les repères horaires affichés avec les faits (par exemple « vers 12:30 ») servent à retrouver un passage ; ils ne sont pas transmis à l'IA qui rédige vos posts. Avant l'analyse, vous confirmez que les personnes qui parlent ont accepté d'être citées et vous indiquez si le contenu est le vôtre ou celui d'un tiers (dans ce cas, les idées sont reformulées et la source est citée). Vous pouvez aussi coller directement une transcription : elle est alors traitée comme un texte. Les minutes de vidéo et d'audio sont décomptées de votre offre.",
      },
      {
        heading: "Vos droits",
        body: "Conformément au RGPD, vous disposez de droits d'accès, de rectification, d'effacement, de portabilité et d'opposition. Exercez-les par email à contact@postgenius.network. Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).",
      },
      {
        heading: "Cookies",
        body: "LinkeePost n'utilise que des cookies strictement nécessaires au fonctionnement (session d'authentification). Aucun cookie publicitaire. Sur les pages publiques du site (jamais dans l'application), l'audience est mesurée avec Umami, un outil sans cookie : il enregistre les pages vues, le pays et le type d'appareil, ne conserve aucune adresse IP ni identifiant qui vous suit d'un site à l'autre, et respecte le réglage « Do Not Track » de votre navigateur. Ces statistiques sont anonymes et conservées 13 mois au plus.",
      },
    ],
  },

  // Page publique « Sécurité et confidentialité » : n'affirme que ce qui est vérifié dans le code. Modifiable dans l'administration
  // (pages du pied de page) : ajoutez-y vos engagements contractuels (durée de sauvegarde, copie hors serveur…) quand ils sont confirmés.
  "securite": {
    title: "Sécurité et confidentialité",
    sections: [
      {
        heading: "En bref",
        body: "• Vos données sont hébergées en Europe : serveur en Allemagne, base de données à Francfort.\n• LinkeePost se connecte à LinkedIn par son API officielle, sans extension de navigateur, et ne reçoit jamais votre mot de passe LinkedIn.\n• Vos accès LinkedIn sont chiffrés, et vous pouvez effacer toutes les données LinkedIn en un clic.\n• Rien n'est publié sans une action de votre part, y compris quand vous utilisez un assistant IA connecté.\n• Les données des personnes qui commentent votre page sont effacées automatiquement en 24 à 48 heures.",
      },
      {
        heading: "Où sont vos données",
        body: "L'application est hébergée par Hetzner, en Allemagne. La base de données est hébergée par Neon, dans la région Union européenne (Francfort). Les images, les logos et la médiathèque sont stockés sur le serveur Hetzner.\nLes échanges avec le site passent par HTTPS, et le navigateur est forcé d'y rester. Le site ne peut pas être affiché dans le cadre d'une autre page.",
      },
      {
        heading: "Qui peut accéder à quoi",
        body: "Vous seul voyez votre compte : les données d'un client ne sont jamais montrées à un autre client.\nOffre Agence : le propriétaire de l'agence voit tous ses clients, et peut cloisonner l'accès pour que chaque collaborateur ne voie que les clients qui lui sont affectés. Un membre retiré de l'agence perd l'accès aussitôt, même avec une session encore ouverte.\nSupport : quand nous devons consulter un compte pour vous aider, nous passons par une vue en lecture seule, limitée à 2 heures, qui ne permet de rien modifier.",
      },
      {
        heading: "Mots de passe, sessions et accès LinkedIn",
        body: "• Les mots de passe ne sont jamais stockés en clair : ils sont transformés par un algorithme de hachage conçu pour cela (bcrypt).\n• Les jetons d'accès LinkedIn sont chiffrés en base (AES-256). Ils expirent automatiquement (environ 60 jours) et sont supprimés quand vous déconnectez LinkedIn.\n• La session est un cookie protégé, inaccessible aux scripts du navigateur, valable 30 jours.\n• Le lien de réinitialisation du mot de passe est valable 1 heure.\n• Les tentatives de connexion, d'inscription et de réinitialisation sont limitées, pour freiner les essais répétés.",
      },
      {
        heading: "Votre contrôle sur les données LinkedIn",
        body: "• Chaque connexion est séparée et visible : profil personnel, page entreprise, statistiques du profil. Vous choisissez ce que vous connectez.\n• Le bouton « Supprimer mes données LinkedIn » efface en une fois les connexions, les statistiques, les interactions et les contacts issus de LinkedIn.\n• Commentateurs de votre page : leur nom et leur poste ne sont conservés que 24 heures, leur commentaire 48 heures, puis effacés automatiquement avec la note calculée à partir d'eux. Ils ne sont ni exportés, ni vendus, ni partagés avec d'autres clients.\n• Pour noter un contact, seuls son poste, son entreprise et le texte du commentaire sont envoyés à notre fournisseur d'IA, jamais son nom.\n• Les réponses aux commentaires sont envoyées sur votre clic, jamais automatiquement, et plafonnées par heure pour protéger votre compte.",
      },
      {
        heading: "Intelligence artificielle",
        body: "• Les textes sont rédigés avec Anthropic ; les images et la transcription de la voix sont réalisées avec OpenAI. Ces fournisseurs ne reçoivent que ce qui est nécessaire pour produire votre contenu.\n• L'IA écrit à partir de vos sources. Quand vous réutilisez un contenu qui n'est pas le vôtre, LinkeePost reformule les idées et place la source en premier commentaire du post.\n• Dictée vocale : l'enregistrement est envoyé pour être transcrit et n'est pas conservé par LinkeePost ; le micro ne s'active qu'avec votre accord, à chaque enregistrement.\n• Vidéo et audio (« Seconde vie d'un contenu ») : le fichier est reçu par notre serveur, qui en extrait le son pour le faire transcrire. Le fichier est supprimé dès que la transcription est faite, ou en cas d'échec. La transcription est conservée 24 heures au plus, le temps de la relire, puis effacée ; vous pouvez choisir de la garder dans votre datalake. Vous confirmez que les personnes qui parlent ont accepté d'être citées.",
      },
      {
        heading: "Assistants IA connectés (accès MCP)",
        body: "• Un assistant (par exemple Claude, ChatGPT avec Codex, Claude Code ou Cursor) se connecte soit par une autorisation que vous donnez dans une fenêtre LinkeePost, avec un jeton court d'une heure renouvelé automatiquement, soit par une clé personnelle que vous pouvez révoquer.\n• Les clés et les jetons ne sont jamais stockés en clair chez nous : seule une empreinte l'est.\n• L'assistant peut lire vos posts, votre planning, vos résultats et les conseils du coach. Il ne peut créer des brouillons que si vous l'avez autorisé (case décochée par défaut). Aucun outil ne programme ni ne publie.\n• Il ne reçoit jamais votre mot de passe, vos jetons LinkedIn, ni les noms et commentaires des personnes qui commentent votre page.\n• Vous retirez l'accès en un clic, avec effet immédiat, et vous recevez un e-mail à chaque nouvelle connexion. Les appels d'un assistant sont limités.\n• Ce que l'assistant reçoit est ensuite traité par son éditeur, selon ses propres conditions : il n'est pas notre sous-traitant.",
      },
      {
        heading: "Sauvegardes",
        body: "La base de données est hébergée chez Neon, qui en assure les sauvegardes. Les images, les logos et la médiathèque font l'objet d'une archive quotidienne, dont les 14 dernières sont conservées ; une alerte prévient les administrateurs si une sauvegarde échoue ou n'a pas eu lieu depuis plus de 36 heures.",
      },
      {
        heading: "Paiement",
        body: "Les paiements des abonnements sont traités par Stripe : LinkeePost ne voit et n'enregistre jamais votre numéro de carte.",
      },
      {
        heading: "Sous-traitants",
        body: "Hetzner (hébergement, Allemagne), Neon (base de données, UE), Anthropic (rédaction), OpenAI (images et transcription), LinkedIn (publication et statistiques, via son API officielle), Brevo (e-mails), Stripe (paiement), Umami (audience anonyme des pages publiques, sans cookie). La liste complète et à jour figure dans la politique de confidentialité.",
      },
      {
        heading: "Vos droits",
        body: "Accès, rectification, effacement, portabilité, opposition : écrivez à contact@postgenius.network. Vous pouvez saisir la CNIL (cnil.fr). Vos données sont supprimées dans un délai de 30 jours après la clôture du compte.",
      },
      {
        heading: "Ce que nous n'avons pas",
        body: "LinkeePost est un jeune service : nous ne disposons pas, aujourd'hui, de certification de sécurité (SOC 2, ISO 27001). Si votre organisation l'exige, nous préférons vous le dire dès maintenant.",
      },
      {
        heading: "Une question de sécurité, une faille à signaler ?",
        body: "Écrivez-nous à contact@postgenius.network en indiquant « Sécurité » dans l'objet.",
      },
    ],
  },

  "mentions-legales": {
    title: "Mentions légales",
    sections: [
      {
        heading: "Éditeur du site",
        body: "LinkeePost est édité par [À COMPLÉTER : raison sociale], [À COMPLÉTER : forme juridique, ex. SASU au capital de X €], immatriculée au RCS de [À COMPLÉTER : ville] sous le numéro [À COMPLÉTER : SIREN], dont le siège social est situé [À COMPLÉTER : adresse].\nN° TVA intracommunautaire : [À COMPLÉTER]\nDirecteur de la publication : [À COMPLÉTER : nom]\nContact : contact@postgenius.network",
      },
      {
        heading: "Hébergement",
        body: "Le site est hébergé par Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Allemagne — www.hetzner.com.\nBase de données hébergée par Neon Inc. (région UE — Francfort).",
      },
      {
        heading: "Propriété intellectuelle",
        body: "L'ensemble des éléments du site (textes, interface, marque, logo) est protégé par le droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite. LinkedIn est une marque déposée de LinkedIn Corporation ; LinkeePost est un service indépendant, non affilié à LinkedIn.",
      },
      {
        heading: "Données personnelles",
        body: "Les modalités de traitement des données personnelles sont détaillées dans la politique de confidentialité accessible depuis le pied de page.",
      },
    ],
  },
};

// Lit le contenu d'une page depuis la DB, avec fallback sur les défauts.
export async function getFooterPage(key) {
  if (!FOOTER_PAGE_KEYS.includes(key)) return null;
  return memo(`page:${key}`, MEMO_TTL, async () => {
    const row = await prisma.siteContent.findUnique({ where: { key: `page-${key}` } });
    if (!row?.value) return FOOTER_PAGE_DEFAULTS[key];
    let saved;
    try {
      saved = JSON.parse(row.value);
    } catch {
      return FOOTER_PAGE_DEFAULTS[key];
    }
    return {
      title: saved.title || FOOTER_PAGE_DEFAULTS[key].title,
      sections: Array.isArray(saved.sections) && saved.sections.length
        ? saved.sections
        : FOOTER_PAGE_DEFAULTS[key].sections,
    };
  }, FOOTER_PAGE_DEFAULTS[key]);
}
