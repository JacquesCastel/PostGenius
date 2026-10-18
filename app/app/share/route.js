import { shareQuery } from "@/lib/shareLink";

// Cible du menu Partager (application installée) et du favori du navigateur : GET /app/share?url=…&title=…&text=…
// Redirige vers l'écran de partage de l'application (la connexion éventuelle se fait là), avec des champs bornés.
export function GET(req) {
  const q = new URL(req.url).searchParams;
  return new Response(null, { status: 302, headers: { Location: shareQuery({ url: q.get("url"), title: q.get("title"), text: q.get("text") }), "Cache-Control": "no-store" } });
}
