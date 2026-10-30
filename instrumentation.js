// Planificateur local : vérifie chaque minute les posts programmés à publier.
// Fonctionne en dev (npm run dev) et sur un serveur Node persistant (npm start).
// Sur Vercel (serverless), c'est Vercel Cron qui appelle /api/cron/publish-due
// (voir vercel.json) — ce fichier est alors sans effet durable, sans danger.

export async function register() {
  // Configuration à vérifier en production : sans elle, des fonctions échouent silencieusement côté utilisateur
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV === "production") {
    if (!process.env.SMTP_HOST) console.warn("[config] SMTP_HOST absent : aucun e-mail ne partira (invitations d'équipe, liens de validation client, notifications, mot de passe oublié).");
    if (!process.env.APP_URL || /localhost|127\.0\.0\.1/.test(process.env.APP_URL)) console.warn("[config] APP_URL absent ou local : les liens envoyés (validation client, rapports, invitations) pointeront vers une mauvaise adresse.");
  }
  // Transcriptions de vidéos : effacées au plus tard après 24 h, même si personne n'envoie rien dans l'intervalle
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { purgeMediaJobs } = await import("./lib/mediaJobs");
    const run = () => purgeMediaJobs().catch((e) => console.error("[media] nettoyage", e));
    setTimeout(run, 60_000);
    setInterval(run, 30 * 60_000);
  }
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_LOCAL_SCHEDULER !== "1") {
    const { runDuePublications } = await import("./lib/scheduler");
    setInterval(() => {
      runDuePublications().catch((e) => console.error("[scheduler]", e));
    }, 60_000);
    console.log("[scheduler] Planificateur local démarré (vérification chaque minute)");
  }
}
