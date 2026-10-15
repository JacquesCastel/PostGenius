import { NextResponse } from "next/server";

// GET — configuration de la mesure d'audience (Umami), lue à l'exécution : le script n'est chargé que si les deux variables sont valides.
// UMAMI_SCRIPT_URL : adresse du script (https://cloud.umami.is/script.js, ou celle de votre Umami) ; UMAMI_WEBSITE_ID : identifiant du site (UUID).
export const dynamic = "force-dynamic";

export async function GET() {
  const src = String(process.env.UMAMI_SCRIPT_URL ?? "").trim();
  const id = String(process.env.UMAMI_WEBSITE_ID ?? "").trim();
  const valid = /^https:\/\/[^\s"'<>]+$/.test(src) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return NextResponse.json(valid ? { src, id } : { src: null, id: null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
