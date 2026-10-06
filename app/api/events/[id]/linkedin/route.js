import { NextResponse } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { checkFeature } from "@/lib/gating";
import { decryptToken } from "@/lib/crypto";
import { readImageFromUrl } from "@/lib/image";
import { uploadImage } from "@/lib/publish";
import { buildEventBody, buildPatch, createEventResilient, postEvent, updateEvent, deleteEventPost } from "@/lib/linkedinEvents";

// Événement LinkedIn d'un événement du module (salon, forum…) — Events Management API.
//   POST   : crée l'événement sur LinkedIn, puis le poste pour le rendre visible
//   PATCH  : met à jour les champs modifiables (tant que l'événement n'a pas commencé)
//   DELETE : supprime le post, ce qui supprime l'événement
// Connexion membre (jeton du profil) avec la permission rw_events : ajouter rw_events à
// LINKEDIN_SCOPES et reconnecter le compte LinkedIn.

// « partnerApiEvents » : LinkedIn n'ouvre l'API des événements qu'à une application dotée du produit
// « Events Management API ». Deux causes possibles, que seul le portail LinkedIn permet de départager.
function explain403(e) {
  if (e.status === 403 && /partnerApiEvents/i.test(e.raw ?? "")) {
    return `${e.message} Causes possibles : (1) la connexion LinkedIn n'a pas la permission rw_events (reconnectez après avoir ajouté rw_events à LINKEDIN_SCOPES) ; (2) l'accès « Events Management API » n'est pas actif sur l'application LinkedIn utilisée pour se connecter : comparez le numéro d'application du mail de LinkedIn avec celui de cette application (portail LinkedIn, Settings).`;
  }
  return null;
}

const MIN_COVER_WIDTH = 480; // largeur minimale de la photo de couverture imposée par LinkedIn

async function context(req, params) {
  const userId = await getUserId(req);
  if (!userId) return { error: "Non connecté.", status: 401 };
  const feat = await checkFeature(userId, "events", "Le module Événements");
  if (!feat.ok) return { error: feat.error, status: 403 };

  const { id } = await params;
  const event = await prisma.event.findFirst({ where: { id, userId } });
  if (!event) return { error: "Événement introuvable.", status: 404 };

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.personToken);
  if (!token || !acc?.personSub) return { error: "Compte LinkedIn non connecté (onglet Profil).", status: 401 };
  if (acc.personExpiresAt && acc.personExpiresAt < new Date()) {
    return { error: "Session LinkedIn expirée — reconnectez votre compte (onglet Profil).", status: 401 };
  }
  // Le jeton du profil doit porter rw_events. LinkedIn indique les permissions accordées à la
  // connexion (mémorisées depuis la PR « diagnostic ») : inutile d'appeler LinkedIn si elle manque.
  if (acc.personScope && !acc.personScope.split(/[\s,]+/).includes("rw_events")) {
    return {
      error: `Votre connexion LinkedIn n'a pas la permission « rw_events » (permissions accordées : ${acc.personScope.replace(/[\s,]+/g, ", ")}). Ajoutez rw_events à LINKEDIN_SCOPES sur le serveur, puis reconnectez LinkedIn (onglet Profil).`,
      status: 403,
    };
  }
  return { userId, event, token, personUrn: `urn:li:person:${acc.personSub}` };
}

