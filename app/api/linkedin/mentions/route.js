import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId, getSessionData } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";
import { parseOrgRef, parsePersonRef } from "@/lib/mentions";

// Pages LinkedIn mentionnables dans un post : les siennes, celles déjà utilisées (GET), et ajout d'une page par son adresse,
// son nom court ou son identifiant (POST). Les personnes ne sont pas mentionnables par l'application (voir lib/mentions.js).

const LI_API = process.env.LINKEDIN_API_BASE || "https://api.linkedin.com";
const MAX_SAVED = 100;

async function ownPages(userId) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgAccounts: true } }).catch(() => null);
  try {
    return JSON.parse(acc?.orgAccounts ?? "[]").filter((o) => /^urn:li:organization:\d+$/.test(o.urn) && o.name).map((o) => ({ name: o.name, urn: o.urn }));
  } catch {
    return [];
  }
}

// Accès aux API de personnes : réservé aux comptes administrateurs d'une page (jeton « pages »)
async function orgAuth(userId) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgToken: true } });
  const token = decryptToken(acc?.orgToken);
  const orgs = await ownPages(userId);
  if (!token || !orgs.length) return null;
  return { orgs, headers: { Authorization: `Bearer ${token}`, "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604", "X-Restli-Protocol-Version": "2.0.0" } };
}
const PERSON_URN = /urn:li:person:[A-Za-z0-9_-]+/;
const asText = (v) => (typeof v === "string" ? v : v?.localized ? Object.values(v.localized)[0] : "");
function personName(el) {
  const direct = asText(el?.name) || asText(el?.localizedName) || asText(el?.fullName);
  if (direct) return direct.trim();
  const first = asText(el?.localizedFirstName) || asText(el?.firstName);
  const last = asText(el?.localizedLastName) || asText(el?.lastName);
  return `${first} ${last}`.trim();
}

// Recherche d'une personne par son nom parmi les abonnés de la page (peopleTypeahead : réservé aux abonnés, selon LinkedIn)
async function searchPeople(userId, q) {
  const auth = await orgAuth(userId);
  if (!auth) return { error: "Connectez d'abord votre page LinkedIn (menu « Connexions ») : la recherche de personnes passe par une page dont vous êtes administrateur." };
  const found = [];
  let refused = null;
  for (const org of auth.orgs.slice(0, 3)) {
    try {
      const res = await fetch(`${LI_API}/rest/peopleTypeahead?q=organizationFollowers&organization=${encodeURIComponent(org.urn)}&keywords=${encodeURIComponent(q)}`, { headers: auth.headers });
      const txt = await res.text();
      if (!res.ok) { console.error("[mentions] peopleTypeahead refusé :", res.status); refused = res.status; continue; }
      let d = {};
      try { d = JSON.parse(txt); } catch {}
      let kept = 0;
      for (const el of d.elements ?? []) {
        const urn = PERSON_URN.exec(JSON.stringify(el))?.[0];
        const name = personName(el);
        if (urn && name && !found.some((f) => f.urn === urn)) { found.push({ name, urn }); kept++; }
      }
      // Trace : combien d'éléments renvoyés par LinkedIn, combien exploitables. Jamais le contenu de la réponse : il contient des noms de membres.
      console.log(`[mentions] peopleTypeahead ${org.urn} : ${d.elements?.length ?? 0} élément(s) renvoyé(s), ${kept} exploitable(s)`);
    } catch (e) {
      console.error("[mentions] peopleTypeahead :", e.message);
    }
  }
  if (!found.length && refused) return { error: `LinkedIn refuse la recherche de personnes (code ${refused}) : l'application des pages n'a pas la permission r_organization_followers. Collez plutôt l'adresse du profil et son nom exact.` };
  return { people: found.slice(0, 8) };
}

// Adresse de profil → identifiant de membre (vanityUrl : l'ensemble des profils retrouvés dépend de LinkedIn)
async function resolveProfile(userId, vanity) {
  const auth = await orgAuth(userId);
  if (!auth) return { error: "Connectez d'abord votre page LinkedIn (menu « Connexions ») : la recherche d'une personne passe par une page dont vous êtes administrateur." };
  const url = `https://www.linkedin.com/in/${vanity}`;
  let lastStatus = null;
  for (const org of auth.orgs.slice(0, 3)) {
    try {
      const res = await fetch(`${LI_API}/rest/vanityUrl?q=vanityUrlAsOrganization&vanityUrl=${encodeURIComponent(url)}&organization=${encodeURIComponent(org.urn)}`, { headers: auth.headers });
      const txt = await res.text();
      if (!res.ok) { console.error("[mentions] vanityUrl refusé :", res.status); lastStatus = res.status; continue; }
      const urn = PERSON_URN.exec(txt)?.[0];
      if (urn) return { urn };
      console.log(`[mentions] vanityUrl ${org.urn} : réponse sans identifiant de membre`);
      lastStatus = 404;
    } catch (e) {
      console.error("[mentions] vanityUrl :", e.message);
    }
  }
  return { error: `LinkedIn n'a pas retrouvé ce profil${lastStatus ? ` (code ${lastStatus})` : ""} : un profil public peut rester introuvable. Essayez la recherche par nom (abonnés de votre page), ou taguez la personne à la main après publication.` };
}

