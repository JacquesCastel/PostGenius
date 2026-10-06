import { escapeCommentary } from "./publish";
import { withDetail } from "./linkedinError";

// Événements LinkedIn (Events Management API, permission rw_events, connexion membre).
// Format des requêtes : exemples de la documentation LinkedIn (POST /rest/events, puis
// POST /rest/posts avec content.reference = urn:li:event:{id} pour rendre l'événement visible).
// Un événement n'existe publiquement qu'une fois posté ; il se supprime en supprimant son post.

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
export const LOCALE = "fr_FR";
export const NAME_MAX = 75;
export const DESCRIPTION_MAX = 5000;

function headers(token, extra = {}) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
    ...extra,
  };
}

// --- Dates : « 2026-10-12 » + « 09:00 » dans un fuseau → millisecondes depuis 1970 --------
export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: tz });
    return typeof tz === "string" && tz.length > 0;
  } catch {
    return false;
  }
}

function offsetMs(instant, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant)).map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// Heure locale (dans tz) → instant UTC. Deux passes : gère l'heure d'été.
export function zonedToEpoch(dateStr, timeStr, tz) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  const t = /^(\d{2}):(\d{2})$/.exec(timeStr ?? "");
  if (!d || !t || !isValidTimeZone(tz)) return null;
  const naive = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]);
  let guess = naive - offsetMs(naive, tz);
  guess = naive - offsetMs(guess, tz);
  return Number.isFinite(guess) ? guess : null;
}

const rich = (text, loc = LOCALE) => ({ localized: { [loc]: { rawText: text } } });

