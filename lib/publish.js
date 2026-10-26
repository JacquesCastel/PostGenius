import { prisma } from "./db";
import { decryptToken } from "./crypto";
import fs from "fs/promises";
import { readImageFromUrl } from "./image";
import { videoPathFromUrl } from "./video";
import { sanitizeMentions, buildCommentary } from "./mentions";
import { sendComment } from "./linkedinSocial";
import { imagesToPdf } from "./pdf";
import { personalProfileBlocked, CLIENT_PROFILE_BLOCKED } from "./clientAccount";
import { cleanPoll, cleanSlides, pollProblem } from "./postExtras";
import { parseYouTubeId, youtubeWatchUrl, fetchYouTubeTitle, fetchYouTubeThumbnail } from "./youtube";

// Moteur de publication LinkedIn — partagé entre la publication manuelle
// (route /api/linkedin/publish) et la publication programmée (cron).

// LinkedIn impose d'échapper certains caractères dans "commentary"
const esc = (t) => t.replace(/[\\|{}@\[\]()<>#*_~]/g, (c) => "\\" + c);
// « #mot » (sans chiffre seul ni « # » collé à une lettre : C#, ancre d'adresse) : LinkedIn ne le reconnaît comme hashtag cliquable
// que sous la forme {hashtag|\#|mot} ; un « # » simplement échappé s'afficherait en texte brut.
export const HASHTAG_RE = /(?<![\p{L}\p{N}_&#\/\\])#([\p{L}\p{N}]*\p{L}[\p{L}\p{N}]*)/gu;
export function escapeCommentary(text) {
  let out = "";
  let pos = 0;
  for (const m of text.matchAll(HASHTAG_RE)) {
    out += esc(text.slice(pos, m.index)) + `{hashtag|\\#|${esc(m[1])}}`;
    pos = m.index + m[0].length;
  }
  return out + esc(text.slice(pos));
}

// Premier commentaire, posté par l'auteur juste après la publication. Un échec ne fait jamais échouer le post : on le signale seulement.
// LinkedIn met parfois un instant à reconnaître le post : un seul nouvel essai après une courte pause.
async function postFirstComment({ token, actor, postUrn, text }) {
  let last = "";
  for (let i = 0; i < 2; i++) {
    try {
      const { res, via } = await sendComment({ token, actor, urn: postUrn, text });
      if (res.ok) return { ok: true };
      const raw = await res.text();
      console.warn(`LinkedIn premier commentaire (${via}):`, res.status, raw.slice(0, 200));
      last = `LinkedIn a refusé le commentaire (${res.status}).`;
      if (i === 0 && (res.status === 404 || res.status === 422 || res.status >= 500)) { await new Promise((r) => setTimeout(r, 2500)); continue; }
      break;
    } catch (e) {
      last = "Le commentaire n'a pas pu être envoyé.";
      console.warn("LinkedIn premier commentaire :", e.message);
      break;
    }
  }
  return { ok: false, error: last };
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

// Document (PDF) : upload via l'API Documents de LinkedIn, renvoie l'URN du document.
export async function uploadDocument({ buf, owner, token, liHeaders }) {
  const initRes = await fetch(`${LI_API}/rest/documents?action=initializeUpload`, {
    method: "POST",
    headers: liHeaders,
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  if (!initRes.ok) {
    console.error("LinkedIn document initializeUpload:", initRes.status, await initRes.text());
    throw new Error(`LinkedIn a refusé l'envoi du carrousel en PDF (${initRes.status}).`);
  }
  const { value } = await initRes.json(); // { uploadUrl, document }
  const upRes = await fetch(value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: buf,
  });
  if (!upRes.ok) {
    console.error("LinkedIn document upload:", upRes.status, await upRes.text());
    throw new Error(`Échec du transfert du PDF vers LinkedIn (${upRes.status}).`);
  }
  return value.document;
}

export async function publishForUser(userId, { text, author = "person", imageUrl = null, videoUrl = null, youtubeUrl = null, mentions = [], poll = null, documentSlides = null, documentTitle = null, firstComment = null }) {
  if (!text?.trim()) throw new Error("Texte du post vide.");

  // Pages mentionnées (« @Nom » → @[Nom](urn)) ; si LinkedIn refuse la mention, le post part sans elle (voir plus bas)
  let mentionList = sanitizeMentions(mentions);
  const plain = escapeCommentary(text);
  let commentary = mentionList.length ? buildCommentary(text, mentionList, escapeCommentary) : plain;
  if (commentary.length > 3000) {
    throw new Error(`Post trop long : ${commentary.length} caractères après échappement (max 3000).`);
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });

  let finalAuthor, token;
  let personMentionsSkipped = false;
  if (author && author !== "person") {
    if (!/^urn:li:organization:\d+$/.test(author)) throw new Error("Auteur invalide.");
    finalAuthor = author;
    token = decryptToken(acc?.orgToken);
    if (!token) throw new Error("Page entreprise non connectée.");
    if (acc.orgExpiresAt && acc.orgExpiresAt < new Date())
      throw new Error("Token de la page entreprise expiré — reconnectez-la.");
  } else {
    if (await personalProfileBlocked(userId)) throw new Error(CLIENT_PROFILE_BLOCKED);
    // Mention d'une personne : son identifiant vient de l'application des pages, il n'est reconnu que si le post est publié par cette même
    // application (profil connecté via auth-member). Sans cette connexion valable, le post part par la connexion habituelle (mention non reconnue → repli).
    const hasPersonMention = mentionList.some((m) => m.urn.startsWith("urn:li:person:"));
    const memberToken = hasPersonMention && acc?.memberSub && (!acc.memberExpiresAt || acc.memberExpiresAt > new Date()) ? decryptToken(acc.memberToken) : null;
    if (memberToken) {
      token = memberToken;
      finalAuthor = `urn:li:person:${acc.memberSub}`;
    } else {
      // Sans la connexion du profil par l'application des pages, LinkedIn ne reconnaît pas la mention d'une personne et publierait le balisage tel
      // quel : on retire ces mentions (le nom reste en texte simple) et on le signale.
      if (hasPersonMention) {
        mentionList = mentionList.filter((m) => !m.urn.startsWith("urn:li:person:"));
        commentary = mentionList.length ? buildCommentary(text, mentionList, escapeCommentary) : plain;
        personMentionsSkipped = true;
      }
      token = decryptToken(acc?.personToken);
      if (!token || !acc?.personSub) throw new Error("Compte LinkedIn non connecté.");
      if (acc.personExpiresAt && acc.personExpiresAt < new Date())
        throw new Error("Token LinkedIn expiré — reconnectez votre compte.");
      finalAuthor = `urn:li:person:${acc.personSub}`;
    }
  }

  const liHeaders = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  // Image jointe : upload préalable via l'API Images de LinkedIn
  let content;
  const pollData = poll ? cleanPoll(poll) : null;
  const slides = cleanSlides(documentSlides);
  if (poll && !pollData) throw new Error(pollProblem(poll) || "Sondage incomplet.");
  if (pollData) {
    // Sondage : remplace toute autre pièce jointe (LinkedIn n'en accepte qu'une par post)
    content = { poll: { question: pollData.question, options: pollData.options.map((text) => ({ text })), settings: { duration: pollData.duration } } };
  } else if (slides.length) {
    // Carrousel : les images des slides sont assemblées en PDF, publié comme document
    let buf;
    try {
      buf = await imagesToPdf(await Promise.all(slides.map((u) => readImageFromUrl(u))));
    } catch {
      throw new Error("Images du carrousel introuvables sur le serveur — régénérez-les.");
    }
    const title = String(documentTitle ?? "").replace(/\s+/g, " ").trim().slice(0, 100) || text.split("\n")[0].slice(0, 100) || "Carrousel";
    content = { media: { title, id: await uploadDocument({ buf, owner: finalAuthor, token, liHeaders }) } };
  } else if (videoUrl) {
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

  const postId = res.headers.get("x-restli-id");
  const fcText = String(firstComment ?? "").trim().slice(0, 1250);
  const firstCommentResult = fcText && postId ? await postFirstComment({ token, actor: finalAuthor, postUrn: postId, text: fcText }) : null;
  return { postId, mentionsDropped, personMentionsSkipped, ...(firstCommentResult ? { firstComment: firstCommentResult } : {}) };
}
