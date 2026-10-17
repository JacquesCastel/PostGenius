import fs from "fs/promises";
import path from "path";
import { sendMail, isMailerConfigured } from "./mailer";
import { isAdminUser } from "./admin";
import { buildEmail } from "./emailLayout";

// Alerte d'espace disque : lit data/health.json (écrit toutes les 5 min par health-check.sh sur l'hôte) et prévient les admins par e-mail
// quand le disque du serveur dépasse 80 % (alerte) ou 90 % (critique). Un même niveau n'est relancé qu'une fois par jour, un passage
// à un niveau supérieur est signalé tout de suite, et l'alerte se réarme quand l'occupation repasse sous 75 %.

const DATA_DIR = path.join(process.cwd(), "data");
const HEALTH_FILE = path.join(DATA_DIR, "health.json");
const ALERT_FILE = path.join(DATA_DIR, "state", "disk-alert.json"); // data/state : seul sous-dossier inscriptible par le conteneur
let lastAlert = null; // repli en mémoire si le fichier est inscriptible nulle part : jamais de rafale d'e-mails

const WARN_PERCENT = Number(process.env.DISK_ALERT_PERCENT) || 80;
const CRITICAL_PERCENT = 90;
const REARM_PERCENT = WARN_PERCENT - 5;
const FRESH_MS = 30 * 60e3; // health.json plus vieux : l'état est inconnu, on n'alerte pas sur un chiffre périmé
const REALERT_MS = 24 * 3600e3;

// { level: "ok" | "warn" | "critical" | "unknown", percent }
export function evaluateDisk(health, now = Date.now()) {
  const percent = Number(health?.disk?.usedPercent);
  const at = new Date(health?.generatedAt).getTime();
  if (!Number.isFinite(percent) || !at || now - at > FRESH_MS) return { level: "unknown", percent: null };
  return { level: percent >= CRITICAL_PERCENT ? "critical" : percent >= WARN_PERCENT ? "warn" : "ok", percent };
}

const gb = (b) => (Number(b) / 1e9).toFixed(1).replace(".", ",");

export function diskAlertMail({ level, percent, disk }) {
  const base = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
  const critical = level === "critical";
  return buildEmail({
    subject: `${critical ? "🚨" : "⚠"} LinkeePost : disque du serveur à ${percent} %`,
    eyebrow: "Administration",
    title: `Disque du serveur à ${percent} %`,
    preheader: `${gb(disk?.usedBytes)} Go utilisés sur ${gb(disk?.totalBytes)} Go.`,
    paragraphs: [
      `Le disque du serveur est occupé à <strong>${percent} %</strong> (${gb(disk?.usedBytes)} Go sur ${gb(disk?.totalBytes)} Go, ${gb(disk?.availableBytes)} Go libres).`,
      critical ? "À ce niveau, l'enregistrement des images et des vidéos peut échouer : à traiter aujourd'hui." : "Il reste de la marge, mais mieux vaut agir avant que l'enregistrement des images et des vidéos échoue.",
      "Sur le serveur : <code>docker system df</code> montre ce que Docker occupe, et <code>docker builder prune -af</code> vide le cache de construction (sans risque). Si le disque reste plein, ajoutez un volume ou agrandissez le disque chez Hetzner.",
    ],
    cta: { label: "Ouvrir l'administration", url: `${base}/app` },
  });
}

// Appelé par le planificateur, au plus une fois par heure. Renvoie { sent } ou { sent: 0, reason }.
export async function runDiskAlert(prisma, now = Date.now()) {
  let health = null;
  try {
    health = JSON.parse(await fs.readFile(HEALTH_FILE, "utf8"));
  } catch {}
  const { level, percent } = evaluateDisk(health, now);
  if (level === "unknown") return { sent: 0, reason: "etat-inconnu" };

  let state = lastAlert;
  try {
    state = JSON.parse(await fs.readFile(ALERT_FILE, "utf8"));
  } catch {}

  if (level === "ok") {
    // Réarmement : sous 75 % seulement (pas de ping-pong autour du seuil)
    if (percent < REARM_PERCENT) {
      lastAlert = null;
      if (state) await fs.rm(ALERT_FILE, { force: true }).catch(() => {});
    }
    return { sent: 0 };
  }
  if (!isMailerConfigured()) return { sent: 0, reason: "smtp" };
  if (state?.level === level && now - state.at < REALERT_MS) return { sent: 0, reason: "deja-alerte" };

  const users = await prisma.user.findMany({ where: { disabled: false }, select: { email: true, role: true } });
  const to = users.filter(isAdminUser).map((u) => u.email);
  if (!to.length) return { sent: 0, reason: "aucun-admin" };

  const mail = diskAlertMail({ level, percent, disk: health.disk });
  let sent = 0;
  for (const email of to) {
    try {
      await sendMail({ kind: "alerte-disque", to: email, ...mail });
      sent++;
    } catch (e) {
      console.error("[disk-alert] e-mail non envoyé :", e.message);
    }
  }
  if (sent) {
    lastAlert = { level, at: now };
    await fs.writeFile(ALERT_FILE, JSON.stringify(lastAlert)).catch((e) => console.error("[disk-alert] état non enregistré :", e.message));
  }
  return { sent };
}
