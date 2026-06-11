import { prisma } from "./db";
import { decryptToken } from "./crypto";
import { readImageFromUrl } from "./image";

// Moteur de publication LinkedIn — partagé entre la publication manuelle
// (route /api/linkedin/publish) et la publication programmée (cron).

// LinkedIn impose d'échapper certains caractères dans "commentary"
export function escapeCommentary(text) {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c);
}

// Publie un post pour un utilisateur donné.
// author : "person" ou "urn:li:organization:ID"
// Renvoie { postId } ou lève une Error avec un message lisible.
export async function publishForUser(userId, { text, author = "person", imageUrl = null }) {
  if (!text?.trim()) throw new Error("Texte du post vide.");

  const commentary = escapeCommentary(text);
  if (commentary.length > 3000) {
    throw new Error(`Post trop long : ${commentary.length} caractères après échappement (max 3000).`);
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });

  let finalAuthor, token;
  if (author && author !== "person") {
    if (!/^urn:li:organization:\d+$/.test(author)) throw new Error("Auteur invalide.");
    finalAuthor = author;
    token = decryptToken(acc?.orgToken);
    if (!token) throw new Error("Page entreprise non connectée.");
    if (acc.orgExpiresAt && acc.orgExpiresAt < new Date())
      throw new Error("Token de la page entreprise expiré — reconnectez-la.");
  } else {
    token = decryptToken(acc?.personToken);
    if (!token || !acc?.personSub) throw new Error("Compte LinkedIn non connecté.");
    if (acc.personExpiresAt && acc.personExpiresAt < new Date())
      throw new Error("Token LinkedIn expiré — reconnectez votre compte.");
    finalAuthor = `urn:li:person:${acc.personSub}`;
  }

  const liHeaders = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  // Image jointe : upload préalable via l'API Images de LinkedIn
  let content;
  if (imageUrl) {
    let buf;
    try {
      buf = await readImageFromUrl(imageUrl);
    } catch {
      throw new Error("Image du post introuvable sur le serveur — régénérez-la.");
    }
    const initRes = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
      method: "POST",
      headers: liHeaders,
      body: JSON.stringify({ initializeUploadRequest: { owner: finalAuthor } }),
    });
    if (!initRes.ok) {
      console.error("LinkedIn initializeUpload:", initRes.status, await initRes.text());
      throw new Error(`LinkedIn a refusé l'upload de l'image (${initRes.status}).`);
    }
    const { value } = await initRes.json(); // { uploadUrl, image }
    const upRes = await fetch(value.uploadUrl, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
      body: buf,
    });
    if (!upRes.ok) {
      console.error("LinkedIn upload binaire:", upRes.status, await upRes.text());
      throw new Error(`Échec du transfert de l'image vers LinkedIn (${upRes.status}).`);
    }
    content = { media: { id: value.image } };
  }

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({
      author: finalAuthor,
      commentary,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    }),
  });

  if (res.status === 401) throw new Error("Session LinkedIn expirée — reconnectez le compte.");
  if (!res.ok) {
    const raw = await res.text();
    console.error("Erreur publication LinkedIn:", res.status, raw);
    let detail = raw;
    try {
      detail = JSON.parse(raw).message ?? raw;
    } catch {}
    if (res.status === 422 && /duplicate/i.test(detail)) {
      throw new Error("LinkedIn refuse les posts au contenu identique à un post récent.");
    }
    throw new Error(`LinkedIn a refusé la publication (${res.status}) : ${detail}`);
  }

  return { postId: res.headers.get("x-restli-id") };
}
