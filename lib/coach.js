import { MOODS } from "./moods";

// « Le coach » : lit les mesures déjà enregistrées de VOS posts (jamais LinkedIn) et dit ce qui marche le mieux chez vous.
// Ce n'est pas de l'apprentissage automatique : avec quelques dizaines de posts, un modèle apprendrait du bruit. Ce sont des comparaisons
// simples à votre propre médiane, avec un nombre de posts et un indice de confiance affichés à chaque fois. Ce ne sont pas des règles de
// LinkedIn (son algorithme n'est pas public), seulement ce que montrent vos propres chiffres.

export const MIN_MEASURED = 8; // en dessous, aucun conseil : trop peu de posts pour distinguer un effet du hasard
export const MIN_GROUP = 3; // posts minimum dans un groupe pour qu'il compte
const LIFT_UP = 1.3; // « marche mieux »
const LIFT_DOWN = 0.75; // « marche moins bien »
const CONSISTENT = 2 / 3; // part des posts du groupe qui doit aller dans le même sens que le groupe

const TZ = "Europe/Paris";
const DAYS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const parisParts = (date) => {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (t) => f.find((p) => p.type === t)?.value ?? "";
  const iso = { "lun.": 1, "mar.": 2, "mer.": 3, "jeu.": 4, "ven.": 5, "sam.": 6, "dim.": 7 }[get("weekday")] ?? null;
  return { isoDay: iso, minutes: (Number(get("hour")) % 24) * 60 + Number(get("minute")) };
};

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const hourBand = (min) => (min < 600 ? "morning" : min < 840 ? "midday" : min < 1080 ? "afternoon" : "evening");
const BAND_LABEL = { morning: "le matin (avant 10 h)", midday: "en milieu de journée (10 h à 14 h)", afternoon: "l'après-midi (14 h à 18 h)", evening: "le soir (après 18 h)" };
const lengthBand = (n) => (n < 500 ? "short" : n <= 1200 ? "mid" : "long");
const LENGTH_LABEL = { short: "courts (moins de 500 caractères)", mid: "de longueur moyenne (500 à 1 200 caractères)", long: "longs (plus de 1 200 caractères)" };
const FORMAT_LABEL = { carousel: "au format carrousel", video: "avec une vidéo", image: "avec une image", text: "en texte seul" };
const hasLink = (t) => /https?:\/\/\S+/i.test(t ?? "");

// Un post mesuré : { id, publishedAt, target, impressions, likes, comments, shares, text, type, imageUrl, videoUrl, youtubeUrl, mood, contextId, firstComment }
function prepare(rows) {
  const out = [];
  for (const r of rows) {
    if (!r.impressions || r.impressions <= 0 || !r.publishedAt) continue;
    const { isoDay, minutes } = parisParts(new Date(r.publishedAt));
    if (!isoDay) continue;
    const format = r.type === "carrousel" ? "carousel" : r.videoUrl || r.type === "video" ? "video" : r.imageUrl || r.youtubeUrl ? "image" : "text";
    out.push({
      id: r.id, target: r.target ?? "person", impressions: r.impressions,
      rate: ((r.likes ?? 0) + (r.comments ?? 0) + (r.shares ?? 0)) / r.impressions,
      isoDay, minutes, band: hourBand(minutes), format, mood: r.mood ?? null, contextId: r.contextId ?? null,
      link: hasLink(r.text), length: lengthBand((r.text ?? "").length),
    });
  }
  // Chaque post est comparé à la médiane des posts de SA destination (profil ou page) : leurs audiences n'ont pas la même taille
  const med = new Map();
  for (const t of new Set(out.map((p) => p.target))) med.set(t, median(out.filter((p) => p.target === t).map((p) => p.impressions)));
  for (const p of out) p.ratio = p.impressions / (med.get(p.target) || 1);
  return out;
}

const confidence = (n) => (n >= 10 ? "bonne" : n >= 5 ? "moyenne" : "faible");

// Regroupe les posts selon une dimension ; renvoie les groupes retenus (assez de posts, effet régulier)
function groups(posts, keyOf) {
  const map = new Map();
  for (const p of posts) { const k = keyOf(p); if (k == null) continue; (map.get(k) ?? map.set(k, []).get(k)).push(p); }
  const total = posts.length;
  return [...map.entries()].map(([key, list]) => {
    const lift = median(list.map((p) => p.ratio));
    const same = list.filter((p) => (lift >= 1 ? p.ratio >= 1 : p.ratio < 1)).length / list.length;
    return { key, n: list.length, lift, consistent: same >= CONSISTENT, avgRate: list.reduce((a, p) => a + p.rate, 0) / list.length, medianImpressions: median(list.map((p) => p.impressions)), share: list.length / total };
  }).filter((g) => g.n >= MIN_GROUP);
}

