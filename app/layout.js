import "./globals.css";

const SITE = (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");

export const metadata = {
  metadataBase: new URL(SITE),
  title: "LinkeePost — Générateur de posts LinkedIn",
  description: "Générez des posts LinkedIn percutants avec l'IA et publiez-les en un clic.",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }], shortcut: "/favicon.ico", apple: "/icon.svg" },
  // Aperçu des liens partagés (LinkedIn, Slack…) ; l'image est app/opengraph-image.js
  openGraph: { type: "website", siteName: "LinkeePost", locale: "fr_FR" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
