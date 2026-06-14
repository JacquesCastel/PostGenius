import Link from "next/link";
import {
  Sparkles, Megaphone, BarChart3, Check, ChevronRight, ShieldCheck,
  CalendarDays, UserRound, Send, Linkedin, Eye, MapPin,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Comment ça marche — LinkeePost",
  description:
    "De l'inscription à la statistique : découvrez étape par étape comment LinkeePost transforme votre expertise en campagnes LinkedIn publiées en pilote automatique.",
};

const STEPS = [
  {
    icon: Sparkles,
    title: "Créez votre compte",
    text: "Inscrivez-vous en quelques secondes. 14 jours d'essai gratuit, sans carte bancaire — vous testez tout avant de décider.",
    visual: (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full">
        <Sparkles size={12} /> Essai gratuit 14 jours
      </span>
    ),
  },
  {
    icon: UserRound,
    title: "Décrivez votre environnement",
    text: "Activité, cible, marché, objectifs, ton et rythme de publication : 5 minutes au départ, et l'IA s'en souvient pour toujours pour écrire à votre image.",
  },
  {
    icon: Linkedin,
    title: "Connectez LinkedIn",
    text: "Autorisez l'application par OAuth officiel — aucun mot de passe ne nous est confié. Profil personnel, et pages entreprise selon votre offre.",
  },
  {
    icon: Megaphone,
    title: "Lancez une campagne",
    text: "Un thème (ou un article repéré par votre veille), 3 questions de cadrage posées par l'IA, un post d'exemple à valider — et c'est parti.",
    visual: (
      <div className="rounded-2xl border border-gray-100 p-3 max-w-xs">
        <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Megaphone size={13} className="text-[#ff5a5f]" /> Campagne « Accessibilité 2026 »</p>
        <p className="text-[11px] text-gray-500">Objectif : générer des leads · 6 posts</p>
      </div>
    ),
  },
  {
    icon: Sparkles,
    title: "L'IA génère et planifie la série",
    text: "Les posts se rédigent dans votre style et se placent automatiquement sur vos créneaux de publication, avec une image cohérente quand vous le souhaitez.",
    visual: (
      <div className="flex gap-1.5 max-w-xs">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="flex-1 aspect-square rounded-lg bg-gradient-to-br from-orange-200 to-rose-200 flex items-center justify-center text-[10px] font-bold text-[#ff5a5f]">{n}</div>
        ))}
      </div>
    ),
  },
  {
    icon: ShieldCheck,
    title: "Validez — ou laissez le pilote automatique",
    text: "Activez la validation et chaque post attend votre feu vert avant de partir. Ou laissez LinkeePost gérer de bout en bout : c'est vous qui décidez.",
  },
  {
    icon: Send,
    title: "Publication automatique au bon moment",
    text: "Les posts partent seuls sur LinkedIn aux créneaux prévus, image comprise. Vous ne faites plus rien — votre présence tourne toute seule.",
    visual: (
      <p className="text-xs text-[#5a6b85] flex items-center gap-1.5"><CalendarDays size={13} className="text-[#ff5a5f]" /> Mar. · Jeu. à 09:00</p>
    ),
  },
  {
    icon: MapPin,
    title: "Couvrez vos salons et événements",
    text: "Avec l'offre Agence, ajoutez vos salons et forums : LinkeePost génère des posts de présence autour des dates, et le jour J vous notifie pour poster — et prendre une photo en direct sur place.",
    visual: (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full">
        <MapPin size={12} /> Offre Agence
      </span>
    ),
  },
  {
    icon: BarChart3,
    title: "Suivez vos statistiques et améliorez",
    text: "Impressions, engagement, progression de chaque campagne : LinkeePost met en évidence ce qui fonctionne pour que vous reproduisiez vos meilleurs posts.",
    visual: (
      <div className="flex items-end gap-1.5 h-16 max-w-[10rem]">
        {[40, 60, 50, 80, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#ff5a5f] to-pink-400" style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  },
];

export default function CommentCaMarchePage() {
  return (
    <div className="relative overflow-hidden text-[#1b2a4a] bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-[50rem] -right-24 w-[24rem] h-[24rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative">
        <SiteHeader />

        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-12 pb-8 text-center">
          <p className="text-sm font-semibold text-[#ff5a5f]">Comment ça marche</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2 leading-tight">
            De l'idée au post publié, <span className="text-[#ff5a5f]">étape par étape</span>
          </h1>
          <p className="text-lg text-[#5a6b85] mt-4">
            Cinq minutes de réglage au départ, puis votre présence LinkedIn tourne presque toute seule.
            Voici le parcours.
          </p>
        </section>

        {/* Timeline en zigzag */}
        <section className="max-w-4xl mx-auto px-6 py-10">
          <div className="relative">
            {/* Ligne centrale (desktop) / à gauche (mobile) */}
            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 top-2 bottom-2 w-0.5 bg-rose-200" />
            <div className="md:hidden absolute left-6 top-2 bottom-2 w-0.5 bg-rose-200" />

            <div className="space-y-10 md:space-y-0">
              {STEPS.map((s, i) => {
                const left = i % 2 === 0;
                return (
                  <div key={i} className="relative md:grid md:grid-cols-2 md:gap-12 md:items-center md:py-6">
                    {/* Numéro sur la ligne */}
                    <div className="absolute left-6 md:left-1/2 -translate-x-1/2 top-0 md:top-1/2 md:-translate-y-1/2 w-12 h-12 rounded-2xl bg-[#ff5a5f] text-white flex items-center justify-center font-extrabold shadow-lg shadow-rose-300/40 z-10">
                      {i + 1}
                    </div>
                    {/* Carte, alternée gauche/droite */}
                    <div className={`pl-20 md:pl-0 ${left ? "md:col-start-1 md:pr-12" : "md:col-start-2 md:pl-12"}`}>
                      <div className="bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 p-6">
                        <div className="flex items-center gap-2 text-[#ff5a5f] mb-2">
                          <s.icon size={18} />
                          <span className="text-xs font-semibold uppercase tracking-wide">Étape {i + 1}</span>
                        </div>
                        <h2 className="text-xl font-extrabold">{s.title}</h2>
                        <p className="text-[#5a6b85] mt-2 leading-relaxed">{s.text}</p>
                        {s.visual && <div className="mt-4">{s.visual}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white text-center p-12 shadow-2xl shadow-rose-300/50 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <h2 className="text-3xl md:text-4xl font-extrabold">Prêt à lancer votre première campagne ?</h2>
            <p className="text-white/85 mt-3">5 minutes pour démarrer. 14 jours gratuits, sans carte bancaire.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
              <Link href="/app" className="inline-flex items-center gap-2 bg-white text-[#ff5a5f] font-bold px-7 py-3.5 rounded-full hover:bg-rose-50 transition-colors">
                Créer mon compte <ChevronRight size={17} />
              </Link>
              <Link href="/fonctionnalites" className="inline-flex items-center gap-2 bg-white/15 border border-white/40 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-white/25 transition-colors">
                Voir les fonctionnalités
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
