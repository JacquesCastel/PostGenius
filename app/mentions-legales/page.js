import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = { title: "Mentions légales — PostGenius" };

// ⚠️ Compléter les champs [À COMPLÉTER] avant ouverture commerciale.

export default function MentionsLegales() {
  return (
    <div className="bg-gradient-to-b from-rose-50/60 via-white to-white text-[#1b2a4a] min-h-screen flex flex-col">
      <SiteHeader />
      <main className="max-w-4xl mx-auto px-6 py-14 flex-1 w-full">
        <Link href="/" className="text-sm text-[#ff5a5f] hover:underline">← Retour à l'accueil</Link>
        <h1 className="text-3xl font-bold mt-4 mb-8">Mentions légales</h1>

        <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold text-base mb-2">Éditeur du site</h2>
          <p>
            PostGenius est édité par <strong>[À COMPLÉTER : raison sociale]</strong>,{" "}
            [À COMPLÉTER : forme juridique, ex. SASU au capital de X €], immatriculée au RCS de{" "}
            [À COMPLÉTER : ville] sous le numéro [À COMPLÉTER : SIREN], dont le siège social est
            situé [À COMPLÉTER : adresse].
            <br />
            N° TVA intracommunautaire : [À COMPLÉTER]
            <br />
            Directeur de la publication : [À COMPLÉTER : nom]
            <br />
            Contact : <a href="mailto:contact@postgenius.network" className="text-indigo-600">contact@postgenius.network</a>
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Hébergement</h2>
          <p>
            Le site est hébergé par <strong>Hetzner Online GmbH</strong>, Industriestr. 25,
            91710 Gunzenhausen, Allemagne — www.hetzner.com.
            <br />
            Base de données hébergée par <strong>Neon Inc.</strong> (région UE — Francfort).
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Propriété intellectuelle</h2>
          <p>
            L'ensemble des éléments du site (textes, interface, marque, logo) est protégé par le
            droit de la propriété intellectuelle. Toute reproduction sans autorisation est interdite.
            LinkedIn est une marque déposée de LinkedIn Corporation ; PostGenius est un service
            indépendant, non affilié à LinkedIn.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Données personnelles</h2>
          <p>
            Les modalités de traitement des données personnelles sont détaillées dans la{" "}
            <Link href="/confidentialite" className="text-indigo-600">politique de confidentialité</Link>.
          </p>
        </div>
      </section>
      </main>
      <SiteFooter />
    </div>
  );
}
