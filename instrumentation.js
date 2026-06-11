// Planificateur local : vérifie chaque minute les posts programmés à publier.
// Fonctionne en dev (npm run dev) et sur un serveur Node persistant (npm start).
// Sur Vercel (serverless), c'est Vercel Cron qui appelle /api/cron/publish-due
// (voir vercel.json) — ce fichier est alors sans effet durable, sans danger.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.DISABLE_LOCAL_SCHEDULER !== "1") {
    const { runDuePublications } = await import("./lib/scheduler");
    setInterval(() => {
      runDuePublications().catch((e) => console.error("[scheduler]", e));
    }, 60_000);
    console.log("[scheduler] Planificateur local démarré (vérification chaque minute)");
  }
}
