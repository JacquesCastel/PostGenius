import "./globals.css";

export const metadata = {
  title: "LinkeePost — Générateur de posts LinkedIn",
  description: "Générez des posts LinkedIn percutants avec l'IA et publiez-les en un clic.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className="bg-slate-100 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
