import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Statut des connexions LinkedIn du client (lu en base)
export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ connected: false, orgConnected: false });

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const now = new Date();
  const personValid = acc?.personToken && (!acc.personExpiresAt || acc.personExpiresAt > now);
  const orgValid = acc?.orgToken && (!acc.orgExpiresAt || acc.orgExpiresAt > now);
  const memberValid = acc?.memberToken && acc?.memberSub && (!acc.memberExpiresAt || acc.memberExpiresAt > now);
  const statsValid = acc?.statsToken && (!acc.statsExpiresAt || acc.statsExpiresAt > now);

  // Photo de profil : l'URL fournie par LinkedIn est signée et finit par expirer. On la relit au plus une fois par semaine
  // (et pour les comptes connectés avant l'ajout de la photo). Un échec n'a aucune conséquence : l'aperçu garde l'initiale.
  let picture = personValid ? acc.personPicture ?? "" : "";
  const stale = !acc?.personPictureAt || now - acc.personPictureAt > 7 * 24 * 3600 * 1000;
  if (personValid && stale) {
    try {
      const r = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${decryptToken(acc.personToken)}` }, signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const me = await r.json();
        picture = typeof me.picture === "string" && me.picture.startsWith("https://") ? me.picture : "";
        await prisma.linkedInAccount.update({ where: { userId }, data: { personPicture: picture || null, personPictureAt: now } });
      }
    } catch {}
  }

  return NextResponse.json({
    connected: Boolean(personValid),
    name: personValid ? acc.personName ?? "" : "",
    picture,
    personExpiresAt: personValid ? acc.personExpiresAt : null,
    orgConnected: Boolean(orgValid),
    orgExpiresAt: orgValid ? acc.orgExpiresAt : null,
    memberConnected: Boolean(memberValid),
    memberName: memberValid ? acc.memberName ?? "" : "",
    memberExpiresAt: memberValid ? acc.memberExpiresAt : null,
    statsConnected: Boolean(statsValid),
    statsExpiresAt: statsValid ? acc.statsExpiresAt : null,
  });
}
