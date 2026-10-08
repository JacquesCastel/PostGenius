// Contexte propre à un post : public visé, objectif, angle. Pré-rempli depuis le profil ; seul ce qui diffère
// du profil est envoyé au modèle comme consigne prioritaire pour ce post (le profil n'est jamais modifié).

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const LIMITS = { audience: 300, goal: 200, angle: 400 };
// Objectifs : liste CSV, comparée sans tenir compte de l'ordre
const goalKey = (s) => norm(s).split(",").map((g) => g.trim().toLowerCase()).filter(Boolean).sort().join(",");

// raw : { audience, goal, angle } saisi dans le formulaire ; profile : { targetAudience, commGoals }
// Renvoie uniquement les champs renseignés ET différents du profil.
export function cleanPostContext(raw, profile) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  const audience = norm(raw.audience).slice(0, LIMITS.audience);
  const goal = norm(raw.goal).slice(0, LIMITS.goal);
  const angle = norm(raw.angle).slice(0, LIMITS.angle);
  if (audience && audience.toLowerCase() !== norm(profile?.targetAudience).toLowerCase()) out.audience = audience;
  if (goal && goalKey(goal) !== goalKey(profile?.commGoals)) out.goal = goal;
  if (angle) out.angle = angle;
  return out;
}

export function postContextBlock(ctx) {
  if (!ctx || (!ctx.audience && !ctx.goal && !ctx.angle)) return "";
  let b = "\n\nCONTEXTE PROPRE À CE POST (prioritaire sur le profil en cas de différence — À RESPECTER) :";
  if (ctx.audience) b += `\n- Public visé par ce post : ${ctx.audience} (remplace l'audience générale du profil pour ce post)`;
  if (ctx.goal) b += `\n- Objectif de ce post : ${ctx.goal.split(",").map((g) => g.trim()).join(", ")} (oriente le fond et l'appel à l'action)`;
  if (ctx.angle) b += `\n- Angle souhaité : ${ctx.angle}`;
  return b;
}
