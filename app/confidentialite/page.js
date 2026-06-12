import Link from "next/link";

export const metadata = { title: "Politique de confidentialité — PostGenius" };

export default function Confidentialite() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-14 bg-white text-gray-800">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Retour à l'accueil</Link>
      <h1 className="text-2xl font-bold mt-4 mb-8">Politique de confidentialité</h1>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold text-base mb-2">Responsable de traitement</h2>
          <p>
            [À COMPLÉTER : raison sociale] — contact :{" "}
            <a href="mailto:contact@postgenius.network" className="text-indigo-600">contact@postgenius.network</a>
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Données collectées</h2>
          <p>
            Données de compte (email, nom, mot de passe chiffré), profil de rédaction (contexte
            métier, préférences), contenus créés (posts, campagnes, images générées), jetons d'accès
            LinkedIn (chiffrés en base, révocables à tout moment), sources de veille, données de
            consommation du service, et — si vous le connectez — statistiques de votre profil
            LinkedIn via notre partenaire Phyllo.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Finalités et bases légales</h2>
          <p>
            Fourniture du service (exécution du contrat) : génération de contenus, publication
            LinkedIn, programmation, statistiques. Facturation et obligations légales. Amélioration
            du service et suivi de consommation (intérêt légitime).
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Sous-traitants</h2>
          <p>
            Hetzner (hébergement, Allemagne), Neon (base de données, UE), Anthropic (génération de
            texte), OpenAI (génération d'images), LinkedIn (publication via API officielle), Phyllo
            (statistiques de profil, sur connexion explicite), Brevo (emails transactionnels). Les
            contenus transmis aux services d'IA le sont uniquement pour produire vos posts.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Durées de conservation</h2>
          <p>
            Les données sont conservées pendant la durée de vie du compte, puis supprimées dans un
            délai de 30 jours après sa clôture. Les jetons LinkedIn expirent automatiquement (≈60
            jours) et sont supprimés à la déconnexion du compte LinkedIn.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Vos droits</h2>
          <p>
            Conformément au RGPD, vous disposez de droits d'accès, de rectification, d'effacement,
            de portabilité et d'opposition. Exercez-les par email à{" "}
            <a href="mailto:contact@postgenius.network" className="text-indigo-600">contact@postgenius.network</a>.
            Vous pouvez introduire une réclamation auprès de la CNIL (cnil.fr).
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">Cookies</h2>
          <p>
            PostGenius n'utilise que des cookies strictement nécessaires au fonctionnement
            (session d'authentification). Aucun cookie publicitaire ou de mesure d'audience tierce.
          </p>
        </div>
      </section>
    </main>
  );
}
