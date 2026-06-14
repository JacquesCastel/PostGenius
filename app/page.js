import Link from "next/link";
import {
  Sparkles, Megaphone, Eye, Clock, BarChart3, Image as ImageIcon,
  Check, ChevronRight, ShieldCheck, CalendarDays, Layers, PlayCircle, ArrowUp, MapPin, UserRound,
  Gauge, PenLine,
} from "lucide-react";
import { getLanding } from "@/lib/landing";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

// Page vitrine publique — postgenius.network
// Rendu à la requête : le contenu (offres, hero, FAQ) est éditable depuis l'admin.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "LinkeePost — Vos campagnes LinkedIn en pilote automatique",
  description:
    "L'IA qui transforme votre expertise en campagnes LinkedIn : posts contextualisés, veille connectée, programmation automatique et statistiques. Essai gratuit 14 jours.",
};

const FEATURES = [
  { icon: UserRound, title: "Profil de rédaction", text: "Activité, cible, marché, ton et rythme — décrits une fois (ou déduits de votre site par l'IA), et chaque contenu est calibré à votre image." },
  { icon: Megaphone, title: "Campagnes guidées par l'IA", text: "Un thème, un brief cadré par l'IA, un post d'exemple à valider — puis une série de posts qui progressent vers votre message clé." },
  { icon: Eye, title: "Veille connectée", text: "LinkeePost surveille les sources de votre secteur et ancre vos posts dans l'actualité. Un article pertinent devient un post." },
  { icon: Sparkles, title: "Votre style, pas un robot", text: "Contexte métier, cible, positionnement, consignes d'écriture : chaque post est rédigé avec votre ADN." },
  { icon: ImageIcon, title: "Illustrations générées", text: "Une image cohérente avec le contenu, générée par IA et publiée avec le post. Prompt automatique ou personnalisé." },
  { icon: Clock, title: "Publication à votre rythme", text: "Choisissez vos jours et votre heure : les posts partent seuls, après votre validation si vous le souhaitez." },
  { icon: MapPin, title: "Module Événements", text: "Salons et forums : posts de présence générés et programmés autour des dates. Le jour J, une notification vous invite à poster une photo en direct. (Offre Agence)" },
  { icon: Layers, title: "Carrousels & vidéos", text: "Au-delà du post simple : carrousels (plan de slides) et scripts vidéo générés par l'IA, prêts à publier — les formats qui engagent le plus." },
  { icon: BarChart3, title: "Statistiques et suivi", text: "Progression de chaque campagne, posts publiés et à venir, vues et engagement — pour savoir ce qui fonctionne." },
];

const STEPS = [
  { n: "1", icon: ShieldCheck, title: "Décrivez votre environnement", text: "Activité, cible, marché, objectifs, style et rythme : 5 minutes au départ, l'IA s'en souvient pour toujours." },
  { n: "2", icon: Layers, title: "Lancez une campagne", text: "Un thème, 3 questions de cadrage, un post d'exemple à valider — la série se génère et se planifie sur vos créneaux." },
  { n: "3", icon: CalendarDays, title: "Validez, c'est publié", text: "Chaque post attend votre feu vert puis part automatiquement sur LinkedIn, image comprise. Suivez les retombées." },
];

const PROOFS = [
  { big: "14 j", small: "d'essai gratuit" },
  { big: "0 €", small: "sans carte bancaire" },
  { big: "100 %", small: "API officielle LinkedIn" },
  { big: "5 min", small: "pour lancer une campagne" },
];

function BackToTop() {
  return (
    <div className="flex justify-end -mb-2">
      <a
        href="#top"
        className="inline-flex items-center gap-1 text-xs font-medium text-[#5a6b85] hover:text-[#ff5a5f] transition-colors"
      >
        Haut de page <ArrowUp size={13} />
      </a>
    </div>
  );
}

