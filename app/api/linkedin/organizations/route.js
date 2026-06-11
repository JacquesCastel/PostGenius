import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Liste les pages entreprise dont le membre connecté est administrateur.
// Requiert le scope rw_organization_admin (produit "Community Management API").

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ organizations: [] });

  // Token de la 2e app (Community Management API), stocké en base
  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const token = decryptToken(acc?.orgToken);
  if (!token) return NextResponse.json({ organizations: [] });

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
      // 403 = scope organisation absent du token → pas de pages disponibles
      console.error("organizationAcls:", aclRes.status, await aclRes.text());
      return NextResponse.json({ organizations: [] });
    }
    const acls = await aclRes.json();
    const urns = (acls.elements ?? []).map((e) => e.organization).filter(Boolean);

    // Résolution des noms de pages
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

    return NextResponse.json({ organizations });
  } catch (e) {
    console.error("Erreur organizations:", e);
    return NextResponse.json({ organizations: [] });
  }
}
