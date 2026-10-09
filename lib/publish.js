import { prisma } from "./db";
import { decryptToken } from "./crypto";
import fs from "fs/promises";
import { readImageFromUrl } from "./image";
import { videoPathFromUrl } from "./video";
import { sanitizeMentions, buildCommentary } from "./mentions";
import { parseYouTubeId, youtubeWatchUrl, fetchYouTubeTitle, fetchYouTubeThumbnail } from "./youtube";

// Moteur de publication LinkedIn — partagé entre la publication manuelle
// (route /api/linkedin/publish) et la publication programmée (cron).

// LinkedIn impose d'échapper certains caractères dans "commentary"
export function escapeCommentary(text) {
  return text.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c);
}

// Publie un post pour un utilisateur donné.
// author : "person" ou "urn:li:organization:ID"
// Renvoie { postId } ou lève une Error avec un message lisible.
const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";

// Vidéo : upload par morceaux via l'API Videos de LinkedIn (le fichier est lu par
// tranches, jamais entièrement en mémoire), puis attente du traitement.
async function uploadVideo({ filePath, owner, token, liHeaders }) {
  const { size } = await fs.stat(filePath);
  const initRes = await fetch(`${LI_API}/rest/videos?action=initializeUpload`, {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({
      initializeUploadRequest: { owner, fileSizeBytes: size, uploadCaptions: false, uploadThumbnail: false },
    }),
  });
  if (!initRes.ok) {
    console.error("LinkedIn video initializeUpload:", initRes.status, await initRes.text());
    throw new Error(`LinkedIn a refusé l'upload de la vidéo (${initRes.status}).`);
  }
  const { value } = await initRes.json(); // { video, uploadToken, uploadInstructions: [{uploadUrl, firstByte, lastByte}] }

  const fh = await fs.open(filePath, "r");
  const partIds = [];
  try {
    for (const part of value.uploadInstructions) {
      const len = part.lastByte - part.firstByte + 1;
      const buf = Buffer.alloc(len);
      await fh.read(buf, 0, len, part.firstByte);
      const upRes = await fetch(part.uploadUrl, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
        body: buf,
      });
      if (!upRes.ok) {
        console.error("LinkedIn video upload:", upRes.status, await upRes.text());
        throw new Error(`Échec du transfert de la vidéo vers LinkedIn (${upRes.status}).`);
      }
      partIds.push(upRes.headers.get("etag")?.replace(/"/g, "") ?? "");
    }
  } finally {
    await fh.close();
  }

  const finRes = await fetch(`${LI_API}/rest/videos?action=finalizeUpload`, {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({
      finalizeUploadRequest: { video: value.video, uploadToken: value.uploadToken ?? "", uploadedPartIds: partIds },
    }),
  });
  if (!finRes.ok) {
    console.error("LinkedIn video finalizeUpload:", finRes.status, await finRes.text());
    throw new Error(`LinkedIn n'a pas validé la vidéo (${finRes.status}).`);
  }

  // Traitement côté LinkedIn : on attend jusqu'à ~2 min. Au-delà, on publie quand
  // même (LinkedIn affiche la vidéo dès qu'elle est prête).
  for (let i = 0; i < 40; i++) {
    const st = await fetch(`${LI_API}/rest/videos/${encodeURIComponent(value.video)}`, { headers: liHeaders });
    if (st.ok) {
      const { status } = await st.json();
      if (status === "AVAILABLE") break;
      if (status === "PROCESSING_FAILED") throw new Error("LinkedIn n'a pas pu traiter cette vidéo (format ou codec non pris en charge).");
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return value.video;
}

// Image : upload via l'API Images de LinkedIn, renvoie l'URN de l'image.
export async function uploadImage({ buf, owner, token, liHeaders }) {
  const initRes = await fetch(`${LI_API}/rest/images?action=initializeUpload`, {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
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
  return value.image;
}

export async function publishForUser(userId, { text, author = "person", imageUrl = null, videoUrl = null, youtubeUrl = null, mentions = [] }) {
  if (!text?.trim()) throw new Error("Texte du post vide.");

  // Pages mentionnées (« @Nom » → @[Nom](urn)) ; si LinkedIn refuse la mention, le post part sans elle (voir plus bas)
  const mentionList = sanitizeMentions(mentions);
  const plain = escapeCommentary(text);
  let commentary = mentionList.length ? buildCommentary(text, mentionList, escapeCommentary) : plain;
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
  if (videoUrl) {
    // Une seule pièce jointe par post : la vidéo remplace l'image
    let filePath;
    try {
      filePath = videoPathFromUrl(videoUrl, userId);
      await fs.access(filePath);
    } catch {
      throw new Error("Vidéo du post introuvable sur le serveur — ajoutez-la à nouveau.");
    }
    const video = await uploadVideo({ filePath, owner: finalAuthor, token, liHeaders });
    content = { media: { id: video } };
  } else if (youtubeUrl) {
    // Lien YouTube : carte « article » (LinkedIn n'intègre pas le lecteur). Titre via
    // oEmbed, miniature envoyée à LinkedIn ; sans l'un ou l'autre, la carte reste valide.
    const id = parseYouTubeId(youtubeUrl);
    if (!id) throw new Error("Lien YouTube invalide.");
    const title = (await fetchYouTubeTitle(id)) ?? "Vidéo YouTube";
    const article = { source: youtubeWatchUrl(id), title };
    const thumb = await fetchYouTubeThumbnail(id);
    if (thumb) {
      try {
        article.thumbnail = await uploadImage({ buf: thumb, owner: finalAuthor, token, liHeaders });
      } catch (e) {
        console.error("Miniature YouTube non envoyée :", e.message);
      }
    }
    content = { article };
  } else if (imageUrl) {
    let buf;
    try {
      buf = await readImageFromUrl(imageUrl);
    } catch {
      throw new Error("Image du post introuvable sur le serveur — régénérez-la.");
    }
    content = { media: { id: await uploadImage({ buf, owner: finalAuthor, token, liHeaders }) } };
  }

  const send = (commentaryText) => fetch(`${LI_API}/rest/posts`, {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({
      author: finalAuthor,
      commentary: commentaryText,
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
  let res = await send(commentary);
  let mentionsDropped = false;
  // Mention refusée (nom différent de celui de la page, page introuvable…) : on republie une fois sans mention plutôt que de perdre le post
  if ((res.status === 400 || res.status === 422) && commentary !== plain) {
    console.error("LinkedIn a refusé la mention, nouvel essai sans mention :", res.status, await res.text());
    res = await send(plain);
    mentionsDropped = true;
  }

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

  return { postId: res.headers.get("x-restli-id"), mentionsDropped };
}