export default async function Landing() {
  const content = await getLanding();
  const { hero, plans: PLANS, faq: FAQ } = content;

  return (
    <div className="relative overflow-hidden text-[#1b2a4a] bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50">
      {/* Halos décoratifs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-48 -right-24 w-[24rem] h-[24rem] rounded-full bg-sky-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-[60rem] left-0 w-[26rem] h-[26rem] rounded-full bg-orange-200/30 blur-3xl" />

      <div id="top" className="relative">
        <SiteHeader />

        {/* Hero */}
        <section className="max-w-6xl mx-auto px-6 pt-10 pb-16 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full mb-5">
              <Sparkles size={13} /> {hero.badge}
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              {hero.title} <span className="text-[#ff5a5f]">{hero.titleAccent}</span>
            </h1>
            <p className="text-lg text-[#5a6b85] mt-5 max-w-xl">{hero.subtitle}</p>
            <div className="flex items-center gap-4 mt-8">
              <Link
                href="/app"
                className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-rose-300/50 flex items-center gap-2 transition-colors"
              >
                Démarrer gratuitement <ChevronRight size={17} />
              </Link>
              <a href="#comment" className="inline-flex items-center gap-2 font-medium text-[#1b2a4a] hover:text-[#ff5a5f] transition-colors">
                <PlayCircle size={22} className="text-[#ff5a5f]" /> Voir comment ça marche
              </a>
            </div>
          </div>

          {/* Aperçu produit avec cartes flottantes */}
          <div className="relative">
            <div className="absolute -top-4 -left-4 bg-white rounded-2xl shadow-xl shadow-rose-200/40 px-4 py-3 z-10 hidden sm:block">
              <p className="text-[10px] text-gray-400">Publiés ce mois-ci</p>
              <p className="text-2xl font-extrabold text-[#ff5a5f]">12</p>
            </div>
            <div className="absolute -bottom-5 -right-3 bg-white rounded-2xl shadow-xl shadow-sky-200/40 px-4 py-3 z-10 hidden sm:flex items-center gap-2">
              <BarChart3 size={18} className="text-sky-500" />
              <div>
                <p className="text-[10px] text-gray-400">Engagement</p>
                <p className="text-sm font-bold">+38 %</p>
              </div>
            </div>

            <div className="bg-white/70 backdrop-blur rounded-[2rem] p-4 shadow-2xl shadow-rose-200/40 border border-white">
              <div className="bg-white rounded-3xl p-5 space-y-4">
                <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-orange-400 via-[#ff5a5f] to-pink-500">
                  <p className="text-xs text-white/80">Campagne en cours</p>
                  <p className="text-xl font-bold mt-0.5">« Accessibilité 2026 »</p>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden mt-3">
                    <div className="h-full w-2/3 bg-white rounded-full" />
                  </div>
                  <p className="text-xs text-white/80 mt-2">4/6 publiés · prochain jeu. 09:00</p>
                </div>
                <div className="rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
                    <Eye size={13} className="text-[#ff5a5f]" /> Inspiration du jour
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed">« L'accessibilité numérique devient un critère d'appel d'offres »</p>
                  <span className="text-[11px] text-[#ff5a5f] font-semibold mt-1.5 inline-block">En faire un post →</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bandeau de réassurance */}
        <section className="max-w-5xl mx-auto px-6 pb-8">
          <div className="bg-white/70 backdrop-blur rounded-3xl border border-white shadow-sm grid grid-cols-2 md:grid-cols-4 divide-x divide-rose-100">
            {PROOFS.map((p) => (
              <div key={p.small} className="text-center py-6 px-3">
                <p className="text-2xl md:text-3xl font-extrabold text-[#ff5a5f]">{p.big}</p>
                <p className="text-xs text-[#5a6b85] mt-1">{p.small}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fonctionnalités */}
        <section id="fonctionnalites" className="max-w-6xl mx-auto px-6 py-20">
          <BackToTop />
          <p className="text-center text-sm font-semibold text-[#ff5a5f]">Ce que fait LinkeePost</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mt-2">Bien plus qu'un générateur de posts</h2>
          <p className="text-[#5a6b85] text-center mt-3 max-w-2xl mx-auto">Un outil de gestion de campagne complet, du brief à la statistique.</p>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 p-6 hover:-translate-y-1 transition-transform">
                <div className="p-3 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-4">
                  <f.icon size={22} />
                </div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-[#5a6b85] leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/fonctionnalites"
              className="inline-flex items-center gap-2 bg-white border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a] font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Découvrir toutes les fonctionnalités en détail <ChevronRight size={17} className="text-[#ff5a5f]" />
            </Link>
          </div>
        </section>

        {/* Atout : Score d'engagement */}
        <section className="max-w-6xl mx-auto px-6 py-10">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#1b2a4a] to-[#2b3f6b] text-white p-8 md:p-12 shadow-2xl shadow-sky-200/40 grid lg:grid-cols-2 gap-10 items-center relative overflow-hidden">
            <div className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 bg-[#ff5a5f]/20 rounded-full blur-3xl" />
            <div className="relative">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#ff5a5f] px-3 py-1.5 rounded-full mb-5">
                <Gauge size={13} /> Exclusivité LinkeePost
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight">
                Un <span className="text-[#ff8a8d]">score d'engagement</span> sur chaque post, avant de publier
              </h2>
              <p className="text-white/80 mt-4 leading-relaxed">
                LinkeePost note le potentiel de votre post sur 100 et vous explique, critère par critère, comment l'améliorer.
                Réécrivez l'accroche, le corps ou la signature en un clic — et voyez le score grimper en direct.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Score instantané + conseils personnalisés par l'IA",
                  "Réécriture ciblée : accroche, corps ou signature",
                  "Historique des versions, restaurables à tout moment",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2 text-sm text-white/90">
                    <Check size={16} className="text-[#ff8a8d] mt-0.5 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3 mt-7">
                <Link
                  href="/scoring"
                  className="bg-white text-[#1b2a4a] font-semibold px-6 py-3 rounded-full hover:bg-rose-50 transition-colors inline-flex items-center justify-center gap-2"
                >
                  Comment on calcule votre score <ChevronRight size={16} />
                </Link>
                <Link
                  href="/app"
                  className="border border-white/40 text-white font-semibold px-6 py-3 rounded-full hover:bg-white/10 transition-colors text-center"
                >
                  L'essayer gratuitement
                </Link>
              </div>
            </div>

            {/* Aperçu de la jauge */}
            <div className="relative">
              <div className="bg-white text-[#1b2a4a] rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-5">
                  <div className="text-center shrink-0">
                    <p className="text-5xl font-extrabold text-[#16a34a] leading-none">82</p>
                    <p className="text-xs text-gray-400 mt-1">/ 100</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold">Potentiel d'engagement</p>
                      <span className="text-sm font-bold text-[#16a34a]">Excellent</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-[#16a34a]" style={{ width: "82%" }} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  {[
                    { label: "Accroche percutante", ok: true },
                    { label: "Question pour engager", ok: true },
                    { label: "Hashtags à ajouter", ok: false },
                    { label: "Appel à l'action", ok: true },
                  ].map((f) => (
                    <div
                      key={f.label}
                      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${f.ok ? "bg-green-50 text-green-700" : "bg-[#fff1f1] text-[#ff5a5f]"}`}
                    >
                      {f.ok ? <Check size={15} /> : <PenLine size={15} />} {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Comment ça marche */}
        <section id="comment" className="max-w-5xl mx-auto px-6 py-16">
          <BackToTop />
          <h2 className="text-3xl md:text-4xl font-extrabold text-center">Comment ça marche</h2>
          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white rounded-3xl border border-white shadow-lg shadow-sky-100/40 p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#ff5a5f] text-white flex items-center justify-center text-lg font-bold mx-auto shadow-lg shadow-rose-300/40">
                  {s.n}
                </div>
                <h3 className="font-bold mt-4 mb-2">{s.title}</h3>
                <p className="text-sm text-[#5a6b85] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/comment-ca-marche"
              className="inline-flex items-center gap-2 bg-white border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a] font-semibold px-6 py-3 rounded-full transition-colors"
            >
              Voir le parcours étape par étape <ChevronRight size={17} className="text-[#ff5a5f]" />
            </Link>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="max-w-6xl mx-auto px-6 py-20">
          <BackToTop />
          <h2 className="text-3xl md:text-4xl font-extrabold text-center">Des tarifs simples</h2>
          <p className="text-[#5a6b85] text-center mt-3">14 jours d'essai gratuit sur tous les plans, sans carte bancaire. Sans engagement.</p>
          <div className="grid md:grid-cols-3 gap-6 mt-12 items-start">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`bg-white rounded-3xl p-7 relative ${
                  p.highlight ? "ring-2 ring-[#ff5a5f] shadow-2xl shadow-rose-200/50 md:-translate-y-2" : "border border-white shadow-lg shadow-rose-100/30"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ff5a5f] text-white text-xs font-semibold px-3 py-1 rounded-full shadow">
                    Le plus choisi
                  </span>
                )}
                <h3 className="font-bold text-lg">{p.name}</h3>
                <p className="text-sm text-[#5a6b85] mt-1 min-h-10">{p.desc}</p>
                <p className="mt-4">
                  <span className="text-4xl font-extrabold">{p.price} €</span>
                  <span className="text-gray-400 text-sm"> /mois HT</span>
                </p>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-[#5a6b85]">
                      <Check size={16} className="text-[#ff5a5f] mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/app?plan=${p.name.toLowerCase()}`}
                  className={`mt-7 block text-center font-semibold px-4 py-3 rounded-full transition-colors ${
                    p.highlight
                      ? "bg-[#ff5a5f] hover:bg-[#f63d44] text-white shadow-lg shadow-rose-300/40"
                      : "border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a]"
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link href="/tarifs" className="inline-flex items-center gap-1.5 font-semibold text-[#ff5a5f] hover:underline">
              Comparer les offres en détail <ChevronRight size={16} />
            </Link>
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">* Usage raisonnable : des limites techniques s'appliquent pour garantir la qualité du service.</p>
        </section>

        {/* CTA création de compte (sous les tarifs) */}
        <section className="max-w-5xl mx-auto px-6 pb-6">
          <div className="rounded-3xl bg-white/70 backdrop-blur border border-white shadow-lg shadow-rose-100/40 p-8 flex flex-col md:flex-row items-center justify-between gap-5 text-center md:text-left">
            <div>
              <h3 className="text-xl font-extrabold">Prêt à automatiser votre LinkedIn ?</h3>
              <p className="text-[#5a6b85] text-sm mt-1">
                Créez votre compte et lancez votre première campagne — 14 jours gratuits, sans carte bancaire.
              </p>
            </div>
            <Link
              href="/app"
              className="shrink-0 inline-flex items-center gap-2 bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-rose-300/40 transition-colors"
            >
              Créer un compte <ChevronRight size={17} />
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-3xl mx-auto px-6 py-16">
          <BackToTop />
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-10 mt-2">Questions fréquentes</h2>
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="bg-white border border-white shadow-lg shadow-rose-100/30 rounded-2xl p-5 group">
                <summary className="font-semibold text-sm cursor-pointer list-none flex items-center justify-between">
                  {item.q}
                  <ChevronRight size={16} className="text-[#ff5a5f] group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <p className="text-sm text-[#5a6b85] mt-3 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-6 pb-20">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white text-center p-12 shadow-2xl shadow-rose-300/50 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <h2 className="text-3xl md:text-4xl font-extrabold">Votre prochaine campagne commence aujourd'hui</h2>
            <p className="text-white/85 mt-3">14 jours pour l'essayer, 5 minutes pour la lancer.</p>
            <Link href="/app" className="inline-flex items-center gap-2 bg-white text-[#ff5a5f] font-bold px-7 py-3.5 rounded-full mt-7 hover:bg-rose-50 transition-colors">
              Créer mon compte gratuitement <ChevronRight size={17} />
            </Link>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