// Construit le corps de création ; renvoie { body } ou { error }.
// opts : { event, organizer, type: "online"|"inPerson", date de début/fin + heures + tz, description,
//          discoveryMode, backgroundImage }
export function buildEventBody(opts, now = Date.now()) {
  const { event, organizer, type, tz, startTime, endTime, description, discoveryMode, backgroundImage, locale = LOCALE, omitDiscoveryMode } = opts;
  const name = String(event.name ?? "").trim();
  if (!name) return { error: "Le nom de l'événement est requis." };
  if (name.length > NAME_MAX) return { error: `Nom trop long pour LinkedIn : ${NAME_MAX} caractères au maximum (${name.length}).` };
  if (description && description.length > DESCRIPTION_MAX) return { error: `Description trop longue : ${DESCRIPTION_MAX} caractères au maximum.` };
  if (type !== "online" && type !== "inPerson") return { error: "Choisissez en ligne ou en personne." };
  if (!/^urn:li:(person:[\w-]+|organization:\d+)$/.test(organizer ?? "")) return { error: "Organisateur invalide." };
  if (!isValidTimeZone(tz)) return { error: "Fuseau horaire invalide." };

  const startDay = new Date(event.startDate).toISOString().slice(0, 10);
  const endDay = new Date(event.endDate ?? event.startDate).toISOString().slice(0, 10);
  const startsAt = zonedToEpoch(startDay, startTime, tz);
  const endsAt = zonedToEpoch(endDay, endTime, tz);
  if (startsAt == null) return { error: "Date ou heure de début invalide." };
  if (endsAt == null) return { error: "Date ou heure de fin invalide." };
  if (startsAt <= now) return { error: "LinkedIn n'accepte qu'un événement à venir : la date de début est passée." };
  if (endsAt <= startsAt) return { error: "La fin doit être après le début." };

  const url = String(event.url ?? "").trim();
  if (type === "online" && !/^https?:\/\//i.test(url)) {
    return { error: "Un événement en ligne a besoin du lien de la page où il se tient (champ « Lien de l'événement »)." };
  }

  const typeBody =
    type === "online"
      ? { online: { format: { external: { endsAt, url } } } }
      : {
          inPerson: {
            endsAt,
            ...(/^https?:\/\//i.test(url) ? { url } : {}),
            address: {}, // LinkedIn accepte une adresse vide ; le lieu saisi va dans « précisions sur le lieu »
            ...(event.location?.trim() ? { venueDetails: rich(event.location.trim(), locale) } : {}),
          },
        };

  return {
    body: {
      name: { localized: { [locale]: name } },
      ...(description?.trim() ? { description: rich(description.trim(), locale) } : {}),
      type: typeBody,
      organizer,
      startsAt,
      ...(omitDiscoveryMode ? {} : { discoveryMode: discoveryMode === "URL_ONLY" ? "URL_ONLY" : "LISTED" }),
      ...(backgroundImage ? { backgroundImage } : {}),
    },
    startsAt,
    endsAt,
  };
}

// Champs modifiables après création (jamais l'organisateur, le type, ni le format)
export function buildPatch(body) {
  const { name, description, startsAt, backgroundImage, discoveryMode, type } = body;
  return { patch: { $set: { name, ...(description ? { description } : {}), startsAt, ...(backgroundImage ? { backgroundImage } : {}), discoveryMode, type } } };
}

// L'identifiant LinkedIn dépasse 2^53 : on le lit dans l'en-tête x-restli-id (chaîne), ou dans le
// texte brut de la réponse, jamais via JSON.parse qui l'arrondirait.
export function readEventId(res, rawText) {
  const h = res.headers.get("x-restli-id");
  if (h && /^\d+$/.test(h)) return h;
  const m = /"id"\s*:\s*(\d{6,})/.exec(rawText ?? "");
  return m ? m[1] : null;
}

async function fail(res, what) {
  const raw = await res.text();
  console.error(`LinkedIn événement (${what}):`, res.status, raw);
  const err = new Error(withDetail(`LinkedIn a refusé ${what} (${res.status}).`, raw));
  err.status = res.status;
  err.raw = raw;
  return err;
}

export async function createEvent(token, body) {
  const res = await fetch(`${LI_API}/rest/events`, {
    method: "POST",
    headers: headers(token, { "X-RestLi-Method": "create", "X-LI-R2-W-MsgType": "REST" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error("LinkedIn événement : corps envoyé =", JSON.stringify(body));
    throw await fail(res, "la création de l'événement");
  }
  const id = readEventId(res, await res.text());
  if (!id) throw new Error("LinkedIn a créé l'événement mais n'a pas renvoyé son identifiant.");
  return id;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isServerError = (e) => e?.status >= 500;

// Création tolérante : LinkedIn répond parfois 500 (« Internal Server Error ») sur la création
// d'événement, sans dire quel champ pose problème. On essaie donc des variantes de plus en plus
// dépouillées, jusqu'à ce que LinkedIn accepte :
//   1. complet (avec l'image de couverture) ;
//   2. sans image ;
//   3. sans image ni mode de découverte (« LISTED » est la valeur par défaut de LinkedIn ; ignoré
//      si l'utilisateur a choisi URL_ONLY, pour ne jamais changer la visibilité sans le dire) ;
//   4. comme 3, avec la langue « en_US » (celle des exemples de la documentation).
// On ne poursuit que sur 400, 422 ou 5xx ; toute autre erreur (403, 401…) remonte tout de suite.
// build(variant) → corps de la requête, variant = { backgroundImage?, omitDiscoveryMode?, locale? }.
// Renvoie { eventId, imageNote, variant }.
export async function createEventResilient(token, build, { backgroundImage, discoveryMode } = {}, { pause = 1000 } = {}) {
  const steps = [];
  if (backgroundImage) steps.push({ name: "complet", variant: { backgroundImage } });
  steps.push({ name: "sans image", variant: {} });
  if (discoveryMode !== "URL_ONLY") {
    steps.push({ name: "sans mode de découverte", variant: { omitDiscoveryMode: true } });
    steps.push({ name: "sans mode de découverte, langue en_US", variant: { omitDiscoveryMode: true, locale: "en_US" } });
  }
  let last;
  for (let i = 0; i < steps.length; i++) {
    try {
      const eventId = await createEvent(token, build(steps[i].variant));
      if (i > 0) console.log(`[events] LinkedIn a accepté la variante « ${steps[i].name} » après ${i} échec(s)`);
      const imageNote =
        i === 0 ? null
        : backgroundImage && !steps[i].variant.backgroundImage
          ? "LinkedIn n'a pas accepté la demande complète : l'événement est créé avec l'image par défaut."
          : null;
      return { eventId, imageNote, variant: steps[i].name };
    } catch (e) {
      last = e;
      if (!(e.status === 400 || e.status === 422 || isServerError(e))) throw e;
      if (i < steps.length - 1 && isServerError(e)) await sleep(pause);
    }
  }
  throw last;
}

// Rend l'événement visible : post dont le contenu référence urn:li:event:{id}
export async function postEvent(token, { author, eventId, commentary = "" }) {
  const res = await fetch(`${LI_API}/rest/posts`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      author,
      commentary: commentary ? escapeCommentary(commentary) : "",
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { reference: { id: `urn:li:event:${eventId}` } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  if (!res.ok) throw await fail(res, "la publication de l'événement");
  return res.headers.get("x-restli-id");
}

export async function updateEvent(token, eventId, patchBody) {
  const res = await fetch(`${LI_API}/rest/events/${eventId}`, {
    method: "POST",
    headers: headers(token, { "X-RestLi-Method": "partial_update" }),
    body: JSON.stringify(patchBody),
  });
  if (!res.ok) throw await fail(res, "la mise à jour de l'événement");
}

// Supprimer le post supprime l'événement
export async function deleteEventPost(token, postUrn) {
  const res = await fetch(`${LI_API}/rest/posts/${encodeURIComponent(postUrn)}`, {
    method: "DELETE",
    headers: headers(token),
  });
  if (!res.ok && res.status !== 404) throw await fail(res, "la suppression de l'événement");
}
