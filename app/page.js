import Link from "next/link";
import {
  Linkedin, Sparkles, Megaphone, Eye, Clock, BarChart3, Image as ImageIcon,
  Check, ChevronRight, ShieldCheck, CalendarDays, Layers
} from "lucide-react";
import { getLanding } from "@/lib/landing";

// Page vitrine publique — postgenius.network
// L'application vit sur /app
// Rendu à la requête : le contenu (offres, hero, FAQ) est éditable depuis l'admin.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "PostGenius — Vos campagnes LinkedIn en pilote automatique",
  description:
    "L'IA qui transforme votre expertise en campagnes LinkedIn : posts contextualisés, veille connectée, programmation automatique et statistiques. Essai gratuit 14 jours.",
};

const FEATURES = [
  {
    icon: Megaphone,
    title: "Campagnes guidées par l'IA",
    text: "Un thème, un brief cadré par l'IA, un post d'exemple à valider — puis une série de posts qui se suivent et progressent vers votre message clé.",
  },
  {
    icon: Eye,
    title: "Veille connectée",
    text: "PostGenius surveille les sources de votre secteur et ancre vos posts dans l'actualité. Un article pertinent devient un post — ou une campagne entière.",
  },
  {
    icon: Sparkles,
    title: "Votre style, pas celui d'un robot",
    text: "Contexte métier, cible, positionnement, consignes d'écriture : chaque post est rédigé avec votre ADN, pas avec des phrases génériques.",
  },
  {
    icon: ImageIcon,
    title: "Illustrations générées",
    text: "Une image cohérente avec le contenu, générée par IA et publiée avec le post. Prompt automatique ou personnalisé.",
  },
  {
    icon: Clock,
    title: "Publication à votre rythme",
    text: "Choisissez vos jours et votre heure : les posts partent seuls, après votre validation si vous le souhaitez. Kanban et calendrier pour tout piloter.",
  },
  {
    icon: BarChart3,
    title: "Statistiques et suivi",
    text: "Progression de chaque campagne, posts publiés et à venir, vues et engagement — pour savoir ce qui fonctionne.",
  },
];

const PLANS = [
  {
    name: "Essentiel",
    price: "29",
    desc: "Pour publier régulièrement sans y passer ses soirées.",
    features: [
      "Posts et séries générés par l'IA",
      "Profil de rédaction (style, contexte métier)",
      "Programmation sur votre rythme",
      "15 posts par mois",
      "Publication sur votre profil LinkedIn",
    ],
    cta: "Commencer l'essai",
    highlight: false,
  },
  {
    name: "Pro",
    price: "59",
    desc: "L'outil de campagne complet pour les indépendants et consultants.",
    features: [
      "Tout Essentiel, posts illimités*",
      "Campagnes avec brief IA et progression",
      "Veille connectée et inspirations",
      "Images générées par IA (50/mois)",
      "Validation avant publication",
      "Statistiques détaillées",
    ],
    cta: "Commencer l'essai",
    highlight: true,
  },
  {
    name: "Agence",
    price: "149",
    desc: "Pour les équipes marketing et les pages entreprise.",
    features: [
      "Tout Pro, images illimitées*",
      "Publication sur page entreprise",
      "Statistiques de page (impressions, engagement)",
      "Multi-utilisateurs (bientôt)",
      "Support prioritaire",
    ],
    cta: "Commencer l'essai",
    highlight: false,
  },
];

const FAQ = [
  {
    q: "Comment PostGenius se connecte-t-il à LinkedIn ?",
    a: "Via l'API officielle de LinkedIn (OAuth) : vous autorisez l'application, aucun mot de passe LinkedIn ne nous est confié, et vous pouvez révoquer l'accès à tout moment.",
  },
  {
    q: "Qui écrit réellement les posts ?",
    a: "L'IA rédige à partir de votre contexte : activité, cible, marché, objectifs et consignes de style. Vous restez maître du contenu — chaque post peut être retouché, validé ou refusé avant publication.",
  },
  {
    q: "Mes posts seront-ils publiés sans mon accord ?",
    a: "C'est vous qui décidez : activez la validation et chaque post planifié attend votre feu vert. Ou laissez le pilote automatique gérer de bout en bout.",
  },
  {
    q: "Que se passe-t-il après les 14 jours d'essai ?",
    a: "Vous choisissez un plan pour continuer. Aucune carte bancaire n'est demandée pendant l'essai, rien n'est prélevé sans action de votre part.",
  },
  {
    q: "Puis-je résilier à tout moment ?",
    a: "Oui, l'abonnement est sans engagement : la résiliation prend effet à la fin de la période en cours.",
  },
];

