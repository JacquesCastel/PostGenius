// Veille de contenu : crawl des sources (flux RSS/Atom) du client.
// Sans dépendance externe : parsing XML par expressions régulières,
// découverte automatique du flux RSS depuis une page HTML.

const FETCH_TIMEOUT = 8000;
const CACHE_TTL = 30 * 60 * 1000; // 30 min
const cache = new Map(); // userId -> { at, items }

// Garde anti-SSRF basique : http(s) public uniquement
export function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    const h = u.hostname;
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return false;
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(h)) {
      const [a, b] = h.split(".").map(Number);
      if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || a === 169)
        return false;
    }
    if (h === "::1" || h.startsWith("[")) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchUrl(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "PostGenius/1.0 (veille RSS)", Accept: "application/rss+xml, application/atom+xml, text/html, */*" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function decode(s) {
  return (s ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)<\\/${n}>`, "i"));
    if (m) return m[1];
  }
  return null;
}

// Parse RSS 2.0 et Atom
export function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  for (const b of blocks.slice(0, 15)) {
    const title = decode(tag(b, ["title"]));
    if (!title) continue;
    // Atom : <link href="..."/> — RSS : <link>...</link>
    let link = null;
    const atomLink = b.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
    if (atomLink) link = atomLink[1];
    else link = decode(tag(b, ["link"])) || null;
    const dateRaw = tag(b, ["pubDate", "published", "updated", "dc:date"]);
    const date = dateRaw ? new Date(decode(dateRaw)) : null;
    const excerpt = decode(tag(b, ["description", "summary", "content"])).slice(0, 280);
    items.push({ title, link, date: date && !isNaN(date) ? date.toISOString() : null, excerpt });
  }
  return items;
}

export function looksLikeFeed(text) {
  const head = text.slice(0, 500).toLowerCase();
  return head.includes("<rss") || head.includes("<feed") || head.includes("<rdf");
}

// Trouve l'URL du flux RSS déclaré dans une page HTML
export function discoverFeedUrl(html, baseUrl) {
  const m = html.match(
    /<link[^>]+(?:type="application\/(?:rss|atom)\+xml"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*type="application\/(?:rss|atom)\+xml")/i
  );
  const href = m?.[1] ?? m?.[2];
  if (!href) return null;
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

// Résout une URL (page ou flux) vers { feedUrl, items } — lève si invalide
export async function resolveSource(url) {
  if (!isSafeUrl(url)) throw new Error("URL non autorisée.");
  const text = await fetchUrl(url);
  if (looksLikeFeed(text)) {
    const items = parseFeed(text);
    if (!items.length) throw new Error("Flux vide ou non reconnu.");
    return { feedUrl: url, items };
  }
  const feedUrl = discoverFeedUrl(text, url);
  if (!feedUrl || !isSafeUrl(feedUrl)) throw new Error("Aucun flux RSS trouvé sur cette page.");
  const feedText = await fetchUrl(feedUrl);
  const items = parseFeed(feedText);
  if (!items.length) throw new Error("Flux vide ou non reconnu.");
  return { feedUrl, items };
}

// Veille agrégée d'un utilisateur (avec cache 30 min)
export async function getVeille(userId, sources, { force = false } = {}) {
  const hit = cache.get(userId);
  if (!force && hit && Date.now() - hit.at < CACHE_TTL && hit.key === sources.map((s) => s.url).join("|")) {
    return hit.items;
  }
  const results = await Promise.allSettled(
    sources.map(async (s) => {
      const text = await fetchUrl(s.url);
      const items = looksLikeFeed(text) ? parseFeed(text) : [];
      return items.map((i) => ({ ...i, source: s.title, sourceId: s.id }));
    })
  );
  const items = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => r.value)
    .sort((a, b) => new Date(b.date ?? 0) - new Date(a.date ?? 0))
    .slice(0, 30);
  cache.set(userId, { at: Date.now(), items, key: sources.map((s) => s.url).join("|") });
  return items;
}
