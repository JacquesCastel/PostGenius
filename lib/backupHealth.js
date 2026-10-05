import fs from "fs/promises";
import path from "path";
import { sendMail, isMailerConfigured } from "./mailer";
import { isAdminUser } from "./admin";

// Santé des sauvegardes : lit data/backup-status.json (écrit par backup-data.sh
// à chaque passage), en déduit des alertes pour l'onglet Administration, et
// prévient les admins par email quand quelque chose ne va pas.

const DATA_DIR = path.join(process.cwd(), "data");
export const STATUS_FILE = path.join(DATA_DIR, "backup-status.json");
const ALERT_FILE = path.join(DATA_DIR, "backup-alert.json");

const STALE_MS = 36 * 3600e3; // cron quotidien : au-delà de 36 h, un passage a été raté
const REALERT_MS = 24 * 3600e3; // un même problème n'est relancé par email qu'une fois par jour

export async function readBackupStatus() {
  try {
    return JSON.parse(await fs.readFile(STATUS_FILE, "utf8"));
  } catch {
    return null;
  }
}

const hoursAgo = (iso, now) => Math.round((now - new Date(iso).getTime()) / 3600e3);

// Renvoie { level: "ok" | "warn" | "critical", alerts: [{ level, message }] }
export function evaluateBackup(status, now = Date.now()) {
  const alerts = [];
  if (!status) {
    return {
      level: "warn",
      alerts: [{ level: "warn", message: "Aucune sauvegarde enregistrée : le cron de backup-data.sh n'est pas installé, ou n'a jamais tourné." }],
    };
  }

  // Statut lui-même trop ancien : le script n'a pas tourné (cron absent, serveur éteint…)
  const generated = new Date(status.generatedAt).getTime();
  if (!generated || now - generated > STALE_MS) {
    alerts.push({
      level: "critical",
      message: `Le script de sauvegarde n'a pas tourné depuis ${status.generatedAt ? hoursAgo(status.generatedAt, now) + " h" : "longtemps"} (cron arrêté ?).`,
    });
  }

  const local = status.local ?? {};
  if (local.status === "error") {
    alerts.push({ level: "critical", message: `Sauvegarde locale en échec : ${local.error || "erreur inconnue"}.` });
  } else if (!local.lastSuccessAt || now - new Date(local.lastSuccessAt).getTime() > STALE_MS) {
    if (!alerts.some((a) => a.message.startsWith("Le script"))) {
      alerts.push({
        level: "critical",
        message: `Dernière sauvegarde locale réussie il y a ${local.lastSuccessAt ? hoursAgo(local.lastSuccessAt, now) + " h" : "plus longtemps que l'historique"}.`,
      });
    }
  }

  const remote = status.remote ?? {};
  if (!remote.configured) {
    alerts.push({ level: "warn", message: "Copie hors serveur non configurée : une perte du serveur emporterait aussi les sauvegardes." });
  } else if (remote.status === "error") {
    alerts.push({
      level: "critical",
      message: `Copie hors serveur en échec : ${remote.error || "erreur inconnue"}${
        remote.lastSuccessAt ? ` (dernière réussite il y a ${hoursAgo(remote.lastSuccessAt, now)} h)` : ""
      }.`,
    });
  } else if (!remote.lastSuccessAt || now - new Date(remote.lastSuccessAt).getTime() > STALE_MS) {
    if (!alerts.some((a) => a.message.startsWith("Le script"))) {
      alerts.push({
        level: "critical",
        message: `Dernière copie hors serveur réussie il y a ${remote.lastSuccessAt ? hoursAgo(remote.lastSuccessAt, now) + " h" : "plus longtemps que l'historique"}.`,
      });
    }
  }

  const level = alerts.some((a) => a.level === "critical") ? "critical" : alerts.length ? "warn" : "ok";
  return { level, alerts };
}

// Email aux admins quand une alerte CRITIQUE apparaît (pas pour un simple
// avertissement). Un même problème n'est relancé qu'après 24 h ; un retour à la
// normale réarme l'alerte. Appelé par le planificateur, au plus une fois par heure.
export async function runBackupAlert(prisma, now = Date.now()) {
  const { level, alerts } = evaluateBackup(await readBackupStatus(), now);

  let state = null;
  try {
    state = JSON.parse(await fs.readFile(ALERT_FILE, "utf8"));
  } catch {}

  if (level !== "critical") {
    if (state) await fs.rm(ALERT_FILE, { force: true });
    return { sent: 0 };
  }
  if (!isMailerConfigured()) return { sent: 0, reason: "smtp" };

  const critical = alerts.filter((a) => a.level === "critical");
  // Signature sans les durées, pour ne pas relancer à chaque heure qui passe
  const key = critical.map((a) => a.message.replace(/\d+ h/g, "N h")).join("|");
  if (state?.key === key && now - state.at < REALERT_MS) return { sent: 0, reason: "deja-alerte" };

  const users = await prisma.user.findMany({ where: { disabled: false }, select: { email: true, role: true } });
  const to = users.filter(isAdminUser).map((u) => u.email);
  if (!to.length) return { sent: 0, reason: "aucun-admin" };

  const base = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
  const lines = critical.map((a) => `- ${a.message}`);
  const text = `Alerte sauvegardes LinkeePost :\n\n${lines.join("\n")}\n\nÉtat détaillé : ${base}/app (onglet Administration).\nJournal sur le serveur : /var/log/postgenius-backup.log`;
  let sent = 0;
  for (const email of to) {
    try {
      await sendMail({ to: email, subject: "⚠ LinkeePost : problème de sauvegarde", text });
      sent++;
    } catch (e) {
      console.error("[backup-alert] email non envoyé :", e.message);
    }
  }
  if (sent) await fs.writeFile(ALERT_FILE, JSON.stringify({ key, at: now }));
  return { sent };
}
