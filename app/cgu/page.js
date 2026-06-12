import Link from "next/link";

export const metadata = { title: "Conditions générales d'utilisation — PostGenius" };

export default function CGU() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-14 bg-white text-gray-800">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">← Retour à l'accueil</Link>
      <h1 className="text-2xl font-bold mt-4 mb-8">Conditions générales d'utilisation</h1>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="font-semibold text-base mb-2">1. Objet</h2>
          <p>
            PostGenius est un service SaaS d'aide à la création et à la gestion de campagnes de
            publication LinkedIn : génération de contenus assistée par IA, programmation,
            publication via l'API officielle LinkedIn et statistiques.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">2. Compte et essai</h2>
          <p>
            L'inscription est ouverte aux professionnels. L'essai gratuit dure 14 jours, sans
            engagement ni carte bancaire. Au-delà, l'accès aux fonctionnalités nécessite un
            abonnement payant, résiliable à tout moment avec effet en fin de période.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">3. Responsabilité sur les contenus</h2>
          <p>
            Les contenus générés par l'IA sont des propositions : l'utilisateur reste seul
            responsable des publications effectuées sur ses comptes LinkedIn, de leur véracité et de
            leur conformité aux conditions d'utilisation de LinkedIn et au droit applicable. Le mode
            de validation avant publication est disponible à cet effet.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">4. Usage raisonnable</h2>
          <p>
            Les plans « illimités » s'entendent dans le cadre d'un usage individuel raisonnable. Des
            limites techniques peuvent s'appliquer pour préserver la qualité du service. Tout usage
            abusif, automatisé hors fonctionnalités prévues, ou contraire aux CGU de LinkedIn peut
            entraîner la suspension du compte.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">5. Disponibilité</h2>
          <p>
            Le service est fourni « en l'état », avec une cible de disponibilité élevée mais sans
            garantie de continuité absolue, notamment en cas de maintenance ou d'indisponibilité des
            services tiers (LinkedIn, fournisseurs d'IA).
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">6. Tarifs et facturation</h2>
          <p>
            Les tarifs en vigueur sont affichés sur la page d'accueil, en euros hors taxes.
            L'abonnement est mensuel, payable d'avance, sans engagement de durée.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-base mb-2">7. Droit applicable</h2>
          <p>
            Les présentes CGU sont soumises au droit français. Tout litige relèvera des tribunaux
            compétents de [À COMPLÉTER : ville du siège].
          </p>
        </div>
      </section>
    </main>
  );
}