// La recherche de personnes chez LinkedIn demande la permission r_organization_followers (accès restreint, accordé par LinkedIn).
// Active par défaut (la permission est demandée à la connexion de la page, voir auth-org) ; LINKEDIN_PEOPLE_SEARCH=0 la désactive.
// Si LINKEDIN_ORG_SCOPES est défini sur le serveur, il doit contenir r_organization_followers.
const PEOPLE_SEARCH = process.env.LINKEDIN_PEOPLE_SEARCH !== "0";

// Agence qui cloisonne : un collaborateur ne retrouve que les personnes des clients qui lui sont affectés
async function restrictedScope(userId, agencyId) {
  const [ag, mem] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { restrictClients: true } }),
    prisma.agencyMember.findUnique({ where: { userId }, select: { role: true } }),
  ]);
  return ag?.restrictClients && mem?.role !== "owner" ? { accessAsClient: { some: { memberId: userId } } } : {};
}

// Personnes déjà connectées à LinkeePost (leur profil LinkedIn est relié) : l'équipe de l'agence et les personnes de ses clients
async function connectedPeople(req, userId) {
  const session = await getSessionData(req);
  const real = session?.userId;
  if (!real) return [];
  const mem = await prisma.agencyMember.findUnique({ where: { userId: real }, select: { agencyId: true } });
  let ids = [];
  if (mem) {
    const [members, clients] = await Promise.all([
      prisma.agencyMember.findMany({ where: { agencyId: mem.agencyId }, select: { userId: true } }),
      prisma.user.findMany({ where: { agencyId: mem.agencyId, ...(await restrictedScope(real, mem.agencyId)) }, select: { id: true } }),
    ]);
    ids = [...members.map((m) => m.userId), ...clients.map((c) => c.id)];
  }
  ids = ids.filter((id) => id !== userId);
  if (!ids.length) return [];
  const accs = await prisma.linkedInAccount.findMany({ where: { userId: { in: ids }, personSub: { not: null }, personName: { not: null } }, select: { personSub: true, personName: true } });
  return accs.filter((a) => /^[A-Za-z0-9_-]+$/.test(a.personSub)).map((a) => ({ name: a.personName, urn: `urn:li:person:${a.personSub}` }));
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (q) {
    if (!PEOPLE_SEARCH) return NextResponse.json({ error: "La recherche de personnes n'est pas activée." }, { status: 404 });
    if (q.length < 2) return NextResponse.json({ people: [] });
    const r = await searchPeople(userId, q.slice(0, 80));
    return NextResponse.json(r, { status: r.error ? 422 : 200 });
  }
  const [own, saved] = await Promise.all([ownPages(userId), prisma.savedMention.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: MAX_SAVED, select: { id: true, name: true, urn: true } })]);
  const ownUrns = new Set(own.map((o) => o.urn));
  return NextResponse.json({ own, saved: saved.filter((s) => !ownUrns.has(s.urn)), team: await connectedPeople(req, userId), peopleSearch: PEOPLE_SEARCH });
}

async function lookup(userId, ref) {
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken) || decryptToken(acc?.personToken);
  if (!token) return { error: "no_token" };
  const headers = { Authorization: `Bearer ${token}`, "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604", "X-Restli-Protocol-Version": "2.0.0" };
  try {
    // Deux familles d'API : « rest » (versionnée) puis « v2 » (ancienne), l'une ou l'autre selon les droits de l'application
    const urls = ref.id
      ? [`${LI_API}/rest/organizations/${ref.id}`, `${LI_API}/v2/organizations/${ref.id}`]
      : [`${LI_API}/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(ref.vanity)}`, `${LI_API}/v2/organizations?q=vanityName&vanityName=${encodeURIComponent(ref.vanity)}`];
    let last = "failed";
    for (const url of urls) {
      const res = await fetch(url, { headers });
      if (res.status === 404) { last = "not_found"; continue; }
      if (!res.ok) { console.error("[mentions] recherche de page refusée :", res.status, url.replace(LI_API, "")); last = res.status === 401 || res.status === 403 ? "forbidden" : "failed"; continue; }
      const d = await res.json();
      const org = ref.id ? d : d.elements?.[0];
      if (!org?.id || !(org.localizedName || org.name)) { last = "not_found"; continue; }
      return { id: String(org.id), name: String(org.localizedName ?? org.name) };
    }
    return { error: last };
  } catch {
    return { error: "failed" };
  }
}

