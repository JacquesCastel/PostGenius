import { NextResponse } from "next/server";
import sharp from "sharp";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { saveImage } from "@/lib/image";

// Analyse le lien d'un événement : récupère le titre, l'image (og:image)
// et une description pour nourrir la génération des posts.

// Beaucoup de sites servent leur og:image avec des en-têtes qui empêchent son
// affichage direct en <img> (Content-Disposition: attachment, Cross-Origin-
// Resource-Policy: same-site, ex. snowflake.com) -- on la rapatrie donc sur
// notre propre stockage plutôt que de la référencer telle quelle.
async function rehostImage(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: { "User-Agent": "LinkeePost/1.0 (analyse evenement)" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`code ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const png = await sharp(buf).png().toBuffer();
  const saved = await saveImage(png.toString("base64"));
  return saved.url;
}

function meta(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  let { url } = await req.json();
  url = (url || "").trim();
  if (!url) return NextResponse.json({ error: "Indiquez le lien de l'événement." }, { status: 400 });
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Lien invalide." }, { status: 400 });
  }

  let html = "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "LinkeePost/1.0 (analyse evenement)" },
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`code ${res.status}`);
    html = await res.text();
  } catch (e) {
    return NextResponse.json({ error: `Impossible de lire le lien (${e.message}).` }, { status: 502 });
  }

  const name = meta(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<title[^>]*>([^<]+)<\/title>/i,
  ]);
  let imageUrl = meta(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ]);
  // Rendre l'URL d'image absolue si relative
  if (imageUrl && !/^https?:\/\//i.test(imageUrl)) {
    try {
      imageUrl = new URL(imageUrl, url).href;
    } catch {
      imageUrl = "";
    }
  }
  // Repli : la page de l'événement n'a pas sa propre og:image (fréquent pour une
  // page "détail" sans visuel dédié) -- on reprend l'image par défaut du site
  // (og:image de la page d'accueil du domaine), si elle existe.
  if (!imageUrl) {
    try {
      const origin = new URL(url).origin;
      if (origin + "/" !== url) {
        const homeRes = await fetch(origin, {
          headers: { "User-Agent": "LinkeePost/1.0 (analyse evenement)" },
          signal: AbortSignal.timeout(10000),
          redirect: "follow",
        });
        if (homeRes.ok) {
          const homeHtml = await homeRes.text();
          let siteImageUrl = meta(homeHtml, [
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
            /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
          ]);
          if (siteImageUrl && !/^https?:\/\//i.test(siteImageUrl)) {
            siteImageUrl = new URL(siteImageUrl, origin).href;
          }
          if (siteImageUrl) imageUrl = siteImageUrl;
        }
      }
    } catch {
      // Repli best-effort : on continue sans image plutôt que d'échouer l'analyse.
    }
  }
  if (imageUrl) {
    try {
      imageUrl = await rehostImage(imageUrl);
    } catch {
      // Rapatriement best-effort : on garde l'URL externe telle quelle si ça échoue
      // (ne s'affichera pas pour les sites à protection anti-hotlink, mais ne bloque
      // pas l'analyse pour les autres).
    }
  }
  const description = meta(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);

  const text = htmlToText(html).slice(0, 1500);
  const details = [description, text].filter(Boolean).join(" — ").slice(0, 1800);

  return NextResponse.json({
    fields: { name, imageUrl, details },
  });
}
