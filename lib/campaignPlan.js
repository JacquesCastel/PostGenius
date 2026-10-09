// Plan éditorial d'une campagne : fonctions PURES (navigateur et serveur) : lignes issues du calendrier du brief, validation des
// modifications, décalage des dates, avertissements, consignes d'une publication, ajout fiable du lien exact.
// Principe : les dates sont PROPOSÉES (jamais programmées seules) et le lien est ajouté par le code, jamais par l'IA.

import { norm } from "./campaignBrief";

export const PLAN_TZ = "Europe/Paris";
export const MAX_ITEMS = 60;
const squash = (t, n) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const long = (t, n) => String(t ?? "").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, n);
const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? "")) && !Number.isNaN(Date.parse(`${d}T12:00:00Z`));
const urlKey = (u) => String(u ?? "").trim().replace(/\/+$/, "").toLowerCase();

const kindOf = (brief, account) => (brief?.accounts ?? []).find((a) => norm(a.label) === norm(account))?.kind ?? "person";

// Calendrier du brief → lignes du plan (dans l'ordre du brief)
export function itemsFromBrief(brief) {
  return (brief?.calendar ?? []).slice(0, MAX_ITEMS).map((c, i) => ({
    position: i,
    ref: c.ref,
    account: c.account,
    kind: kindOf(brief, c.account),
    target: kindOf(brief, c.account) === "person" ? "person" : null,
    date: isDate(c.date) ? c.date : null,
    objective: c.objective ?? "",
    angle: c.angle ?? "",
    cta: c.cta ?? "",
    url: c.url ?? null,
    format: c.format ?? "",
    visual: c.visual ?? "",
    media: c.media ?? "",
    toConfirm: c.toConfirm ?? "",
  }));
}

// Adresses que la campagne peut citer : ressources du brief + liens de son calendrier. Vide = pas de brief (tout lien http(s) accepté)
export function allowedUrls(brief) {
  return [...new Set([...(brief?.sources ?? []).map((s) => s.url), ...(brief?.calendar ?? []).map((c) => c.url).filter(Boolean)])];
}

const TEXT_FIELDS = { objective: 240, format: 60, media: 120, toConfirm: 300, cta: 200, account: 60, ref: 12 };
const LONG_FIELDS = { angle: 400, visual: 400 };

// Modification d'une ligne : renvoie les champs valides ou lève une erreur lisible (message pour l'utilisateur)
export function cleanItemPatch(patch, { allowed = [] } = {}) {
  const out = {};
  for (const [k, n] of Object.entries(TEXT_FIELDS)) if (typeof patch?.[k] === "string") out[k] = squash(patch[k], n);
  for (const [k, n] of Object.entries(LONG_FIELDS)) if (typeof patch?.[k] === "string") out[k] = long(patch[k], n);
  if (out.ref === "") throw new Error("L'identifiant ne peut pas être vide.");
  if (out.account === "") throw new Error("Le compte ne peut pas être vide.");
  if ("date" in (patch ?? {})) {
    if (patch.date === null || patch.date === "") out.date = null;
    else if (isDate(patch.date)) out.date = patch.date;
    else throw new Error("Date invalide (format AAAA-MM-JJ).");
  }
  if ("url" in (patch ?? {})) {
    const u = String(patch.url ?? "").trim();
    if (!u) out.url = null;
    else {
      let parsed = null;
      try { parsed = new URL(u); } catch {}
      if (!parsed || !/^https?:$/.test(parsed.protocol)) throw new Error("Adresse invalide (https://…).");
      if (allowed.length && !allowed.some((a) => urlKey(a) === urlKey(parsed.toString()) || urlKey(a) === urlKey(u))) {
        throw new Error("Cette adresse ne figure pas dans les ressources autorisées de la campagne.");
      }
      out.url = parsed.toString();
    }
  }
  return out;
}

export function shiftDate(date, days) {
  if (!isDate(date)) return null;
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}
export const daysBetween = (a, b) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

// Décale tout le calendrier pour que la première publication tombe à newStart, en gardant l'espacement
export function shiftPlan(items, newStart) {
  if (!isDate(newStart)) throw new Error("Date de début invalide.");
  const dates = items.map((i) => i.date).filter(isDate).sort();
  if (!dates.length) throw new Error("Aucune publication n'a de date à décaler.");
  const delta = daysBetween(dates[0], newStart);
  return items.map((i) => ({ id: i.id, date: i.date ? shiftDate(i.date, delta) : null }));
}

