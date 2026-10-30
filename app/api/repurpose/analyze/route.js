import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature, limitBody } from "@/lib/gating";
import { rateLimit } from "@/lib/ratelimit";
import { readContent, analyzeContent, cleanRights, cleanSpeakers, RepurposeError, MIN_CONTENT_CHARS } from "@/lib/repurpose";
import { createKnowledgeSource, guardKnowledgeAdd } from "@/lib/knowledge";
import { MAX_FILE_BYTES } from "@/lib/docExtract";

// Seconde vie d'un contenu, étape 1 : lecture d'un lien, d'un fichier (PDF, Word) ou d'un texte, puis faits et angles proposés.
// JSON { kind: "link" | "text", url | text, title?, addToDatalake?, contextId? } ou multipart (kind=file, file, …).

export const maxDuration = 120;

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const feat = await checkFeature(userId, "campaigns", "L'outil « Seconde vie d'un contenu »");
  if (!feat.ok) return NextResponse.json(limitBody(feat), { status: 403 });
  if (!rateLimit(`repurpose-analyze:${userId}`, { limit: Number(process.env.REPURPOSE_ANALYZE_LIMIT) || 20, windowMs: 10 * 60_000 })) {
    return NextResponse.json({ error: "Trop de lectures de contenu à la suite. Réessayez dans quelques minutes." }, { status: 429 });
  }

  try {
    let input;
    let addToDatalake = false;
    let contextId = null;
    let rightsIn = {};
    let media = false; // texte issu d'une vidéo ou d'un enregistrement (transcription relue)
    let speakers = false;
    let videoUrl = null;
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const declared = Number(req.headers.get("content-length") ?? 0);
      if (declared > MAX_FILE_BYTES + 200_000) throw new RepurposeError("Fichier trop volumineux (8 Mo au maximum).", 413);
      const form = await req.formData().catch(() => null);
      const file = form?.get("file");
      if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") throw new RepurposeError("Aucun fichier reçu.");
      if (file.size > MAX_FILE_BYTES) throw new RepurposeError("Fichier trop volumineux (8 Mo au maximum).", 413);
      input = { kind: "file", title: form.get("title"), file: { name: file.name, buffer: Buffer.from(await file.arrayBuffer()) } };
      addToDatalake = form.get("addToDatalake") === "true";
      contextId = form.get("contextId") || null;
      rightsIn = { rights: form.get("rights"), credit: form.get("credit") };
    } else {
      const body = await req.json().catch(() => ({}));
      input = { kind: body.kind, url: body.url, text: body.text, title: body.title };
      addToDatalake = body.addToDatalake === true;
      contextId = body.contextId || null;
      rightsIn = { rights: body.rights, credit: body.credit };
      media = body.kind === "text" && body.media === true;
      speakers = body.speakers === true;
      // Lien public de la vidéo (facultatif) : mis en lien dans les posts, jamais lu par LinkeePost
      if (media && body.videoUrl) { try { const u = new URL(String(body.videoUrl).trim()); if (/^https?:$/.test(u.protocol) && u.href.length <= 500) videoUrl = u.href; } catch {} }
    }
    const content = await readContent(input);
    // Droits sur le contenu : à déclarer avant toute lecture par l'IA
    const rt = cleanRights({ ...rightsIn, url: content.kind === "link" ? content.origin : null });
    cleanSpeakers({ media, speakers });
    if (content.text.length < MIN_CONTENT_CHARS) throw new RepurposeError(`Ce contenu est trop court (${content.text.length} caractères) : il en faut au moins ${MIN_CONTENT_CHARS} pour en tirer des faits.`);
    const analysis = await analyzeContent(userId, { title: content.title, text: content.text, media });

    // Ajout au datalake (facultatif) : ne bloque jamais la suite
    let datalake = null;
    if (addToDatalake) {
      try {
        const quota = await guardKnowledgeAdd(userId);
        await createKnowledgeSource(userId, { kind: content.kind, origin: content.origin, title: analysis.title, text: media ? content.text.replace(/^\[\d+(?::\d{2}){1,2}\]\s*/gm, "") : content.text, contextId }, quota);
        datalake = { added: true };
      } catch (e) {
        datalake = { added: false, reason: e.message };
      }
    }
    return NextResponse.json({ source: { kind: media ? "media" : content.kind, origin: content.origin, url: media ? videoUrl : content.kind === "link" ? content.origin : null, title: analysis.title, chars: content.text.length, rights: rt.rights, credit: rt.credit }, summary: analysis.summary, facts: analysis.facts, angles: analysis.angles, datalake });
  } catch (e) {
    if (e instanceof RepurposeError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[repurpose] lecture :", e);
    return NextResponse.json({ error: "Échec de la lecture du contenu." }, { status: 500 });
  }
}