// Photo de couverture : l'image rapatriée de l'événement, si elle respecte la largeur minimale.
// Renvoie { urn } ou { note } (raison pour laquelle l'image par défaut de LinkedIn sera utilisée).
async function uploadCover({ event, token, owner }) {
  if (!event.imageUrl) return { note: "Pas d'image sur la fiche : image par défaut de LinkedIn." };
  let buf;
  try {
    buf = await readImageFromUrl(event.imageUrl);
  } catch {
    return { note: "Image de la fiche introuvable sur le serveur : image par défaut de LinkedIn." };
  }
  try {
    const { width } = await sharp(buf).metadata();
    if (!width || width < MIN_COVER_WIDTH) {
      return { note: `Image trop étroite (${width ?? "?"} px, minimum ${MIN_COVER_WIDTH}) : image par défaut de LinkedIn.` };
    }
    const liHeaders = {
      Authorization: `Bearer ${token}`,
      "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    };
    // L'API Images renvoie « urn:li:image:{id} » ; l'événement attend « urn:li:digitalmediaAsset:{id} »
    // (LinkedIn : « Invalid Urn format. Invalid prefix »). L'identifiant est le même, seul le préfixe change.
    const imageUrn = await uploadImage({ buf, owner, token, liHeaders });
    return { urn: imageUrn.replace(/^urn:li:image:/, "urn:li:digitalmediaAsset:") };
  } catch (e) {
    return { note: `Image de couverture non envoyée (${e.message}) : image par défaut de LinkedIn.` };
  }
}

function readOptions(body, personUrn, event) {
  const organizer = !body.organizer || body.organizer === "person" ? personUrn : body.organizer;
  return {
    event,
    organizer,
    type: body.type,
    tz: body.tz,
    startTime: body.startTime,
    endTime: body.endTime,
    description: typeof body.description === "string" ? body.description.slice(0, 5000) : "",
    discoveryMode: body.discoveryMode,
  };
}

const publicFields = (e) => ({
  linkedinEventId: e.linkedinEventId,
  linkedinPostUrn: e.linkedinPostUrn,
  linkedinEventType: e.linkedinEventType,
  linkedinOrganizer: e.linkedinOrganizer,
  linkedinAt: e.linkedinAt,
});

export async function POST(req, { params }) {
  const ctx = await context(req, params);
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { event, token, personUrn, userId } = ctx;
  if (event.linkedinEventId) return NextResponse.json({ error: "Cet événement existe déjà sur LinkedIn." }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const opts = readOptions(body, personUrn, event);

  // Validation avant tout appel à LinkedIn (et avant l'envoi de l'image)
  const check = buildEventBody(opts);
  if (check.error) return NextResponse.json({ error: check.error }, { status: 400 });

  try {
    let cover = { note: "Image par défaut de LinkedIn (option décochée)." };
    if (body.useImage !== false) cover = await uploadCover({ event, token, owner: opts.organizer });

    // LinkedIn répond parfois 500 sans préciser le champ : variantes successives (voir createEventResilient)
    const created = await createEventResilient(
      token,
      (variant) => buildEventBody({ ...opts, ...variant }).body,
      { backgroundImage: cover.urn, discoveryMode: opts.discoveryMode }
    );
    const eventId = created.eventId;
    const imageNote = created.imageNote ?? cover.note ?? null;

    // Création réussie : l'événement est invisible tant qu'il n'est pas posté
    let postUrn;
    try {
      postUrn = await postEvent(token, { author: opts.organizer, eventId, commentary: body.commentary });
    } catch (e) {
      await prisma.event.update({
        where: { id: event.id },
        data: { linkedinEventId: eventId, linkedinEventType: opts.type, linkedinOrganizer: opts.organizer, linkedinAt: new Date() },
      });
      e.message = `${e.message} L'événement est créé sur LinkedIn mais pas encore visible : réessayez la publication.`;
      throw e;
    }

    const updated = await prisma.event.update({
      where: { id: event.id },
      data: {
        linkedinEventId: eventId,
        linkedinPostUrn: postUrn,
        linkedinEventType: opts.type,
        linkedinOrganizer: opts.organizer,
        linkedinAt: new Date(),
      },
    });
    console.log(`[events] ${userId} : événement LinkedIn ${eventId} créé (${opts.type}, organisateur ${opts.organizer})`);
    return NextResponse.json({ ok: true, event: publicFields(updated), imageNote });
  } catch (e) {
    const status = e.status === 401 ? 401 : e.status === 403 ? 403 : e.status === 400 || e.status === 422 ? 400 : 502;
    return NextResponse.json({ error: explain403(e) || e.message || "Échec de la création sur LinkedIn." }, { status });
  }
}

export async function PATCH(req, { params }) {
  const ctx = await context(req, params);
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { event, token, personUrn } = ctx;
  if (!event.linkedinEventId || !event.linkedinPostUrn) {
    return NextResponse.json({ error: "Cet événement n'est pas (encore) publié sur LinkedIn." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  // Organisateur et type ne changent jamais après création : on reprend ceux de l'événement
  const opts = { ...readOptions(body, personUrn, event), organizer: event.linkedinOrganizer, type: event.linkedinEventType };
  const built = buildEventBody(opts);
  if (built.error) return NextResponse.json({ error: built.error }, { status: 400 });

  try {
    await updateEvent(token, event.linkedinEventId, buildPatch(built.body));
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e.status === 401 ? 401 : e.status === 403 ? 403 : e.status === 400 ? 400 : 502;
    return NextResponse.json({ error: e.message || "Échec de la mise à jour sur LinkedIn." }, { status });
  }
}

export async function DELETE(req, { params }) {
  const ctx = await context(req, params);
  if (ctx.error) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { event, token } = ctx;
  if (!event.linkedinPostUrn) return NextResponse.json({ error: "Rien à supprimer sur LinkedIn." }, { status: 400 });

  try {
    await deleteEventPost(token, event.linkedinPostUrn);
  } catch (e) {
    return NextResponse.json(
      { error: `${e.message} Vous pouvez supprimer l'événement directement dans LinkedIn.` },
      { status: e.status === 401 ? 401 : 502 }
    );
  }
  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { linkedinEventId: null, linkedinPostUrn: null, linkedinEventType: null, linkedinOrganizer: null, linkedinAt: null },
  });
  return NextResponse.json({ ok: true, event: publicFields(updated) });
}
