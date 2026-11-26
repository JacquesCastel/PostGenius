import { pick } from "@/lib/access";

// Données structurées de la page d'accueil (Organisation et application), partagées par l'ancienne et la nouvelle accueil.
export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify([
          { "@context": "https://schema.org", "@type": "Organization", name: "Vercéa", url: "https://linkeepost.app", logo: "https://linkeepost.app/icon.svg" },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Vercéa",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            inLanguage: "fr",
            url: "https://linkeepost.app",
            description: "Création, validation, programmation et suivi de posts LinkedIn assistés par IA, pour indépendants et agences.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", description: pick("Accès sur invitation pendant la bêta fermée, sans carte bancaire", "Essai gratuit 14 jours, sans carte bancaire") },
          },
        ]).replace(/</g, "\\u003c"),
      }}
    />
  );
}
