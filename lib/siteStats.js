import crypto from "crypto";
import { prisma } from "./db";

// Mesure d'audience du site faite par LinkeePost : aucune donnée personnelle conservée (voir le modèle SiteVisit).
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios|go-http|java\/|httpclient|scrapy|phantom/i;
const PRIVATE = /^\/(app|api|_next|valider|rapport|reset-password|oauth)(\/|$)/;

export const isBot = (ua) => !ua || BOT.test(ua);
export const deviceOf = (ua) => (/iPad|Tablet/i.test(ua) ? "tablette" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : "ordinateur");

// Chemin accepté : page publique, sans paramètres, de forme sûre
export function cleanPath(p) {
  let s = String(p ?? "").split("#")[0].split("?")[0].slice(0, 120);
  if (!s.startsWith("/") || !/^\/[A-Za-z0-9\-_\/.%]*$/.test(s) || PRIVATE.test(s)) return null;
  if (s.length > 1) s = s.replace(/\/+$/, "");
  return s || "/";
}

export function classifySource(referrer, ownHost) {
  if (!referrer) return "direct";
  let h = "";
  try { h = new URL(referrer).host.toLowerCase(); } catch { return "direct"; }
  if (ownHost && (h === ownHost.toLowerCase())) return "interne";
  if (/(^|\.)(linkedin\.com|lnkd\.in)$/.test(h)) return "linkedin";
  if (/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|ecosia\.org|qwant\.com|yahoo\.com|search\.brave\.com)$/.test(h)) return "recherche";
  return "autre";
}

// Empreinte du jour : change à minuit (UTC) et n'est jamais conservée avec l'adresse ni le navigateur
export function visitorHash(ip, ua, day) {
  const salt = crypto.createHmac("sha256", process.env.AUTH_SECRET || "dev-secret").update(`site-stats:${day}`).digest();
  return crypto.createHmac("sha256", salt).update(`${ip}|${ua}`).digest("hex").slice(0, 16);
}

export async function purgeSiteVisits() {
  const limit = new Date(Date.now() - 400 * 86400000);
  await prisma.siteVisit.deleteMany({ where: { createdAt: { lt: limit } } });
}
