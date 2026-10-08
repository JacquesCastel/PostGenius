import { NextResponse } from "next/server";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { createKnowledgeSource, guardKnowledgeAdd, KnowledgeError } from "@/lib/knowledge";
import { resolveSourceScope } from "@/lib/contexts";
import { extractDocumentText, DocError, MAX_FILE_BYTES } from "@/lib/docExtract";

// Ajout d'un document PDF ou Word (.docx) à la base de connaissances : multipart (champ « file », titre facultatif).
// Les contrôles (connexion, quota, cadence) passent AVANT la lecture du fichier ; le contenu est vérifié sur ses
// octets, jamais sur son nom ; le fichier lui-même n'est pas conservé, seulement son texte et son analyse.

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 200_000) return NextResponse.json({ error: "Fichier trop volumineux (8 Mo au maximum)." }, { status: 413 });

  try {
    const quota = await guardKnowledgeAdd(userId);
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

    const scope = await resolveSourceScope(userId, { contextId: form.get("contextId"), shared: form.get("shared") });
    const { kind, text } = await extractDocumentText(Buffer.from(await file.arrayBuffer()));
    const name = String(file.name ?? "document").replace(/[\u0000-\u001F\\/]/g, "").slice(0, 120) || "document";
    const title = String(form.get("title") ?? "").trim().slice(0, 120) || name.replace(/\.(pdf|docx)$/i, "");
    // « origin » garde le nom du fichier : affiché dans la liste ; « kind » reste « file » pour l'interface
    return NextResponse.json(await createKnowledgeSource(userId, { kind: "file", origin: `${name} (${kind === "pdf" ? "PDF" : "Word"})`, title, text, ...scope }, quota));
  } catch (e) {
    const status = e instanceof KnowledgeError ? e.status : e instanceof DocError ? 400 : 500;
    if (status === 500) console.error("Erreur ajout de fichier:", e);
    return NextResponse.json({ error: status === 500 ? "Échec de la lecture du fichier." : e.message, ...(e.code ? { code: e.code } : {}), ...(e.extra ?? {}) }, { status });
  }
}
