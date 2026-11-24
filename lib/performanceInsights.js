import { prepare, groups, buildDims, LIFT_UP, LIFT_DOWN, MIN_MEASURED } from "./coach.js";
import { objectiveCoverage } from "./qualification.js";

// Constats de performance : ce que montrent les mesures déjà enregistrées d'un compte, avec de quoi les vérifier. PUR : aucun accès base ni réseau, aucune IA.
// Réutilise les comparaisons du coach (même médiane par destination, mêmes seuils d'écart et de régularité) et y ajoute : l'objectif du plan de campagne, un niveau
// (observation / tendance), la période, les posts utilisés et les limites. Ce sont des repères tirés des posts de l'auteur, jamais des règles de LinkedIn,
// et jamais une causalité : aucun énoncé ne dit « parce que ».

export const MAX_INSIGHTS = 3; // au plus trois constats, un par dimension et par direction
export const MIN_TREND = 5; // posts minimum pour parler de « tendance » (en dessous : « observation »)

const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const confidence = (n) => (n >= 10 ? "bonne" : n >= 5 ? "moyenne" : "faible");
const CAVEATS = [
  "Facteurs non contrôlés : jour, heure, longueur, actualité du moment, taille de l'audience.",
  "Statistiques organiques seulement (la publicité n'est pas comptée).",
  "Repère tiré de vos propres posts, pas une règle de LinkedIn : un lien de cause à effet n'est pas démontré.",
];

export function deriveInsights(rows, { themeNames = new Map(), mainThemeName = "Mon activité", maturity = null } = {}) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  // dates en AAAA-MM-JJ (UTC), que la base renvoie des objets Date ou des chaînes
  const iso = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : ""; };
  const posts = prepare(rows).map((p) => ({ ...p, objective: byId.get(p.id)?.objective ?? null, publishedAt: iso(byId.get(p.id)?.publishedAt) }));
  const out = { measured: posts.length, insights: [], usedDimensions: [], ignoredDimensions: [] };
  if (posts.length < MIN_MEASURED) return out; // sous le seuil du coach : trop peu de posts pour distinguer un effet du hasard

  const dims = buildDims({ themeNames, mainThemeName });
  const cov = objectiveCoverage(posts);
  if (cov.usable) dims.push({ id: "objective", keyOf: (p) => p.objective, label: (k) => `ayant pour objectif « ${k} »`, action: "create", note: "L'objectif est lu dans le plan de campagne (texte libre ramené à une catégorie) : c'est une lecture par règles, pas une donnée certaine." });
  else out.ignoredDimensions.push({ id: "objective", reason: cov.qualified === 0 ? "aucun post n'a d'objectif renseigné" : cov.distinct < 2 ? `un seul objectif renseigné (${cov.qualified} posts sur ${cov.total})` : `${cov.qualified} posts sur ${cov.total} ont un objectif renseigné : il en faut au moins la moitié` });

  const candidates = [];
  for (const d of dims) {
    const gs = groups(posts, d.keyOf);
    if (gs.length) out.usedDimensions.push(d.id);
    for (const g of gs) {
      if (!g.consistent) continue;
      const up = g.lift >= LIFT_UP, down = g.lift <= LIFT_DOWN;
      if (!up && !down) continue;
      const members = g.members.map((id) => posts.find((p) => p.id === id)).sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
      // double confirmation : chaque moitié de la période (dans l'ordre du temps) va dans le même sens que le groupe
      const half = Math.floor(members.length / 2);
      const firstHalf = members.slice(0, half), secondHalf = members.slice(half);
      const side = (list) => (list.length ? median(list.map((p) => p.ratio)) : NaN);
      const a = side(firstHalf), b = side(secondHalf);
      const confirmed = up ? a >= 1 && b >= 1 : a < 1 && b < 1;
      const level = g.n >= MIN_TREND && confirmed ? "tendance" : "observation";
      const dates = members.map((p) => p.publishedAt);
      candidates.push({
        id: `${d.id}:${g.key}`, dimension: d.id, key: g.key, label: d.label(g.key), direction: up ? "up" : "down", metric: "impressions",
        lift: g.lift, n: g.n, periodFrom: dates[0], periodTo: dates[dates.length - 1], maturity, level, confidence: confidence(g.n),
        caveats: d.note ? [...CAVEATS, d.note] : CAVEATS, draftIds: members.map((p) => p.id), action: d.action,
        score: Math.abs(Math.log(g.lift)) * Math.min(g.n, 10) / 10,
      });
    }
  }
  // un seul constat par dimension et par direction : le plus net ; puis les « tendances » avant les « observations », puis l'écart pondéré par l'effectif
  // deux dimensions qui désignent exactement les mêmes posts (par exemple « le mardi » et « le matin » quand on ne publie que le mardi matin) disent la même chose :
  // un seul est gardé (le plus net ; à égalité, celui des dimensions du coach le premier dans l'ordre)
  const sig = (c) => `${c.direction}|${[...c.draftIds].sort().join(",")}`;
  const order = new Map(dims.map((d, i) => [d.id, i]));
  const bySig = new Map();
  for (const c of candidates) { const k = sig(c); const cur = bySig.get(k); if (!cur || rank(c) > rank(cur) || (rank(c) === rank(cur) && order.get(c.dimension) < order.get(cur.dimension))) bySig.set(k, c); }
  const best = new Map();
  candidates.length = 0; candidates.push(...bySig.values());
  for (const c of candidates) { const k = `${c.dimension}:${c.direction}`; const cur = best.get(k); if (!cur || rank(c) > rank(cur)) best.set(k, c); }
  out.insights = [...best.values()].sort((x, y) => rank(y) - rank(x) || String(x.id).localeCompare(String(y.id))).slice(0, MAX_INSIGHTS).map(({ score, ...c }) => c);
  return out;
}
const rank = (c) => (c.level === "tendance" ? 1000 : 0) + c.score;
