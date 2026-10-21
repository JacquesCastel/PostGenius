// Dictée vocale (partie serveur) : règles d'un enregistrement et appel au service de transcription.
// L'audio n'est jamais enregistré : il reste en mémoire le temps de l'appel.

export const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // comme les autres envois de fichiers
export const MIN_AUDIO_BYTES = 1024;
export const MAX_SECONDS = 180; // 3 minutes par enregistrement
export const MAX_TEXT_CHARS = 12000;

// Types acceptés par le service de transcription et produits par les navigateurs (WebM : Chrome et Android ; MP4 : Safari et iPhone)
const TYPES = {
  "audio/webm": "webm", "video/webm": "webm", "audio/mp4": "m4a", "video/mp4": "mp4", "audio/x-m4a": "m4a", "audio/m4a": "m4a",
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
};
export function audioExtension(mime) {
  const base = String(mime ?? "").split(";")[0].trim().toLowerCase();
  return TYPES[base] ?? null;
}

// Secondes facturées au quota : la durée annoncée par le navigateur, bornée, et jamais en dessous d'une estimation tirée du poids
// du fichier (un envoi long déclaré court ne doit pas passer inaperçu).
export function billedSeconds(declared, bytes) {
  const d = Math.max(0, Math.min(MAX_SECONDS, Math.round(Number(declared) || 0)));
  const floor = Math.min(MAX_SECONDS, Math.ceil(bytes / 48000));
  return Math.max(1, d, floor);
}

// Langues acceptées par le service (codes ISO de la langue de rédaction de l'application)
const LANGS = new Set(["fr", "en", "es", "de", "it", "pt", "nl", "ar", "pl"]);
export const transcribeLanguage = (code) => (LANGS.has(String(code)) ? String(code) : "fr");

// Appel au service de transcription (OpenAI). Lève une Error au message affichable.
export async function transcribe({ buffer, mime, language }) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error("Dictée indisponible : clé du service de transcription manquante sur le serveur."), { status: 500 });
  const ext = audioExtension(mime) ?? "webm";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: String(mime).split(";")[0] || "audio/webm" }), `dictee.${ext}`);
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
  form.append("language", transcribeLanguage(language));
  form.append("response_format", "json");
  let res;
  try {
    res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(55_000),
    });
  } catch {
    throw Object.assign(new Error("Le service de transcription ne répond pas. Réessayez dans un instant."), { status: 502 });
  }
  if (!res.ok) throw Object.assign(new Error("Transcription impossible pour le moment. Réessayez, ou écrivez votre texte."), { status: 502 });
  const data = await res.json().catch(() => ({}));
  return String(data.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_CHARS);
}
