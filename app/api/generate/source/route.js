import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkAccess } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { fetchPageText } from "@/lib/knowledge";
import { extractDocumentText, DocError, MAX_FILE_BYTES } from "@/lib/docExtract";
import { sourceMaterial, MIN_SOURCE_CHARS } from "@/lib/generationSource";

export const maxDuration = 60;

// Lecture de la matière source d'un post libre : un article (JSON { url }) ou un document PDF ou Word
// (multipart, champ « file »). Rien n'est enregistré et aucun appel IA n'est fait : on renvoie le texte lu,
// que l'interface joint ensuite à la demande de génération. Mêmes garde-fous que la base de connaissances
// (adresse publique uniquement, type du fichier reconnu sur ses octets, limites de taille).

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const access = await checkAccess(userId);
  if (!access.ok) return NextResponse.json({ error: access.error, code: access.code }, { status: 403 });
  if (!rateLimit(`gen-source:${userId}`, { limit: 20, windowMs: 3600_000 })) {
    return NextResponse.json({ error: "Trop de lectures pour l'instant. Réessayez dans une heure." }, { status: 429 });
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 200_000) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo au maximum)." }, { status: 413 });

  try {
    const type = req.headers.get("content-type") ?? "";
    let title = "";
    let origin = "";
    let text = "";

    if (type.includes("multipart/form-data")) {
      let form;
      try {
        form = await req.formData();
      } catch {
        return NextResponse.json({ error: "Envoi du fichier illisible." }, { status: 400 });
      }
      const file = form.get("file");
      if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
        return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo au maximum)." }, { status: 413 });
      const doc = await extractDocumentText(Buffer.from(await file.arrayBuffer()));
      const name = String(file.name ?? "document").replace(/[\u0000-\u001F\\/]/g, "").slice(0, 120) || "document";
      title = name.replace(/\.(pdf|docx)$/i, "");
      origin = `${name} (${doc.kind === "pdf" ? "PDF" : "Word"})`;
      text = doc.text;
    } else {
      const { url } = await req.json().catch(() => ({}));
      if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) {
        return NextResponse.json({ error: "Collez l'adresse complète de l'article (https://…)." }, { status: 400 });
      }
      const page = await fetchPageText(url.trim());
      title = page.title;
      origin = new URL(url.trim()).hostname.replace(/^www\./, "");
      text = page.text;
    }

    const material = sourceMaterial({ title, origin, text });
    if (material.text.length < MIN_SOURCE_CHARS) {
      return NextResponse.json({ error: "Ce contenu ne contient pas assez de texte lisible pour écrire un post." }, { status: 422 });
    }
    return NextResponse.json({ ...material, kind: type.includes("multipart/form-data") ? "file" : "link" });
  } catch (e) {
    const status = e instanceof DocError ? 400 : 502;
    if (!(e instanceof DocError) && !/adresse|page|joindre|répond|lisible|Seules/i.test(e.message)) console.error("Erreur lecture de la matière source:", e);
    return NextResponse.json({ error: e.message || "Lecture impossible." }, { status });
  }
}
