// Brouillons de campagne : la création en cours est enregistrée au fil de l'eau (état opaque du client, borné).
export const MAX_DRAFTS = 20;
export const MAX_STATE_BYTES = 250_000;

export function packDraft(body) {
  const kind = body?.kind === "brief" ? "brief" : "wizard";
  const state = body?.state && typeof body.state === "object" ? body.state : null;
  if (!state) throw new Error("État du brouillon manquant.");
  const json = JSON.stringify({ kind, state });
  if (json.length > MAX_STATE_BYTES) throw new Error("Brouillon trop volumineux.");
  const name = String(body?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || (kind === "brief" ? "Brief importé" : "Campagne sans titre");
  return { json, name };
}

