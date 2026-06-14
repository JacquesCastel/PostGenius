// Manifest PWA (Next App Router) — rend LinkeePost installable sur le téléphone,
// prérequis aux notifications push (surtout iOS).
export default function manifest() {
  return {
    name: "LinkeePost",
    short_name: "LinkeePost",
    description: "Vos campagnes LinkedIn en pilote automatique.",
    start_url: "/app",
    display: "standalone",
    background_color: "#fff1f1",
    theme_color: "#ff5a5f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