// Jour (AAAA-MM-JJ) d'un instant, à Paris
export function parisDay(instant) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: PLAN_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

// Heure Europe/Paris d'un jour donné → instant UTC (gère l'heure d'été)
export function parisInstant(date, time = "09:00") {
  if (!isDate(date)) return null;
  const [h, m] = String(time).split(":").map(Number);
  const [y, mo, d] = date.split("-").map(Number);
  const offsetAt = (ms) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: PLAN_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - Math.floor(ms / 60000) * 60000;
  };
  const guess = Date.UTC(y, mo - 1, d, h || 9, m || 0);
  let t = guess - offsetAt(guess);
  t = guess - offsetAt(t);
  return new Date(t);
}

// Avertissements : un par problème repéré (jamais bloquants)
export function planWarnings(items, brief) {
  const allowed = allowedUrls(brief);
  const out = [];
  const byDate = new Map();
  for (const i of items) {
    if (!i.date) out.push({ ref: i.ref, type: "date", text: `${i.ref} : pas de date proposée.` });
    else byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]);
    if (i.kind === "org" && (!i.target || i.target === "person")) out.push({ ref: i.ref, type: "page", text: `${i.ref} : associez le compte « ${i.account} » à une page LinkedIn avant de générer.` });
    if (i.url && allowed.length && !allowed.some((a) => urlKey(a) === urlKey(i.url))) out.push({ ref: i.ref, type: "url", text: `${i.ref} : lien hors des ressources autorisées.` });
    if (i.toConfirm) out.push({ ref: i.ref, type: "confirm", text: `${i.ref} : à confirmer avant publication : ${i.toConfirm}` });
  }
  for (const [date, list] of byDate) {
    const accounts = new Set(list.map((l) => norm(l.account)));
    if (list.length > 1 && accounts.size > 1) out.push({ ref: list.map((l) => l.ref).join(", "), type: "same-day", text: `${list.map((l) => l.ref).join(" et ")} : deux comptes publient le même jour (${date}).` });
  }
  return out;
}

// Consignes propres à UNE publication, ajoutées au brief de la campagne. others : angles des autres publications proches
export function itemPrompt(item, { others = [], previous = [], next = null, validated = [] } = {}) {
  const lines = [`CONSIGNES DE CETTE PUBLICATION (${item.ref}, compte « ${item.account} ») — À RESPECTER :`];
  if (item.objective) lines.push(`- Objectif : ${item.objective}`);
  if (item.angle) lines.push(`- Sujet et angle : ${item.angle}`);
  if (item.format) lines.push(`- Format : ${item.format}`);
  if (item.url) lines.push(`- Appel à l'action : ${item.cta || "inviter à consulter la ressource"}. Le lien exact sera ajouté automatiquement à la fin du texte : n'écris AUCUN lien toi-même.`);
  else lines.push(`- Aucun lien dans ce post${item.cta ? ` : ${item.cta}` : ""} : termine par une question ouverte, sans lien.`);
  if (item.toConfirm) lines.push(`- Fait à confirmer, NE L'AFFIRME PAS : ${item.toConfirm}`);
  if (item.visual) lines.push(`- Le visuel prévu (pour information, ne le décris pas comme déjà livré) : ${item.visual}`);
  if (others.length) lines.push(`- Autres publications de la campagne autour de cette date (ne traite PAS leur sujet, apporte un angle distinct) :\n${others.map((o) => `  · ${o.ref} (${o.account}) : ${o.angle || o.objective}`).join("\n")}`);
  if (validated.length) lines.push(`- VERSIONS VALIDÉES OU CORRIGÉES PAR LE CLIENT pour ce compte (RÉFÉRENCE PRIORITAIRE : reproduis leur structure, leur longueur, leur ton, leur manière de conclure et leur usage, ou non, des emojis et des hashtags) :\n${validated.map((v) => `  · ${v.ref}, version finale : « ${String(v.final).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 900)} »${v.original ? `\n    (version proposée avant ses corrections : « ${String(v.original).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 900)} » : ce qu'il a changé exprime ses préférences, applique-les)` : ""}`).join("\n")}`);
  if (previous.length) lines.push(`- Publications PRÉCÉDENTES de ce compte dans la campagne (continuité : prolonge sans répéter leur accroche ni leur angle ; référence légère possible) :\n${previous.map((p) => `  · ${p.ref} : « ${String(p.text).replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 320)} »`).join("\n")}`);
  if (next) lines.push(`- La publication SUIVANTE de ce compte portera sur : ${next.angle || next.objective} (prépare-lui le terrain sans l'annoncer ni l'empiéter).`);
  return `\n\n${lines.join("\n")}`;
}

