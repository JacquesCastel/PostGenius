import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionData } from "@/lib/sessionToken";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isBot, deviceOf, cleanPath, classifySource, visitorHash } from "@/lib/siteStats";

// Enregistre une page vue du site public. Répond toujours 204 : le visiteur ne doit jamais voir d'erreur, ni savoir pourquoi une visite n'est pas comptée.
// Ne compte pas : les robots, les personnes qui ont activé « Ne pas me suivre » (DNT ou GPC), les personnes connectées, les pages privées.
const g = globalThis;
const recent = (g.__siteVisitRecent ??= new Map()); // empreinte+page → instant (évite les doublons rapprochés)
const done = () => new NextResponse(null, { status: 204 });

export async function POST(req) {
  try {
    if (process.env.SITE_STATS_DISABLED === "1") return done();
    const ua = req.headers.get("user-agent") ?? "";
    if (isBot(ua) && process.env.SITE_STATS_ALLOW_HEADLESS !== "1") return done();
    if (req.headers.get("dnt") === "1" || req.headers.get("sec-gpc") === "1") return done();
    const ip = clientIp(req);
    if (!rateLimit(`site-visit:${ip}`, { limit: 120, windowMs: 60_000 })) return done();
    const session = await getSessionData(req);
    if (session?.userId) return done();
    const body = await req.json().catch(() => ({}));
    const path = cleanPath(body.path);
    if (!path) return done();
    const day = new Date().toISOString().slice(0, 10);
    const visitor = visitorHash(ip, ua, day);
    const key = `${visitor}:${path}`;
    const now = Date.now();
    if (now - (recent.get(key) ?? 0) < 5000) return done();
    recent.set(key, now);
    if (recent.size > 5000) for (const [k, t] of recent) if (now - t > 60_000) recent.delete(k);
    const ownHost = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim();
    const source = body.internal === true ? "interne" : classifySource(String(body.ref ?? "").slice(0, 300), ownHost);
    await prisma.siteVisit.create({ data: { day, path, source, device: deviceOf(ua), visitor } });
  } catch (e) {
    console.error("[site-stats]", e?.message);
  }
  return done();
}
