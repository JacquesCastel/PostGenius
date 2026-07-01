import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";

// Analyse le lien d'un événement : récupère le titre, l'image (og:image)
// et une description pour nourrir la génération des posts.

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
