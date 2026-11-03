// Conseiller éditorial : appel au modèle (un seul endroit). Aucun texte d'utilisateur n'est écrit dans les logs ; seules des erreurs typées le sont.
export class AdvisorError extends Error {
  constructor(code, message, status = 502) { super(message); this.code = code; this.status = status; }
}

export const MODELS = {
  // Analyse du brief : tâche courte, modèle rapide et économique
  brief: () => process.env.EDITORIAL_BRIEF_MODEL || "claude-haiku-4-5",
  // Vérification : le vérificateur indépendant mesuré (Sonnet, protocole v2)
  verify: () => process.env.EDITORIAL_VERIFIER_MODEL || "claude-sonnet-4-6",
  // Reformulation prudente d'un passage : modèle du moteur de génération
  rewrite: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
};

export async function callClaude({ model, system, user, maxTokens = 1500, temperature = 0, timeoutMs = 45_000 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AdvisorError("config", "Le service d'IA n'est pas configuré.", 500);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: "user", content: user }] }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e?.name === "AbortError") throw new AdvisorError("timeout", "La vérification a pris trop de temps. Votre texte est conservé : vous pouvez réessayer.", 504);
    throw new AdvisorError("network", "Le service d'IA est injoignable pour le moment. Votre texte est conservé : vous pouvez réessayer.");
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    if (res.status === 503) throw new AdvisorError("ai_off", "L'IA est momentanément suspendue. Réessayez plus tard.", 503);
    if (res.status === 429) throw new AdvisorError("provider_rate", "Le service d'IA est très sollicité. Réessayez dans un instant.", 429);
    throw new AdvisorError("provider", "Le service d'IA a rencontré une erreur. Votre texte est conservé : vous pouvez réessayer.");
  }
  const d = await res.json().catch(() => null);
  return { text: d?.content?.[0]?.text ?? "", inputTokens: d?.usage?.input_tokens ?? 0, outputTokens: d?.usage?.output_tokens ?? 0, ms: Date.now() - t0, model };
}

export function errorBody(e) {
  if (e instanceof AdvisorError) return { body: { error: e.message, code: e.code }, status: e.status };
  return { body: { error: "Une erreur est survenue. Votre texte est conservé : vous pouvez réessayer.", code: "unknown" }, status: 500 };
}