export async function POST(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  // Personne : adresse de profil (ou identifiant de membre) + nom exact tel qu'affiché sur son profil
  const person = parsePersonRef(body.input);
  if (person && !person.urn && !PEOPLE_SEARCH) return NextResponse.json({ error: "LinkedIn ne permet pas à l'application de retrouver une personne à partir de son profil. Taguez-la à la main après publication (rappel automatique).", code: "person_failed" }, { status: 422 });
  if (person) {
    const pname = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    if (!pname) return NextResponse.json({ error: "Indiquez le nom exact de la personne, tel qu'il s'affiche sur son profil LinkedIn : la mention n'est cliquable que s'il est identique.", code: "person_name" }, { status: 422 });
    let purn = person.urn;
    if (!purn) {
      const r = await resolveProfile(userId, person.vanity);
      if (r.error) return NextResponse.json({ error: r.error, code: "person_failed" }, { status: 422 });
      purn = r.urn;
    }
    if ((await prisma.savedMention.count({ where: { userId } })) >= MAX_SAVED) return NextResponse.json({ error: "Trop de mentions enregistrées : supprimez-en." }, { status: 400 });
    const savedP = await prisma.savedMention.upsert({ where: { userId_urn: { userId, urn: purn } }, create: { userId, urn: purn, name: pname }, update: { name: pname }, select: { id: true, name: true, urn: true } });
    return NextResponse.json({ mention: savedP });
  }
  // Personne déjà identifiée (résultat de recherche par nom)
  if (/^urn:li:person:/.test(String(body.urn ?? "")) && body.name) {
    const nm = String(body.name).replace(/\s+/g, " ").trim().slice(0, 120);
    const u = String(body.urn).trim();
    if (!/^urn:li:person:[A-Za-z0-9_-]+$/.test(u) || !nm) return NextResponse.json({ error: "Mention invalide." }, { status: 400 });
    const s2 = await prisma.savedMention.upsert({ where: { userId_urn: { userId, urn: u } }, create: { userId, urn: u, name: nm }, update: { name: nm }, select: { id: true, name: true, urn: true } });
    return NextResponse.json({ mention: s2 });
  }
  const ref = parseOrgRef(body.input);
  if (!ref && /linkedin\.com\/(in|pub)\//i.test(String(body.input ?? ""))) return NextResponse.json({ error: "Les personnes ne peuvent pas être mentionnées depuis LinkeePost : seules les pages (linkedin.com/company/…) le peuvent. Taguez la personne à la main après publication." }, { status: 400 });
  if (!ref) return NextResponse.json({ error: "Collez l'adresse de la page LinkedIn (https://www.linkedin.com/company/…), son nom court ou son identifiant." }, { status: 400 });
  const typedName = String(body.name ?? "").replace(/\s+/g, " ").trim().slice(0, 120);

  // Identifiant saisi à la main (quand LinkedIn ne permet pas de retrouver la page par son adresse)
  const typedId = /^\d{3,}$/.test(String(body.id ?? "").trim()) ? String(body.id).trim() : null;
  let id = ref.id ?? typedId;
  let name = typedName;
  // Identifiant + nom fournis : rien à chercher chez LinkedIn
  if (!(id && name)) {
    const found = await lookup(userId, ref);
    if (found.error) {
      const msg = found.error === "not_found" ? "Page LinkedIn introuvable : vérifiez l'adresse."
        : found.error === "no_token" ? "Connectez d'abord votre compte LinkedIn pour retrouver une page."
        : "LinkedIn ne permet pas à l'application de retrouver cette page automatiquement. Indiquez son identifiant numérique (le nombre dans l'adresse d'administration de la page : linkedin.com/company/NOMBRE/admin) et son nom exact.";
      return NextResponse.json({ error: msg, code: found.error === "not_found" ? "not_found" : "manual" }, { status: found.error === "not_found" ? 404 : 422 });
    }
    id = found.id;
    name = typedName || found.name;
  }
  const urn = `urn:li:organization:${id}`;
  if ((await prisma.savedMention.count({ where: { userId } })) >= MAX_SAVED) return NextResponse.json({ error: "Trop de pages enregistrées : supprimez-en." }, { status: 400 });
  const saved = await prisma.savedMention.upsert({ where: { userId_urn: { userId, urn } }, create: { userId, urn, name }, update: { name }, select: { id: true, name: true, urn: true } });
  return NextResponse.json({ mention: saved });
}
