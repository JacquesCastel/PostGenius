// Liens YouTube : extraction de l'identifiant, URL d'intégration, métadonnées.
// Partagé par le navigateur (aperçu), le blog (Markdown) et la publication LinkedIn.

const ID = /^[\w-]{11}$/;
const HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com", "youtu.be"]);

// Renvoie l'identifiant (11 caractères) ou null. Accepte watch?v=, youtu.be/, shorts/, live/, embed/.
export function parseYouTubeId(input) {
  if (typeof input !== "string") return null;
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || !HOSTS.has(u.hostname.toLowerCase())) return null;
  let id = null;
  if (u.hostname.toLowerCase() === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (u.pathname === "/watch") id = u.searchParams.get("v");
  else {
    const m = /^\/(?:shorts|live|embed|v)\/([^/?#]+)/.exec(u.pathname);
    id = m?.[1] ?? null;
  }
  return id && ID.test(id) ? id : null;
}

export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}`;
export const youtubeThumbUrl = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// Titre de la vidéo via oEmbed (sans clé API). Repli : titre générique.
export async function fetchYouTubeTitle(id) {
  const base = process.env.YOUTUBE_OEMBED_BASE || "https://www.youtube.com/oembed";
  try {
    const res = await fetch(`${base}?url=${encodeURIComponent(youtubeWatchUrl(id))}&format=json`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const { title } = await res.json();
    return typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : null;
  } catch {
    return null;
  }
}

// Miniature (JPEG) : la plus grande disponible, ou null. 2 Mo max.
export async function fetchYouTubeThumbnail(id) {
  const base = process.env.YOUTUBE_THUMB_BASE || "https://i.ytimg.com/vi";
  for (const name of ["maxresdefault", "hqdefault"]) {
    try {
      const res = await fetch(`${base}/${id}/${name}.jpg`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 100 && buf.length <= 2 * 1024 * 1024) return buf;
    } catch {}
  }
  return null;
}
