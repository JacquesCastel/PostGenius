import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Liste les pages entreprise dont le membre est admin.
// Priorité : orgUrn stocké en base (résolu au moment de la connexion OAuth).
// Fallback : appel live organizationAcls (requiert rw_organization_admin approuvé).

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ organizations: [] });

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken);
  if (!token) return NextResponse.json({ organizations: [] });

  // 1) Org URN déjà stocké en base → retour immédiat
  if (acc.orgUrn) {
    return NextResponse.json({
      organizations: [{ urn: acc.orgUrn, name: acc.orgName ?? `Page ${acc.orgUrn.split(":").pop()}` }],
    });
  }

  // 2) Fallback : appel live (peut échouer si rw_organization_admin non approuvé)
  const headers = {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  try {
    const aclRes = await fetch(
      "https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED",
      { headers }
    );
    if (!aclRes.ok) {
      console.error("organizationAcls:", aclRes.status, await aclRes.text());
      return NextResponse.json({ organizations: [] });
    }
    const acls = await aclRes.json();
    const urns = (acls.elements ?? []).map((e) => e.organization).filter(Boolean);

    const organizations = await Promise.all(
      urns.map(async (urn) => {
        const id = urn.split(":").pop();
        try {
          const orgRes = await fetch(`https://api.linkedin.com/rest/organizations/${id}`, { headers });
          if (!orgRes.ok) return { urn, name: `Page ${id}` };
          const org = await orgRes.json();
          return { urn, name: org.localizedName ?? `Page ${id}` };
        } catch {
          return { urn, name: `Page ${id}` };
        }
      })
    );

    // Persist le premier résultat pour éviter les appels futurs
    if (organizations.length > 0) {
      await prisma.linkedInAccount.update({
        where: { userId },
        data: { orgUrn: organizations[0].urn, orgName: organizations[0].name },
      });
    }

    return NextResponse.json({ organizations });
  } catch (e) {
    console.error("Erreur organizations:", e);
    return NextResponse.json({ organizations: [] });
  }
}
