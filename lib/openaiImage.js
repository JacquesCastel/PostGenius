// Génération d'image via les modèles « gpt-image » d'OpenAI, partagée par « Illustration IA » et la médiathèque.
// OpenAI retire régulièrement ses anciens modèles (dall-e-2 et dall-e-3 le 12 mai 2026, gpt-image-1 à l'automne 2026) : on essaie donc une liste,
// du plus récent au plus ancien. OPENAI_IMAGE_MODELS (noms séparés par des virgules) la remplace sans changer le code.
// Renvoie { b64 } ou { error, status } (message lisible, avec ce que chaque modèle a répondu).

const OPENAI_API = process.env.OPENAI_API_BASE || "https://api.openai.com";
const DEFAULT_MODELS = "gpt-image-2,gpt-image-1.5,gpt-image-1-mini,gpt-image-1";

export async function generateImageB64(prompt) {
  const models = (process.env.OPENAI_IMAGE_MODELS || DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);
  const failures = []; // une ligne par modèle essayé : sert au message d'erreur final
  for (const model of models) {
    const res = await fetch(`${OPENAI_API}/v1/images/generations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, n: 1, size: "1536x1024", quality: "medium" }),
    });
    if (res.ok) {
      const data = await res.json();
      let b64 = data.data?.[0]?.b64_json ?? null;
      // Selon le modèle, l'image peut revenir sous forme d'adresse plutôt qu'en base64
      if (!b64 && data.data?.[0]?.url) {
        const img = await fetch(data.data[0].url).catch(() => null);
        if (img?.ok) b64 = Buffer.from(await img.arrayBuffer()).toString("base64");
      }
      if (b64) return { b64 };
      failures.push(`${model} : réponse sans image`);
      continue;
    }
    const err = await res.text();
    console.warn(`OpenAI ${model}:`, res.status, err.slice(0, 300));
    let detail = "";
    let code = "";
    try { const j = JSON.parse(err).error ?? {}; detail = j.message ?? ""; code = j.code ?? ""; } catch {}
    failures.push(`${model} : ${res.status}${detail ? " – " + detail.slice(0, 160) : ""}`);
    // Contenu refusé par la modération : un autre modèle dira la même chose
    if (code === "moderation_blocked" || /safety system|content policy/i.test(detail)) {
      return { status: 422, error: "L'image a été refusée par le filtre de sécurité d'OpenAI. Reformulez la description de l'image (évitez les sujets sensibles) et réessayez." };
    }
    if (res.status === 401) return { status: 502, error: "Clé OpenAI refusée (401) : vérifiez OPENAI_API_KEY." };
    if (res.status === 429 || /billing|quota/i.test(code + detail)) {
      return { status: 502, error: `OpenAI refuse la génération : quota ou crédit épuisé (${res.status}). Vérifiez le solde du compte OpenAI.` };
    }
    // Modèle inconnu, retiré ou non accessible (400/403/404) : on essaie le suivant ; autre erreur : on remonte directement
    if (res.status === 403 || res.status === 404 || res.status === 400) continue;
    return { status: 502, error: `Génération d'image refusée (${res.status})${detail ? " : " + detail : ""}` };
  }
  return { status: 500, error: `Aucun modèle d'image n'a répondu${failures.length ? " (" + failures.join(" ; ") + ")" : ""}. OpenAI retire régulièrement ses anciens modèles : indiquez ceux de votre compte dans OPENAI_IMAGE_MODELS.` };
}
