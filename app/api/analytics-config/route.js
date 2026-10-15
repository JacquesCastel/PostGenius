import { NextResponse } from "next/server";

// GET — configuration de la mesure d'audience (Umami), lue à l'exécution : le script n'est chargé que si les deux variables sont valides.
// UMAMI_SCRIPT_URL : adresse du script (https://cloud.umami.is/script.js, ou celle de votre Umami) ; UMAMI_WEBSITE_ID : identifiant du site (UUID).
// Par défaut : Umami Cloud et le site postgenius.network (l'identifiant du site est public, visible dans le code de chaque page) ;
// les variables du serveur les remplacent, par exemple pour un Umami auto-hébergé. UMAMI_DISABLED=1 coupe la mesure.
export const dynamic = "force-dynamic";

const DEFAULT_SRC = "https://cloud.umami.is/script.js";
const DEFAULT_ID = "d2f17e64-dbd5-4832-80bb-b75daf2b9814";

export async function GET() {
  if (process.env.UMAMI_DISABLED === "1") return NextResponse.json({ src: null, id: null });
  const src = String(process.env.UMAMI_SCRIPT_URL || DEFAULT_SRC).trim();
  const id = String(process.env.UMAMI_WEBSITE_ID || DEFAULT_ID).trim();
  const valid = /^https:\/\/[^\s"'<>]+$/.test(src) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  return NextResponse.json(valid ? { src, id } : { src: null, id: null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
