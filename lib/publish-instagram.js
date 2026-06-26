import { prisma } from "./db";
import { decryptToken } from "./crypto";

const GRAPH = "https://graph.instagram.com";

// Caption Instagram : max 2200 caractères.
function sanitizeCaption(text) {
  if (!text) throw new Error("Texte du post vide.");
  return text.length > 2200 ? text.slice(0, 2197) + "…" : text;
}

// Publie un post image sur Instagram Business/Creator via Instagram Login.
// imageUrl doit être une URL PUBLIQUE (https://...).
// En local (localhost), Instagram ne peut pas accéder à l'image — testez en prod.
//
// Renvoie { igPostId } ou lève une Error avec un message lisible.
export async function publishToInstagram(userId, { text, imageUrl }) {
  const caption = sanitizeCaption(text);

  if (!imageUrl) {
    throw new Error(
      "Instagram nécessite une image pour publier sur le feed. Générez une image avant de publier."
    );
  }

  // L'image doit être accessible publiquement
  const appUrl = process.env.APP_URL || "";
  let publicImageUrl = imageUrl;
  if (imageUrl.startsWith("/")) {
    if (!appUrl.startsWith("https://")) {
      throw new Error(
        "La publication Instagram n'est disponible qu'en production (l'image doit être accessible publiquement)."
      );
    }
    publicImageUrl = appUrl + imageUrl;
  }

  const account = await prisma.instagramAccount.findUnique({ where: { userId } });
  if (!account) throw new Error("Compte Instagram non connecté.");

  const token = decryptToken(account.pageToken);
  if (!token) throw new Error("Token Instagram invalide — reconnectez votre compte.");

  // Vérification expiration
  if (account.expiresAt && account.expiresAt < new Date()) {
    throw new Error("Token Instagram expiré — reconnectez votre compte Instagram.");
  }

  const igUserId = account.igUserId;

  // Étape 1 : créer le conteneur média
  const containerRes = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: publicImageUrl,
      caption,
      access_token: token,
    }),
  });
  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}));
    const detail = err?.error?.message || containerRes.status;
    throw new Error(`Instagram a refusé la création du post (${detail}).`);
  }
  const { id: creationId } = await containerRes.json();

  // Étape 2 : publier le conteneur
  const publishRes = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  });
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}));
    const detail = err?.error?.message || publishRes.status;
    throw new Error(`Instagram a refusé la publication (${detail}).`);
  }
  const { id: igPostId } = await publishRes.json();
  return { igPostId };
}
