import { getFlags } from "./opsFlags";

// Coupe-circuit de l'IA : quand le super-admin a coupé l'IA, tout appel sortant vers Anthropic ou OpenAI est refusé ICI, en un seul point,
// au lieu d'être vérifié dans chacune des routes. L'appelant reçoit une réponse 503 ordinaire (corps JSON, message en français),
// qu'il traite comme n'importe quelle erreur du fournisseur. Installé au démarrage par instrumentation.js.
const AI_HOST = /^https?:\/\/api\.(anthropic|openai)\.com\//i;
const g = globalThis;
const LI_HOSTS = ["https://api.linkedin.com/", `${(process.env.LINKEDIN_API_BASE || "").replace(/\/$/, "")}/`].filter((h) => h.length > 2);
// Appels à l'API LinkedIn (par jour) : { "AAAA-MM-JJ": { n, err, r429 } }. Gardés en mémoire, versés en base par le planificateur (lib/linkedinCalls.js)
export const liCalls = (g.__liCalls ??= {});
const dayKey = () => new Date().toISOString().slice(0, 10);
// Compteur d'appels par fournisseur (depuis le démarrage du processus) : lu par le tableau de bord technique
export const aiStats = (g.__aiStats ??= { anthropic: 0, openai: 0, blocked: 0, since: Date.now() });

export function installAiGuard() {
  if (g.__aiGuardInstalled) return;
  g.__aiGuardInstalled = true;
  const original = g.fetch;
  g.fetch = async function guardedFetch(input, init) {
    let url = "";
    try { url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url ?? ""; } catch {}
    const m = AI_HOST.exec(url);
    if (!m) {
      if (LI_HOSTS.some((h) => url.startsWith(h))) {
        const c = (liCalls[dayKey()] ??= { n: 0, err: 0, r429: 0 });
        c.n++;
        try {
          const res = await original(input, init);
          if (res.status === 429) c.r429++;
          if (res.status >= 400) c.err++;
          return res;
        } catch (e) { c.err++; throw e; }
      }
      return original(input, init);
    }
    if ((await getFlags()).aiOff) {
      aiStats.blocked++;
      const body = JSON.stringify({ error: { type: "ai_off", message: "L'IA est momentanément suspendue par l'administrateur. Réessayez plus tard." } });
      return new Response(body, { status: 503, headers: { "content-type": "application/json", "retry-after": "600" } });
    }
    aiStats[m[1].toLowerCase()]++;
    return original(input, init);
  };
}
