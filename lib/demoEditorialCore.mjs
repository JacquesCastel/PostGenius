// Démonstration de l'intelligence éditoriale : socle PUR (aucune base de données, aucun appel IA), partagé par la page /demo-editoriale
// et par le script scripts/demo-editorial.mjs. Une seule source de vérité pour : le sujet commun, les trois identités, la
// vérification d'intégrité d'un exemple, et la comparaison mécanique des textes.
//
// Principe d'honnêteté : un exemple n'est affiché comme « produit par LinkeePost » que s'il porte l'enregistrement complet de sa génération
// (requête, profil lu en base, contexte rapporté par le moteur, réponse brute) et que son empreinte se recalcule à l'identique.
import crypto from "node:crypto";

// Le même sujet, mot pour mot, pour les trois entreprises (et le témoin).
export const SUBJECT = {
  title: "Une tolérance de fabrication trop contraignante",
  text:
    "Dans un projet client, une entreprise industrielle identifie une tolérance de fabrication particulièrement contraignante, qui ne semble pas indispensable à la fonction de la pièce. " +
    "Une discussion entre les bureaux d'études (celui du client et celui de l'industriel) permet de proposer une simplification technique. " +
    "Aucun gain financier chiffré n'est connu à ce stade.",
};

// Consignes de style IDENTIQUES pour toutes les identités : la forme ne doit pas être ce qui les distingue (sinon la démonstration prouverait le style, pas l'angle).
// La dernière phrase interdit les chiffres inventés : le sujet précise qu'aucun gain chiffré n'est connu.
const SHARED_STYLE =
  "Phrases courtes et concrètes. Aucun jargon. Pas d'exagération. Aucun chiffre inventé : si un chiffre n'est pas fourni, n'en donne pas.";

// Les champs du profil que le moteur injecte réellement (voir app/api/generate/route.js) ; les textes affichés aux visiteurs sont CES champs, mot pour mot.
export const PROFILE_FIELDS = ["headline", "companyName", "businessDescription", "targetAudience", "market", "commGoals", "editorialLine", "styleNotes"];

export const IDENTITIES = [
  {
    id: "wharf",
    name: "Wharf",
    kind: "Agence de communication corporate B2B",
    fictional: false,
    accent: "rose",
    expertise: "Agence de communication corporate B2B",
    tone: "Professionnel",
    profile: {
      headline: "Agence de communication corporate B2B",
      companyName: "Wharf",
      businessDescription: "Agence de communication corporate B2B : stratégie de marque, récit et design narratif, valorisation des expertises de ses clients.",
      targetAudience: "Dirigeants et directions de la communication d'entreprises B2B, notamment industrielles.",
      market: "Communication corporate B2B : stratégie de marque, récit, design narratif, valorisation des expertises.",
      commGoals: "Asseoir la crédibilité de l'agence et susciter des échanges avec des dirigeants B2B.",
      editorialLine: "Une expertise que personne ne comprend ne crée aucune valeur : le travail d'une agence est de la rendre lisible, par le récit et la marque.",
      styleNotes: SHARED_STYLE,
    },
  },
  {
    id: "aster",
    name: "ASTER INDUSTRIE",
    kind: "PME d'usinage de précision",
    fictional: true,
    accent: "teal",
    expertise: "PME industrielle spécialisée dans l'usinage de précision",
    tone: "Professionnel",
    profile: {
      headline: "PME d'usinage de précision",
      companyName: "ASTER INDUSTRIE",
      businessDescription: "PME industrielle spécialisée dans l'usinage de précision : pièces techniques sur plans, séries et prototypes, pour des clients de l'industrie.",
      targetAudience: "Bureaux d'études, responsables méthodes et acheteurs techniques de donneurs d'ordres industriels.",
      market: "Sous-traitance industrielle : usinage de précision, accompagnement des clients dès la conception.",
      commGoals: "Faire connaître l'expertise technique de l'entreprise et susciter des projets avec de nouveaux donneurs d'ordres.",
      editorialLine: "La qualité industrielle se construit en dialogue avec le client, dès la conception, pas à la réception des pièces.",
      styleNotes: SHARED_STYLE,
    },
  },
  {
    id: "axiome",
    name: "AXIOME Conseil",
    kind: "Cabinet de conseil en achats industriels",
    fictional: true,
    accent: "violet",
    expertise: "Cabinet de conseil en stratégie et performance des achats industriels",
    tone: "Professionnel",
    profile: {
      headline: "Cabinet de conseil en achats industriels",
      companyName: "AXIOME Conseil",
      businessDescription: "Cabinet de conseil en stratégie et performance des achats industriels : analyse du coût total, accompagnement des directions achats et des bureaux d'études.",
      targetAudience: "Directeurs achats, directeurs industriels et directions techniques de PME et ETI industrielles.",
      market: "Conseil en achats industriels : approche économique globale, optimisation des achats, coopération entre achats et bureaux d'études.",
      commGoals: "Asseoir la crédibilité du cabinet auprès des directions achats et obtenir des rendez-vous de diagnostic.",
      editorialLine: "La performance d'un achat se joue en amont, dans la façon dont le besoin est défini, avant toute négociation avec le fournisseur.",
      styleNotes: SHARED_STYLE,
    },
  },
  // Témoin : même sujet, même moteur, AUCUN profil éditorial. Il sert à attribuer la différence au profil et non au hasard ou au moteur.
  {
    id: "temoin",
    name: "Témoin sans profil",
    kind: "Même sujet, aucun profil éditorial",
    fictional: true,
    control: true,
    accent: "slate",
    expertise: "Auteur d'un post LinkedIn",
    tone: "Professionnel",
    profile: { headline: null, companyName: null, businessDescription: null, targetAudience: null, market: null, commGoals: null, editorialLine: null, styleNotes: SHARED_STYLE },
  },
];

