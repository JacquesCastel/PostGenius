// E-mail « leads à qualifier » : contenu pur (testable). Aucune donnée de profil LinkedIn (nom, poste, entreprise) n'y figure : seulement des nombres.
// Règle LinkedIn (Data Storage Requirements) : comme les commentaires, les données des leads issus de la page sont effacées : profil et note après 24 h, lead après 48 h.
import { PROFILE_TTL_MS, COMMENT_TTL_MS } from "./leadsText.js";

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

// Délai lisible avant l'effacement du lead le plus ancien encore en attente
export function deadlineText(oldestCreatedAt, now = Date.now()) {
  const left = Math.max(0, new Date(oldestCreatedAt).getTime() + COMMENT_TTL_MS - now);
  const hours = Math.ceil(left / 3600_000);
  if (hours <= 1) return "dans moins d'une heure";
  return `dans ${hours} h`;
}

// created : leads créés par ce passage ; waiting : leads pas encore qualifiés (dont ceux-ci) ; oldestCreatedAt : le plus ancien d'entre eux
export function leadsMailContent({ client = null, created, waiting, oldestCreatedAt, now = Date.now() }) {
  const n = Math.max(1, Number(created) || 1);
  const total = Math.max(n, Number(waiting) || n);
  const subjectCount = total > n ? plural(total, "lead à qualifier", "leads à qualifier") : plural(n, "lead à qualifier", "leads à qualifier");
  const head = `${plural(n, "nouveau lead", "nouveaux leads")} sur ${client ? `la page de ${client}` : "votre page"}`;
  const lines = [
    `${n > 1 ? "Des personnes ont" : "Une personne a"} commenté {{page}} : ${n > 1 ? "elles sont enregistrées" : "elle est enregistrée"} comme <strong>${plural(n, "lead à qualifier", "leads à qualifier")}</strong>${total > n ? ` (${total} au total en attente de qualification)` : ""}.`,
    `<strong>Ces données ne sont conservées que 24 h à 48 h.</strong> Comme les commentaires, les leads issus de LinkedIn sont effacés au nom des règles de conservation imposées par LinkedIn : le profil (nom, poste, entreprise) et la note de qualification sont effacés ${Math.round(PROFILE_TTL_MS / 3600_000)} h après le commentaire, et le lead lui-même ${Math.round(COMMENT_TTL_MS / 3600_000)} h après.`,
    `Le plus ancien lead en attente sera effacé <strong>${deadlineText(oldestCreatedAt, now)}</strong>. Qualifiez-le et contactez la personne avant.`,
  ];
  return { subject: `${subjectCount[0].toUpperCase()}${subjectCount.slice(1)}${client ? ` · ${client}` : ""}`, eyebrow: "Leads", title: head, lines, ctaLabel: "Qualifier les leads" };
}
