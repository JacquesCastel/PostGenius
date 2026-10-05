// Kit de tournage : le script vidéo généré par l'IA, mis en forme pour filmer.
// Nouveau format de "extra" pour un post vidéo :
//   { title, items: ["0-5s — ..."], shots: [{ time, say, show, onScreen }], tips: ["..."] }
// Les anciens brouillons n'ont que "items" ("0-5s — texte") : on en déduit les
// plans, sans partie "show" ni conseils.

const cut = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

// Nettoie la réponse du modèle (types, longueurs, plans vides) ; renvoie extra
// inchangé s'il n'y a pas de plans exploitables.
export function normalizeVideoExtra(extra) {
  if (!extra || typeof extra !== "object") return extra ?? null;
  const shots = (Array.isArray(extra.shots) ? extra.shots : [])
    .map((s) => ({
      time: cut(s?.time, 20),
      say: cut(s?.say, 600),
      show: cut(s?.show, 300),
      onScreen: cut(s?.onScreen, 100) || null,
    }))
    .filter((s) => s.say)
    .slice(0, 20);
  const tips = (Array.isArray(extra.tips) ? extra.tips : []).map((t) => cut(t, 200)).filter(Boolean).slice(0, 5);
  return { ...extra, ...(shots.length ? { shots } : {}), ...(tips.length ? { tips } : {}) };
}

// Plans d'un script : les "shots" structurés, sinon déduits de "items"
export function getShots(extra) {
  if (Array.isArray(extra?.shots) && extra.shots.length) return extra.shots;
  return (Array.isArray(extra?.items) ? extra.items : [])
    .map((it) => {
      const m = /^\s*([0-9]+\s*(?:-|–|à)\s*[0-9]+\s*s?)\s*[—–:-]\s*(.+)$/s.exec(String(it));
      return m ? { time: m[1].replace(/\s+/g, ""), say: m[2].trim(), show: "", onScreen: null } : { time: "", say: String(it), show: "", onScreen: null };
    })
    .filter((s) => s.say);
}

// Texte à lire au prompteur : ce qui est dit, plan après plan
export function spokenScript(extra) {
  return getShots(extra).map((s) => s.say).join("\n\n");
}

// Version texte du plan de tournage (copie / téléchargement)
export function kitToText(postText, extra) {
  const shots = getShots(extra);
  const lines = [extra?.title || "Plan de tournage", ""];
  shots.forEach((s, i) => {
    lines.push(`Plan ${i + 1}${s.time ? ` (${s.time})` : ""}`);
    lines.push(`  À dire : ${s.say}`);
    if (s.show) lines.push(`  À montrer : ${s.show}`);
    if (s.onScreen) lines.push(`  Texte à l'écran : ${s.onScreen}`);
    lines.push("");
  });
  if (extra?.tips?.length) {
    lines.push("Conseils de tournage");
    extra.tips.forEach((t) => lines.push(`  - ${t}`));
    lines.push("");
  }
  if (postText) lines.push("Texte du post à publier avec la vidéo", "", postText);
  return lines.join("\n");
}