export const COMPANY_IDS = IDENTITIES.filter((i) => !i.control).map((i) => i.id);
export const identityOf = (id) => IDENTITIES.find((i) => i.id === id) ?? null;

// Ce que voit le visiteur de l'écran « Trois entreprises » : les champs du profil réellement injectés, sans réécriture.
export function displayOf(identity) {
  const p = identity.profile;
  return { activity: p.businessDescription, positioning: p.market, target: p.targetAudience, conviction: p.editorialLine };
}

// ── Intégrité ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function canonical(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
}
export const recordHash = (record) => crypto.createHash("sha256").update(canonical(record)).digest("hex");

// Un exemple est valide si : (1) l'enregistrement complet est présent, (2) son empreinte se recalcule, (3) il porte bien LE sujet commun,
// (4) le profil lu en base lors de la génération correspond au profil affiché, (5) le texte est non vide.
// Renvoie { ok, reasons[] }. `fixture` : jeu de test, jamais présenté comme authentique.
export function validateEntry(entry, id) {
  const reasons = [];
  const identity = identityOf(id);
  if (!identity) return { ok: false, reasons: ["identité inconnue"] };
  if (!entry || typeof entry !== "object") return { ok: false, reasons: ["entrée absente"] };
  const rec = entry.record;
  if (!rec || typeof rec !== "object") return { ok: false, reasons: ["enregistrement de génération absent"] };
  if (typeof entry.recordHash !== "string" || recordHash(rec) !== entry.recordHash) reasons.push("l'empreinte ne correspond plus à l'enregistrement");
  const text = rec.response?.text;
  if (typeof text !== "string" || !text.trim()) reasons.push("texte absent");
  if (rec.request?.theme !== SUBJECT.text) reasons.push("le sujet n'est pas le sujet commun");
  for (const f of PROFILE_FIELDS) if ((rec.profile?.[f] ?? null) !== (identity.profile[f] ?? null)) reasons.push(`profil différent (${f})`);
  if (entry.engine?.route !== "POST /api/generate") reasons.push("provenance moteur non indiquée");
  return { ok: reasons.length === 0, reasons };
}

// ── Lecture mécanique des textes (aucune IA, vérifiable) ──────────────────────────────────────────────────────────────────
export const firstLine = (text) => String(text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";

const STOP = new Set("alors ainsi après aussi autre autres avant avec avoir cette celui celle ceux chaque comme dans depuis donc dont elle elles entre être mais même moins notre nous nouveau parce pendant peut plus pour pourquoi quand quel quelle quels sans sera sont sous sur tout tous toute toutes très une les des est que qui pas son ses leur leurs vos votre vous elles aux par ces cet était étaient fait faire fois ils elle comment cela ceci celui-ci aucun aucune encore déjà alors puis donc soit peu bien car ont ete etre avait avaient rien toujours jamais souvent".split(" "));

function tokens(text) {
  return (String(text).toLowerCase().normalize("NFC").match(/[a-zàâçéèêëîïôûùüÿœ][a-zàâçéèêëîïôûùüÿœ'-]{4,}/g) ?? []).map((w) => w.replace(/^[-']+|[-']+$/g, "")).filter((w) => w.length >= 5 && !STOP.has(w));
}

// Mots (≥ 5 lettres, hors mots courants) présents dans CE texte et absents des autres, du plus fréquent au plus long. Méthode mécanique et
// reproductible : elle mesure ce qui distingue les textes, sans prétendre expliquer pourquoi.
export function distinctTerms(textsById, limit = 6) {
  const sets = Object.fromEntries(Object.entries(textsById).map(([id, t]) => [id, tokens(t)]));
  const out = {};
  for (const id of Object.keys(sets)) {
    const others = new Set(Object.entries(sets).filter(([k]) => k !== id).flatMap(([, v]) => v));
    const count = {};
    for (const w of sets[id]) if (!others.has(w)) count[w] = (count[w] ?? 0) + 1;
    out[id] = Object.entries(count).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0])).slice(0, limit).map(([w]) => w);
  }
  return out;
}

// Lecture éditoriale rédigée APRÈS génération par une personne (jamais présentée comme une décision du moteur).
// Forme attendue : { authoredBy: "…", note?: "…", rows: [{ label: "…", wharf?: "…", aster?: "…", axiome?: "…" }] }
export function cleanComparison(raw) {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.rows) || raw.rows.length === 0) return null;
  const s = (v) => (typeof v === "string" ? v.trim().slice(0, 400) : "");
  const rows = raw.rows.slice(0, 8).map((r) => ({ label: s(r?.label), wharf: s(r?.wharf), aster: s(r?.aster), axiome: s(r?.axiome) })).filter((r) => r.label && (r.wharf || r.aster || r.axiome));
  if (!rows.length || !s(raw.authoredBy)) return null;
  return { authoredBy: s(raw.authoredBy), note: s(raw.note), rows };
}
