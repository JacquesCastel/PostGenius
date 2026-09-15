import { resolveSource } from "../veille";

// Veille produit (pas liée à un compte) : actualité et bonnes pratiques de
// publication sur LinkedIn, agrégée depuis des sources spécialisées.
// Alimente le bloc "Veille LinkedIn" de la page Copilote IA. Réutilise le
// même mécanisme RSS/Atom sans dépendance externe que lib/veille.js.

const SOURCES = [
  { title: "Hootsuite Blog", url: "https://blog.hootsuite.com/feed/" },
  { title: "Later Blog", url: "https://later.com/rss.xml" },
  { title: "Sprout Social Insights", url: "https://sproutsocial.com/insights/feed/" },
  { title: "Social Media Today", url: "https://www.socialmediatoday.com/feeds/news" },
  { title: "Search Engine Journal", url: "https://www.searchenginejournal.com/feed/" },
];

const CACHE_TTL = 6 * 60 * 60 * 1000; // 6h — contenu global, identique pour tous les comptes
let cache = null; // { at, items }

function isAboutLinkedIn(item) {
  return `${item.title} ${item.excerpt}`.toLowerCase().includes("linkedin");
}

export async function getLinkedInWatch({ force = false } = {}) {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL) return cache.items;

  const results = await Promise.allSettled(
    SOURCES.map(async (s) => {
      const { items } = await resolveSource(s.url);
      return items.map((i) => ({ ...i, source: s.title }));
    })
  );

  const items = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .filter(isAboutLinkedIn)
    .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
    .slice(0, 12);

  // Une panne réseau ponctuelle ne doit pas vider le bloc pour 6h :
  // on ne remplace le cache que si l'agrégation a produit quelque chose.
  if (items.length) cache = { at: Date.now(), items };
  return items.length ? items : cache?.items ?? [];
}
