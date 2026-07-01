import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Liste les pages entreprise dont le membre est admin.
// Toujours tente l'appel live en premier (résultats complets).
// Fallback sur le cache DB si l'appel échoue.

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ organizations: [] });

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken);
  if (!token) return NextResponse.json({ organizations: [] });

  const headers = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // 1) Appel live — résultats complets
  try {
    const aclRes = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      { headers }
    );
    if (aclRes.ok) {
      const acls = await aclRes.json();
      const urns = (acls.elements ?? []).map((e) => e.organization).filter(Boolean);

      const organizations = await Promise.all(
        urns.map(async (urn) => {
          const id = urn.split(":").pop();
          try {
            const orgRes = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers });
            const name = orgRes.ok ? ((await orgRes.json()).localizedName ?? `Page ${id}`) : `Page ${id}`;
            return { urn, name };
          } catch {
            return { urn, name: `Page ${id}` };
          }
        })
      );

      // Persist pour les prochains appels
      if (organizations.length > 0) {
        await prisma.linkedInAccount.update({
          where: { userId },
          data: {
            orgAccounts: JSON.stringify(organizations),
            orgUrn: organizations[0].urn,
            orgName: organizations[0].name,
          },
        }).catch(() => {});
      }

      return NextResponse.json({ organizations });
    }
    console.warn("organizationAcls:", aclRes.status, await aclRes.text());
  } catch (e) {
    console.error("Erreur organizations live:", e.message);
  }

  // 2) Fallback cache DB
  if (acc.orgAccounts) {
    try {
      const organizations = JSON.parse(acc.orgAccounts);
      if (Array.isArray(organizations) && organizations.length > 0)
        return NextResponse.json({ organizations });
    } catch {}
  }
  if (acc.orgUrn) {
    return NextResponse.json({
      organizations: [{ urn: acc.orgUrn, name: acc.orgName ?? `Page ${acc.orgUrn.split(":").pop()}` }],
    });
  }

  return NextResponse.json({ organizations: [] });
}