export function analyze(rows, { themeNames = new Map(), mainThemeName = "Mon activité" } = {}) {
  const posts = prepare(rows);
  const n = posts.length;
  const base = { measured: n, needed: Math.max(0, MIN_MEASURED - n), insights: [], slots: null, medianImpressions: median(posts.map((p) => p.impressions)) };
  if (n < MIN_MEASURED) return base;

  const dims = [
    { id: "weekday", keyOf: (p) => p.isoDay, label: (k) => `publiés le ${DAYS[k]}`, action: "slot" },
    { id: "hour", keyOf: (p) => p.band, label: (k) => `publiés ${BAND_LABEL[k]}`, action: "slot" },
    { id: "mood", keyOf: (p) => p.mood, label: (k) => `avec l'humeur « ${MOODS.find((m) => m.code === k)?.label ?? k} »`, action: "create" },
    { id: "theme", keyOf: (p) => p.contextId ?? "main", label: (k) => `sur la thématique « ${k === "main" ? mainThemeName : themeNames.get(k) ?? "supprimée"} »`, action: "create" },
    { id: "format", keyOf: (p) => p.format, label: (k) => FORMAT_LABEL[k], action: "create" },
    { id: "link", keyOf: (p) => (p.link ? "yes" : "no"), label: (k) => (k === "yes" ? "avec un lien dans le texte" : "sans lien dans le texte"), action: "firstcomment" },
    { id: "length", keyOf: (p) => p.length, label: (k) => LENGTH_LABEL[k], action: "create" },
  ];

  const candidates = [];
  const detail = {};
  for (const d of dims) {
    const gs = groups(posts, d.keyOf);
    // Tableau « Pourquoi ? » : tous les groupes de la dimension qui ont assez de posts
    detail[d.id] = gs.map((g) => ({ key: g.key, label: d.label(g.key), n: g.n, lift: g.lift, medianImpressions: g.medianImpressions, avgRate: g.avgRate })).sort((a, b) => b.lift - a.lift);
    for (const g of gs) {
      if (!g.consistent) continue;
      const up = g.lift >= LIFT_UP, down = g.lift <= LIFT_DOWN;
      if (!up && !down) continue;
      // Une dimension à deux valeurs (lien oui / non) : ne retenir que le groupe qui s'écarte, pas son miroir
      candidates.push({ dimension: d.id, key: g.key, direction: up ? "up" : "down", lift: g.lift, n: g.n, label: d.label(g.key), action: d.action, confidence: confidence(g.n), score: Math.abs(Math.log(g.lift)) * Math.min(g.n, 10) / 10 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const seen = new Set();
  const insights = [];
  for (const c of candidates) {
    const k = `${c.dimension}:${c.direction}`; // au plus un « marche mieux » et un « marche moins bien » par dimension
    if (seen.has(k)) continue;
    seen.add(k);
    insights.push({ ...c, score: undefined, detail: detail[c.dimension] ?? [] });
    if (insights.length === 3) break;
  }

  // Créneaux conseillés : jours qui portent le mieux (jusqu'à 3), heure habituelle des posts du meilleur moment de la journée
  const dayGroups = groups(posts, (p) => p.isoDay).filter((g) => g.consistent && g.lift >= 1.15).sort((a, b) => b.lift - a.lift).slice(0, 3);
  let slots = null;
  if (dayGroups.length) {
    const days = dayGroups.map((g) => g.key).sort((a, b) => a - b);
    const bandG = groups(posts, (p) => p.band).filter((g) => g.consistent && g.lift >= 1).sort((a, b) => b.lift - a.lift)[0];
    let time = null;
    if (bandG) {
      const m = median(posts.filter((p) => p.band === bandG.key).map((p) => p.minutes));
      const r = Math.round(m / 30) * 30;
      time = `${String(Math.floor(r / 60) % 24).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`;
    }
    const weak = groups(posts, (p) => p.isoDay).filter((g) => g.consistent && g.lift <= LIFT_DOWN).map((g) => g.key);
    slots = { days, weak, time, n: dayGroups.reduce((a, g) => a + g.n, 0), confidence: confidence(Math.min(...dayGroups.map((g) => g.n))), lifts: Object.fromEntries(dayGroups.map((g) => [g.key, g.lift])) };
  }
  return { ...base, insights, slots, detail };
}

export const DAY_NAMES = DAYS;