export default async function Landing() {
  const content = await getLanding();
  const PLANS = content.plans;
  const FAQ = content.faq;
  const hero = content.hero;
  return (
    <div className="bg-white text-gray-900">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-md shadow-indigo-200">
            <Linkedin size={20} />
          </div>
          <span className="font-bold text-lg">PostGenius</span>
        </div>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
          <a href="#fonctionnalites" className="hover:text-gray-900">Fonctionnalités</a>
          <a href="#comment" className="hover:text-gray-900">Comment ça marche</a>
          <a href="#tarifs" className="hover:text-gray-900">Tarifs</a>
          <a href="#faq" className="hover:text-gray-900">FAQ</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Se connecter
          </Link>
          <Link
            href="/app"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-md shadow-indigo-200"
          >
            Essai gratuit
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full mb-5">
          <Sparkles size={13} /> {hero.badge}
        </p>
        <h1 className="text-4xl md:text-5xl font-bold leading-tight max-w-3xl mx-auto">
          {hero.title} <span className="text-indigo-600">{hero.titleAccent}</span>
        </h1>
        <p className="text-lg text-gray-500 mt-5 max-w-2xl mx-auto">{hero.subtitle}</p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link
            href="/app"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            Démarrer gratuitement <ChevronRight size={17} />
          </Link>
          <a
            href="#comment"
            className="border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-3 rounded-xl"
          >
            Voir comment ça marche
          </a>
        </div>

        {/* Aperçu stylisé */}
        <div className="mt-14 max-w-4xl mx-auto bg-slate-100 rounded-3xl p-4 shadow-xl">
          <div className="bg-white rounded-2xl p-6 text-left grid md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-orange-400 via-orange-500 to-pink-500">
              <p className="text-xs text-white/80">Publiés ce mois-ci</p>
              <p className="text-3xl font-bold">12</p>
              <p className="text-xs text-white/80 mt-3">8 à venir · 3 à valider</p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Megaphone size={13} className="text-indigo-600" /> Campagne « SEEPH 2026 »
              </p>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div className="h-full w-2/3 bg-green-500 rounded-full" />
              </div>
              <p className="text-xs text-gray-400">4/6 publiés · prochain : jeu. 09:00</p>
            </div>
            <div className="rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                <Eye size={13} className="text-indigo-600" /> Inspirations
              </p>
              <p className="text-xs text-gray-600 line-clamp-2 mb-1.5">
                « L'accessibilité numérique devient un critère d'appel d'offres »
              </p>
              <span className="text-[11px] text-indigo-600 font-medium">En faire un post →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités */}
      <section id="fonctionnalites" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center">
            Bien plus qu'un générateur de posts
          </h2>
          <p className="text-gray-500 text-center mt-3 max-w-2xl mx-auto">
            Un outil de gestion de campagne complet, du brief à la statistique.
          </p>
          <div className="grid md:grid-cols-3 gap-5 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 w-fit mb-4">
                  <f.icon size={20} />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comment ça marche */}
      <section id="comment" className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center">Comment ça marche</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {[
              {
                n: "1",
                icon: ShieldCheck,
                title: "Décrivez votre environnement",
                text: "Activité, cible, marché, objectifs, style d'écriture et rythme de publication : 5 minutes au départ, l'IA s'en souvient pour toujours.",
              },
              {
                n: "2",
                icon: Layers,
                title: "Lancez une campagne",
                text: "Un thème (ou un article de votre veille), 3 questions de cadrage, un post d'exemple à valider — la série se génère et se planifie sur vos créneaux.",
              },
              {
                n: "3",
                icon: CalendarDays,
                title: "Validez, c'est publié",
                text: "Chaque post attend votre feu vert (si vous le souhaitez) puis part automatiquement sur LinkedIn, image comprise. Suivez les retombées dans les statistiques.",
              },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-lg font-bold mx-auto shadow-lg shadow-indigo-200">
                  {s.n}
                </div>
                <h3 className="font-semibold mt-4 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tarifs */}
      <section id="tarifs" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center">Des tarifs simples</h2>
          <p className="text-gray-500 text-center mt-3">
            14 jours d'essai gratuit sur tous les plans, sans carte bancaire. Sans engagement.
          </p>
          <div className="grid md:grid-cols-3 gap-5 mt-12 items-start">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`bg-white rounded-2xl p-6 ${
                  p.highlight
                    ? "border-2 border-indigo-600 shadow-xl shadow-indigo-100 relative"
                    : "border border-gray-100 shadow-sm"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Le plus choisi
                  </span>
                )}
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-sm text-gray-500 mt-1 min-h-10">{p.desc}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold">{p.price} €</span>
                  <span className="text-gray-400 text-sm"> /mois HT</span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check size={15} className="text-green-500 mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/app?plan=${p.name.toLowerCase()}`}
                  className={`mt-6 block text-center font-medium px-4 py-2.5 rounded-xl ${
                    p.highlight
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200"
                      : "border border-gray-200 hover:border-indigo-400 text-gray-700"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 text-center mt-6">
            * Usage raisonnable : des limites techniques s'appliquent pour garantir la qualité du service.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="bg-white border border-gray-100 shadow-sm rounded-2xl p-5 group">
                <summary className="font-medium text-sm cursor-pointer list-none flex items-center justify-between">
                  {item.q}
                  <ChevronRight size={16} className="text-gray-400 group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white text-center p-12 shadow-xl shadow-indigo-200">
          <h2 className="text-3xl font-bold">Votre prochaine campagne commence aujourd'hui</h2>
          <p className="text-white/80 mt-3">14 jours pour l'essayer, 5 minutes pour la lancer.</p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-white text-indigo-700 font-semibold px-6 py-3 rounded-xl mt-7 hover:bg-indigo-50"
          >
            Créer mon compte gratuitement <ChevronRight size={17} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 text-white p-1.5 rounded-lg">
              <Linkedin size={14} />
            </div>
            <span className="font-semibold text-gray-600">PostGenius</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link href="/mentions-legales" className="hover:text-gray-600">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-gray-600">CGU</Link>
            <Link href="/confidentialite" className="hover:text-gray-600">Confidentialité</Link>
            <a href="mailto:contact@postgenius.network" className="hover:text-gray-600">Contact</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
