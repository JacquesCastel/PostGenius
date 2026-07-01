import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveUserId as getUserId } from "@/lib/session";
import { decryptToken } from "@/lib/crypto";

// Statistiques des posts d'une page entreprise.
// API : organizationalEntityShareStatistics (Community Management API)
// - sans paramètre shares : statistiques agrégées de la page (12 mois glissants)
// - avec shares=List(urn) : statistiques par post
// Le profil personnel n'est pas couvert : LinkedIn réserve la
// "Member Post Analytics API" à ses partenaires approuvés.

const BASE = "https://api.linkedin.com/rest/organizationalEntityShareStatistics";

function liHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    "LinkedIn-Version": process.env.LINKEDIN_VERSION || "202604",
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

export async function GET(req) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const org = searchParams.get("org");
  if (!/^urn:li:organization:\d+$/.test(org ?? "")) {
    return NextResponse.json({ error: "Paramètre org invalide." }, { status: 400 });
  }

  const acc = await prisma.linkedInAccount.findUnique({ where: { userId } });
  const orgToken = decryptToken(acc?.orgToken);
  if (!orgToken) {
    return NextResponse.json({ error: "Page entreprise non connectée." }, { status: 401 });
  }

  try {
    // 1) Statistiques agrégées de la page
    const aggRes = await fetch(
      `${BASE}?q=organizationalEntity&organizationalEntity=${encodeURIComponent(org)}`,
      { headers: liHeaders(orgToken) }
    );
    if (!aggRes.ok) {
      const err = await aggRes.text();
      console.error("Stats agrégées:", aggRes.status, err);
      return NextResponse.json(
        { error: `LinkedIn a refusé la demande de statistiques (${aggRes.status}).` },
        { status: 502 }
      );
    }
    const aggData = await aggRes.json();
    const aggregate = aggData.elements?.[0]?.totalShareStatistics ?? null;

    // 2) Statistiques par post (posts publiés via l'app sur cette page)
    const published = await prisma.draft.findMany({
      where: { userId, status: "publié", target: org, postId: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    const shareUrns = published.map((d) => d.postId).filter((id) => /^urn:li:(share|ugcPost):/.test(id));
    const statsByUrn = {};

    // L'API accepte une List() d'URNs — par lots de 10
    for (let i = 0; i < shareUrns.length; i += 10) {
      const batch = shareUrns.slice(i, i + 10);
      const shares = batch.filter((u) => u.startsWith("urn:li:share:"));
      const ugc = batch.filter((u) => u.startsWith("urn:li:ugcPost:"));
      const params = [`q=organizationalEntity`, `organizationalEntity=${encodeURIComponent(org)}`];
      if (shares.length)
        params.push(`shares=List(${shares.map(encodeURIComponent).join(",")})`);
      if (ugc.length)
        params.push(`ugcPosts=List(${ugc.map(encodeURIComponent).join(",")})`);

      const res = await fetch(`${BASE}?${params.join("&")}`, { headers: liHeaders(orgToken) });
      if (!res.ok) {
        console.error("Stats par post:", res.status, await res.text());
        continue;
      }
      const data = await res.json();
      for (const el of data.elements ?? []) {
        const urn = el.share ?? el.ugcPost;
        if (urn) statsByUrn[urn] = el.totalShareStatistics;
      }
    }

    const posts = published.map((d) => ({
      id: d.id,
      theme: d.theme,
      text: d.text.slice(0, 120),
      postId: d.postId,
      publishedAt: d.publishedAt,
      stats: statsByUrn[d.postId] ?? null,
    }));

    // 3) Vues de la page entreprise
    let pageStats = null;
    try {
      const pageRes = await fetch(
        `https://api.linkedin.com/rest/organizationPageStatistics?q=organization&organization=${encodeURIComponent(org)}`,
        { headers: liHeaders(orgToken) }
      );
      if (pageRes.ok) {
        const pageData = await pageRes.json();
        const views = pageData.elements?.[0]?.totalPageStatistics?.views;
        if (views) {
          pageStats = {
            totalPageViews: views.allPageViews ?? views.totalPageViews ?? null,
            uniquePageViews: views.uniquePageViews ?? null,
            mobilePageViews: views.allMobilePageViews ?? views.mobilePageViews ?? null,
            desktopPageViews: views.allDesktopPageViews ?? views.desktopPageViews ?? null,
          };
        }
      } else {
        console.warn("organizationPageStatistics:", pageRes.status, await pageRes.text());
      }
    } catch (e) {
      console.warn("Vues de page non disponibles:", e.message);
    }

    return NextResponse.json({ aggregate, posts, pageStats });
  } catch (e) {
    console.error("Erreur stats:", e);
    return NextResponse.json({ error: "Échec de la récupération des statistiques." }, { status: 500 });
  }
}
