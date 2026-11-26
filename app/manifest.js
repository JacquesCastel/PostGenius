// Manifest PWA (Next App Router) — rend Vercéa installable sur le téléphone,
// prérequis aux notifications push (surtout iOS).
export default function manifest() {
  return {
    name: "Vercéa",
    short_name: "Vercéa",
    description: "Votre expertise, vos mots, vos posts LinkedIn.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fff1f1",
    theme_color: "#ff5a5f",
    // Menu Partager du téléphone (Android, application installée) : le lien partagé ouvre l'écran « Partager vers Vercéa »
    share_target: { action: "/app/share", method: "GET", params: { title: "title", text: "text", url: "url" } },
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