const URL_RE = /https?:\/\/[^\s)»"]+/gi;
// Le lien est ajouté par le code : on retire tout lien que le modèle aurait écrit, puis on ajoute celui de la ligne (ou aucun)
export function applyUrl(text, item) {
  const base = String(text ?? "").replace(URL_RE, "").replace(/ {2,}/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!item.url) return base;
  const label = String(item.cta ?? "").replace(/\s*[:：]\s*$/, "").trim();
  return `${base}\n\n${label && !/sans lien/i.test(label) ? label : "En savoir plus"} : ${item.url}`;
}

// --- Production par lots ---------------------------------------------------------------------------------------
const mondayOf = (d) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const canWrite = (i) => !(i.kind === "org" && (!i.target || i.target === "person"));

// Publications pilotes : la première de chaque compte, rédigées d'abord pour vérifier les voix.
// Lot suivant : les publications non rédigées des deux prochaines semaines civiles (celles sans date en dernier).
export function planBatches(items) {
  const seen = new Set();
  const pilots = items.filter((i) => !seen.has(norm(i.account)) && seen.add(norm(i.account)));
  const todo = items.filter((i) => i.status !== "généré" && canWrite(i));
  const dated = [...new Set(todo.filter((i) => i.date).map((i) => mondayOf(i.date)))].sort();
  let next = [];
  if (dated.length) {
    const first = dated[0];
    const limit = mondayOf(shiftDate(first, 7));
    next = todo.filter((i) => i.date && mondayOf(i.date) <= limit);
  } else next = todo.filter((i) => !i.date);
  const validDraft = (i) => i.draft && ["programmé", "publié"].includes(i.draft.status);
  return { pilotsValidated: pilots.length > 0 && pilots.every(validDraft), pilotsToValidate: pilots.filter((i) => i.status === "généré" && !validDraft(i)).map((i) => i.id), pilots: pilots.map((i) => i.id), pilotsDone: pilots.length > 0 && pilots.every((i) => i.status === "généré"), pilotsTodo: pilots.filter((i) => i.status !== "généré" && canWrite(i)).map((i) => i.id), next: next.map((i) => i.id), nextWeeks: dated.length ? [dated[0], mondayOf(shiftDate(dated[0], 7))] : [], remaining: todo.length };
}

// --- Fiche de sortie : la fiche d'une publication, prête à copier --------------------------------------------------
const fr = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "date à fixer");
export function planSheet(item, { text = "", issues = [] } = {}) {
  const week = item.date ? `semaine du ${fr(mondayOf(item.date))}` : "sans semaine";
  const cta = item.url ? `${item.cta || "Lien"} — ${item.url}` : "question sans lien";
  return [
    `${item.ref} — ${item.account}`,
    `Semaine et date proposée : ${week}, ${fr(item.date)} (proposition, rien n'est programmé)`,
    `Objectif : ${item.objective || "—"}`,
    `Sujet et angle : ${item.angle || "—"}`,
    `Format : ${item.format || "—"}`,
    `CTA et URL exacte : ${cta}`,
    `Brief visuel : ${item.visual || "—"} (statut du média : ${item.media || "à préciser"} ; demande de production, pas un fichier livré)`,
    `Faits restant à confirmer : ${item.toConfirm || "aucun signalé"}`,
    issues.length ? `Points de contrôle : ${issues.map((i) => i.text).join(" | ")}` : null,
    "",
    "TEXTE FINAL PRÊT À COPIER :",
    text || "(pas encore rédigé)",
  ].filter((l) => l !== null).join("\n");
}
export const sheetAll = (rows) => rows.map((r) => planSheet(r.item, r)).join("\n\n————————————————\n\n");
