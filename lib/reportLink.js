import { prisma } from "@/lib/db";
import { newApprovalToken, isApprovalToken } from "@/lib/approval";

// Lien de partage du rapport mensuel d'un client (voir ReportLink) : même forme de jeton que le lien de validation.
export const newReportToken = newApprovalToken;
export const reportUrl = (token) => `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "")}/rapport/${token}`;

// Lien + client (compte géré par une agence uniquement) ; nul si le lien n'existe plus ou si le client a quitté l'agence
export async function findReportLink(token) {
  if (!isApprovalToken(token)) return null;
  const link = await prisma.reportLink.findUnique({
    where: { token },
    include: { user: { select: { id: true, name: true, companyName: true, agencyId: true, agency: { select: { name: true } } } } },
  });
  return link?.user?.agencyId ? link : null;
}
