import { prisma } from "./db";

// Compte de publication d'un brouillon : le profil (« person ») ou une page LinkedIn. Une page n'est acceptée que si elle est connectée au compte :
// la liste de ses pages (LinkedInAccount.orgAccounts) ou, pour une connexion ancienne, la première page (orgUrn). Sans cela, un client pouvait
// enregistrer l'identifiant d'une page qui n'est pas la sienne (LinkedIn refuserait à la publication, mais l'erreur arrivait tard et sans explication).
export async function userOwnsTarget(userId, target) {
  if (target === undefined || target === null || target === "" || target === "person") return true;
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId }, select: { orgUrn: true, orgAccounts: true } }).catch(() => null);
  if (!acc) return false;
  const urns = new Set();
  if (typeof acc.orgUrn === "string" && acc.orgUrn) urns.add(acc.orgUrn);
  try {
    const list = JSON.parse(acc.orgAccounts ?? "[]");
    if (Array.isArray(list)) for (const o of list) if (o && typeof o.urn === "string") urns.add(o.urn);
  } catch { /* liste illisible : seule la page historique compte */ }
  return urns.has(String(target));
}
