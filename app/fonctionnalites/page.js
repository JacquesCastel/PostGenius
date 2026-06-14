import Link from "next/link";
import {
  Sparkles, Megaphone, Eye, Clock, BarChart3, Image as ImageIcon, Check, ChevronRight,
  ShieldCheck, CalendarDays, Layers, UserRound, Send, ThumbsUp, MessageSquare, Share2, Rss, ArrowRight, MapPin, Bell,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Fonctionnalités — LinkeePost",
  description:
    "Profil de rédaction, campagnes guidées par l'IA, veille connectée, images générées, programmation automatique, publication LinkedIn et statistiques. Toutes les fonctionnalités de LinkeePost en détail.",
};

const PIPELINE = [
  { icon: UserRound, label: "Profil" },
  { icon: Megaphone, label: "Campagne" },
  { icon: Sparkles, label: "Génération IA" },
  { icon: CalendarDays, label: "Programmation" },
  { icon: Send, label: "Publication" },
  { icon: BarChart3, label: "Statistiques" },
];

// Petit composant de section : texte + visuel, alterné gauche/droite
function Feature({ tag, title, text, points, reverse, children }) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-14">
      <div className={`grid lg:grid-cols-2 gap-12 items-center ${reverse ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div>
          <p className="text-sm font-semibold text-[#ff5a5f]">{tag}</p>
          <h2 className="text-2xl md:text-3xl font-extrabold mt-2">{title}</h2>
          <p className="text-[#5a6b85] mt-3 leading-relaxed">{text}</p>
          <ul className="mt-5 space-y-2.5">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <span className="bg-[#fff1f1] text-[#ff5a5f] p-1 rounded-lg shrink-0 mt-0.5">
                  <Check size={14} />
                </span>
                <span className="text-sm">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">{children}</div>
      </div>
    </section>
  );
}

function Card({ className = "", children }) {
  return (
    <div className={`bg-white rounded-3xl border border-white shadow-xl shadow-rose-100/40 p-6 ${className}`}>
      {children}
    </div>
  );
}

export default function FonctionnalitesPage() {
  return (
    <div className="relative overflow-hidden text-[#1b2a4a] bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-[40rem] -right-24 w-[24rem] h-[24rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative">
        <SiteHeader />

        {/* Hero */}
        <section className="max-w-4xl mx-auto px-6 pt-12 pb-8 text-center">
          <p className="text-sm font-semibold text-[#ff5a5f]">Fonctionnalités</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2 leading-tight">
            Tout ce qu'il faut pour piloter votre <span className="text-[#ff5a5f]">LinkedIn</span>
          </h1>
          <p className="text-lg text-[#5a6b85] mt-4 max-w-2xl mx-auto">
            De votre contexte métier à la statistique finale, LinkeePost couvre toute la chaîne — vous ne
            faites plus que valider.
          </p>
          <Link
            href="/app"
            className="inline-flex items-center gap-2 bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-rose-300/50 mt-8 transition-colors"
          >
            Essayer gratuitement <ChevronRight size={17} />
          </Link>
        </section>

        {/* Schéma : le pipeline */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <Card className="!p-8">
            <p className="text-center text-sm font-semibold text-[#5a6b85] mb-6">Comment tout s'enchaîne</p>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 md:gap-2">
              {PIPELINE.map((s, i) => (
                <div key={s.label} className="flex md:flex-col items-center gap-3 md:gap-2 md:flex-1">
                  <div className="w-14 h-14 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] flex items-center justify-center shadow-sm">
                    <s.icon size={24} />
                  </div>
                  <span className="text-sm font-semibold md:text-center">{s.label}</span>
                  {i < PIPELINE.length - 1 && (
                    <ArrowRight size={18} className="text-rose-300 hidden md:block md:rotate-0" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* 1. Profil de rédaction */}
        <Feature
          tag="Votre ADN"
          title="Un profil de rédaction qui vous ressemble"
          text="Décrivez une fois votre activité, votre cible, votre marché et vos consignes de style. L'IA s'en souvient et calibre chaque contenu pour qu'il sonne comme vous — pas comme un robot."
          points={[
            "Contexte métier, audience cible, positionnement",
            "Ton et consignes d'écriture (tutoiement, emojis, longueur…)",
            "Rythme de publication préféré",
          ]}
        >
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#ff5a5f] to-pink-500" />
              <div>
                <p className="font-bold text-sm">Consultant SEO @ Acme</p>
                <p className="text-xs text-gray-400">Cible : dirigeants PME · Ton : direct</p>
              </div>
            </div>
            {["Activité & proposition de valeur", "Audience LinkedIn", "Consignes de style"].map((f) => (
              <div key={f} className="flex items-center justify-between text-xs border border-gray-100 rounded-xl px-3 py-2 mb-2">
                <span className="text-[#5a6b85]">{f}</span>
                <Check size={14} className="text-[#ff5a5f]" />
              </div>
            ))}
          </Card>
        </Feature>

        {/* 2. Génération IA */}
        <Feature
          reverse
          tag="Génération"
          title="Des posts prêts à publier en un clic"
          text="Un thème, un ton, et l'IA rédige : accroche forte, corps aéré, question finale, hashtags. Post simple, carrousel ou vidéo — vous retouchez, demandez des variantes ou faites réécrire."
          points={[
            "Posts simples, carrousels (plan de slides) et scripts vidéo",
            "Retouche, variantes et réécriture guidée",
            "Toujours dans votre style",
          ]}
        >
          <Card>
            <div className="flex gap-2 mb-4">
              {["Simple", "Carrousel", "Vidéo"].map((t, i) => (
                <span key={t} className={`text-xs font-semibold px-3 py-1 rounded-full ${i === 1 ? "bg-[#ff5a5f] text-white" : "bg-[#fff1f1] text-[#ff5a5f]"}`}>{t}</span>
              ))}
            </div>
            <div className="space-y-2">
              <div className="h-2.5 w-3/4 bg-gray-200 rounded-full" />
              <div className="h-2 w-full bg-gray-100 rounded-full" />
              <div className="h-2 w-11/12 bg-gray-100 rounded-full" />
              <div className="h-2 w-2/3 bg-gray-100 rounded-full" />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="aspect-square rounded-xl bg-gradient-to-br from-orange-200 to-rose-200 flex items-center justify-center text-[10px] font-bold text-[#ff5a5f]">
                  {n}/8
                </div>
              ))}
            </div>
          </Card>
        </Feature>

        {/* 3. Campagnes */}
        <Feature
          tag="Campagnes"
          title="Des campagnes guidées par l'IA"
          text="Choisissez un thème, l'IA vous pose quelques questions de cadrage, valide un post d'exemple avec vous, puis génère et planifie une série cohérente qui progresse vers votre message clé."
          points={[
            "Brief IA en 3 questions, exemple validé avant de lancer",
            "Série de posts générée et planifiée automatiquement",
            "Progression suivie de bout en bout",
          ]}
        >
          <Card>
            <div className="flex items-center justify-between mb-2">
              <p className="font-bold text-sm flex items-center gap-1.5"><Megaphone size={15} className="text-[#ff5a5f]" /> Campagne « Accessibilité 2026 »</p>
              <span className="text-xs text-gray-400">4/6</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div className="h-full w-2/3 bg-gradient-to-r from-[#ff5a5f] to-pink-500 rounded-full" />
            </div>
            {[
              { t: "Pourquoi l'accessibilité devient incontournable", s: "publié" },
              { t: "3 erreurs fréquentes (et comment les éviter)", s: "publié" },
              { t: "Étude de cas : +40 % de candidatures", s: "programmé jeu. 09:00" },
            ].map((p) => (
              <div key={p.t} className="flex items-center justify-between text-xs border-b border-gray-50 py-2">
                <span className="text-[#1b2a4a] truncate pr-2">{p.t}</span>
                <span className={`shrink-0 ${p.s === "publié" ? "text-green-600" : "text-amber-600"}`}>{p.s}</span>
              </div>
            ))}
          </Card>
        </Feature>

        {/* 4. Veille connectée */}
        <Feature
          reverse
          tag="Veille"
          title="Une veille connectée à votre secteur"
          text="Branchez vos sources (sites, flux RSS) : LinkeePost surveille l'actualité de votre domaine et vous propose des inspirations. Un article pertinent devient un post — ou une campagne entière."
          points={[
            "Sources RSS de votre secteur, agrégées automatiquement",
            "Inspirations prêtes à transformer en post",
            "Vos contenus ancrés dans l'actualité",
          ]}
        >
          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-[#fff1f1] text-[#ff5a5f] p-2.5 rounded-xl"><Rss size={20} /></div>
              <ArrowRight size={18} className="text-rose-300" />
              <div className="flex-1 border border-gray-100 rounded-xl p-3">
                <p className="text-xs text-gray-600 leading-relaxed">« L'accessibilité numérique devient un critère d'appel d'offres »</p>
              </div>
            </div>
            <div className="flex justify-center my-3"><ArrowRight size={18} className="text-rose-300 rotate-90" /></div>
            <div className="rounded-2xl p-4 text-white bg-gradient-to-br from-orange-400 via-[#ff5a5f] to-pink-500">
              <p className="text-xs text-white/80">Post généré</p>
              <p className="text-sm font-semibold mt-0.5">« Et si l'accessibilité devenait votre avantage concurrentiel ? »</p>
            </div>
          </Card>
        </Feature>

        {/* 5. Images IA */}
        <Feature
          tag="Visuels"
          title="Des images générées par IA"
          text="Pour chaque post, une illustration cohérente avec le contenu, créée par IA et publiée avec le texte. Prompt automatique à partir du post, ou personnalisé selon vos envies."
          points={[
            "Image alignée avec le message du post",
            "Prompt automatique ou sur-mesure",
            "Publiée directement avec le post",
          ]}
        >
          <Card>
            <div className="h-40 rounded-2xl bg-gradient-to-br from-orange-300 via-[#ff5a5f] to-pink-400 flex items-center justify-center">
              <ImageIcon size={40} className="text-white/80" />
            </div>
            <div className="flex items-center gap-2 mt-3 text-xs text-[#5a6b85]">
              <Sparkles size={13} className="text-[#ff5a5f]" /> Prompt généré automatiquement depuis le post
            </div>
          </Card>
        </Feature>

        {/* 6. Programmation */}
        <Feature
          reverse
          tag="Automatisation"
          title="Programmation et pilote automatique"
          text="Choisissez vos jours et votre heure : les posts partent seuls aux bons créneaux, après votre validation si vous le souhaitez. Kanban et calendrier pour tout piloter d'un coup d'œil."
          points={[
            "Publication automatique sur vos créneaux",
            "Validation avant envoi (optionnelle)",
            "Vue calendrier et kanban",
          ]}
        >
          <Card>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 21 }).map((_, i) => {
                const active = [2, 4, 9, 11, 16, 18].includes(i);
                return (
                  <div key={i} className={`aspect-square rounded-lg flex items-center justify-center text-[9px] font-bold ${active ? "bg-[#ff5a5f] text-white" : "bg-gray-50 text-gray-300"}`}>
                    {active ? <Check size={11} /> : ""}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[#5a6b85] mt-3 flex items-center gap-1.5"><CalendarDays size={13} className="text-[#ff5a5f]" /> Mar. · Jeu. à 09:00 — en pilote automatique</p>
          </Card>
        </Feature>

        {/* 7. Statistiques (avec petit graphique) */}
        <Feature
          tag="Mesure"
          title="Des statistiques qui guident vos décisions"
          text="Suivez impressions, vues, engagement et progression de vos campagnes. LinkeePost met en évidence ce qui fonctionne pour que vous reproduisiez vos meilleurs posts — sur votre profil comme sur vos pages entreprise."
          points={[
            "Impressions, engagement et taux par post",
            "Progression par campagne",
            "Statistiques profil et page entreprise",
          ]}
        >
          <Card>
            <div className="flex items-end justify-between gap-2 h-36">
              {[40, 65, 50, 80, 72, 95].map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-[#ff5a5f] to-pink-400" style={{ height: `${h}%` }} />
                  <span className="text-[9px] text-gray-400">S{i + 1}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-[#5a6b85] mt-3 flex items-center gap-1.5"><BarChart3 size={13} className="text-[#ff5a5f]" /> Engagement en hausse, semaine après semaine</p>
          </Card>
        </Feature>

        {/* Événements (offre Agence) */}
        <Feature
          reverse
          tag="Événements · offre Agence"
          title="Ne ratez plus aucun salon"
          text="Ajoutez vos salons et forums : LinkeePost génère et programme des posts de présence autour des dates (« Nous serons au salon X du A au B, venez nous rencontrer ! »), à partir du lien et de l'image de l'événement. Le jour J, une notification vous rappelle de poster — et de prendre une photo sur place avec votre téléphone."
          points={[
            "Posts de présence générés et programmés automatiquement",
            "Image et contexte récupérés depuis le lien de l'événement",
            "Notification jour-J + post photo en direct depuis le téléphone",
          ]}
        >
          <Card>
            <div className="flex items-center gap-3">
              <div className="bg-[#fff1f1] text-[#ff5a5f] p-2.5 rounded-xl"><MapPin size={20} /></div>
              <div>
                <p className="font-bold text-sm">Salon Big Data &amp; AI Paris</p>
                <p className="text-xs text-gray-400 flex items-center gap-1"><CalendarDays size={12} /> 12 → 14 mars · Hall 1 · B12</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-[#fff1f1] p-3 flex items-center gap-2">
              <Bell size={15} className="text-[#ff5a5f] shrink-0" />
              <p className="text-xs text-[#1b2a4a]">« Vous êtes au salon ! Prenez une photo et postez 📸 »</p>
            </div>
          </Card>
        </Feature>

        {/* Publication LinkedIn (bandeau) */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <Card className="!p-8 text-center">
            <div className="flex items-center justify-center gap-6 text-gray-300 mb-4">
              <ThumbsUp size={22} /><MessageSquare size={22} /><Share2 size={22} /><Send size={22} className="text-[#ff5a5f]" />
            </div>
            <h2 className="text-2xl font-extrabold flex items-center justify-center gap-2"><ShieldCheck size={22} className="text-[#ff5a5f]" /> Publication via l'API officielle LinkedIn</h2>
            <p className="text-[#5a6b85] mt-3 max-w-2xl mx-auto">
              Vous autorisez l'application par OAuth — aucun mot de passe LinkedIn ne nous est confié, et vous
              révoquez l'accès quand vous voulez. Publiez sur votre <strong>profil personnel</strong> et, selon
              votre offre, sur vos <strong>pages entreprise</strong>.
            </p>
          </Card>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white text-center p-12 shadow-2xl shadow-rose-300/50 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <h2 className="text-3xl md:text-4xl font-extrabold">Toutes ces fonctionnalités, 14 jours gratuits</h2>
            <p className="text-white/85 mt-3">Sans carte bancaire. Lancez votre première campagne en 5 minutes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
              <Link href="/app" className="inline-flex items-center gap-2 bg-white text-[#ff5a5f] font-bold px-7 py-3.5 rounded-full hover:bg-rose-50 transition-colors">
                Créer mon compte <ChevronRight size={17} />
              </Link>
              <Link href="/tarifs" className="inline-flex items-center gap-2 bg-white/15 border border-white/40 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-white/25 transition-colors">
                Voir les tarifs
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
