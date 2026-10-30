import Link from "next/link";
import {
  Sparkles, Megaphone, BarChart3, Check, ChevronRight, ShieldCheck,
  CalendarDays, UserRound, Send, Linkedin, Eye, MapPin, MessageCircle, BookOpen, Mic, Gauge,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Comment ça marche — LinkeePost",
  description:
    "De l'inscription à la statistique : vous déposez votre matière et fixez votre voix, LinkeePost rédige à partir de vos faits, puis programme et publie après votre accord.",
  alternates: { canonical: "/comment-ca-marche" },
};

const STEPS = [
  {
    icon: Sparkles,
    title: "Créez votre compte",
    text: "Inscrivez-vous en quelques secondes. 14 jours d'essai gratuit, sans carte bancaire : vous testez avant de décider.",
    visual: (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full">
        <Sparkles size={12} /> Essai gratuit 14 jours
      </span>
    ),
  },
  {
    icon: BookOpen,
    title: "Déposez votre matière",
    text: "Documents, liens, notes, anciens posts : LinkeePost en tire des faits, des cas et du vocabulaire, que vous relisez et validez. C'est cette base qui nourrit vos posts, et chaque post indique les sources qu'il a utilisées.",
    visual: (
      <div className="rounded-2xl border border-gray-100 p-3 max-w-xs">
        <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><BookOpen size={13} className="text-[#ff5a5f]" /> Guide accessibilité</p>
        <p className="text-[11px] text-gray-500">3 faits retenus · 2 thèmes repérés</p>
      </div>
    ),
  },
  {
    icon: Mic,
    title: "Fixez votre voix",
    text: "Décrivez votre activité, votre cible, votre ton ; ajoutez vos mots à privilégier, vos mots à bannir, vos formulations types. Vos consignes passent avant les règles génériques. Quelques minutes au départ, puis tout est mémorisé.",
  },
  {
    icon: Linkedin,
    title: "Connectez LinkedIn",
    text: "Autorisez l'application par OAuth officiel : aucun mot de passe ne nous est confié. Profil personnel, et pages entreprise selon votre offre.",
  },
  {
    icon: MessageCircle,
    title: "Échangez avec le copilote éditorial",
    text: "Il s'appuie sur votre base de connaissances pour proposer des sujets argumentés, classés selon vos piliers. Pas convaincu ? Dites-lui ce que vous voulez cette semaine : il ajuste ses propositions et s'en souvient.",
    visual: (
      <div className="rounded-2xl border border-gray-100 p-3 max-w-xs">
        <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><MessageCircle size={13} className="text-[#ff5a5f]" /> Que publier aujourd'hui ?</p>
        <p className="text-[11px] text-gray-500">« Les 3 erreurs qui ruinent la crédibilité d'un post »</p>
      </div>
    ),
  },
  {
    icon: Megaphone,
    title: "Lancez un post ou une campagne",
    text: "Un sujet, le vôtre, une idée du copilote ou un article repéré par votre veille. Pour une campagne : 3 questions de cadrage posées par l'IA et un post d'exemple à valider, puis la série se rédige et se place sur vos créneaux.",
    visual: (
      <div className="rounded-2xl border border-gray-100 p-3 max-w-xs">
        <p className="text-xs font-semibold flex items-center gap-1.5 mb-1.5"><Megaphone size={13} className="text-[#ff5a5f]" /> Campagne « Accessibilité 2026 »</p>
        <p className="text-[11px] text-gray-500">Objectif : générer des contacts · 6 posts</p>
      </div>
    ),
  },
  {
    icon: Gauge,
    title: "Relisez, contrôlez la forme, validez",
    text: "Chaque post est rédigé dans votre voix, à partir de vos sources et en tenant compte de ce que vous avez déjà publié. Le contrôle de forme vérifie accroche, longueur et aération avec des règles fixes ; vous retouchez si besoin, puis vous validez. Rien ne part sans votre accord si vous activez la validation.",
    visual: (
      <p className="text-xs text-[#5a6b85] flex items-center gap-1.5"><Gauge size={13} className="text-[#ff5a5f]" /> Indicateur de forme, pas une prévision de résultats</p>
    ),
  },
  {
    icon: Send,
    title: "Publication aux créneaux choisis",
    text: "Une fois validés, les posts partent sur LinkedIn à l'heure prévue, image comprise. Pour une vidéo, suivez le kit de tournage et le téléprompteur, importez votre vidéo : elle est publiée avec votre texte. Le mode automatique, désactivé par défaut, reste un choix de votre part.",
    visual: (
      <p className="text-xs text-[#5a6b85] flex items-center gap-1.5"><CalendarDays size={13} className="text-[#ff5a5f]" /> Mar. · Jeu. à 09:00</p>
    ),
  },
  {
    icon: BarChart3,
    title: "Suivez les retours réels",
    text: "Commentaires, réactions et impressions de vos pages entreprise : ce sont les retours de LinkedIn, pas des estimations. Commentez et répondez à votre réseau depuis l'écran Interagir, avec des suggestions écrites dans votre voix : avec une page entreprise connectée (offres Pro et Agence), quand quelqu'un commente la page, vous êtes prévenu et les auteurs rejoignent une base de leads, comparés par l'IA à la cible et au « bon lead » que vous avez décrits à la création du compte. Avec l'offre Agence : modules Événements et validation par vos clients.",
    visual: (
      <div className="flex items-end gap-1.5 h-16 max-w-[10rem]">
        {[40, 60, 50, 80, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-[#ff5a5f] to-pink-400" style={{ height: `${h}%` }} />
        ))}
      </div>
    ),
  },
  {
    icon: Gauge,
    title: "Écoutez le coach, donnez une seconde vie à vos contenus",
    text: "Dès 8 posts mesurés, le coach compare vos posts à votre propre médiane et vous dit ce qui marche chez vous, avec le nombre de posts et son niveau de confiance ; vous adoptez vos créneaux conseillés d'un clic. Un article, un document ou une vidéo peut ensuite devenir une série de posts, écrits à partir des seuls faits que vous cochez (offres Pro et Agence). Vous pouvez aussi interroger vos posts et vos résultats depuis Claude ou ChatGPT.",
    visual: (
      <p className="text-xs text-[#5a6b85] flex items-center gap-1.5"><Gauge size={13} className="text-[#ff5a5f]" /> Vos posts du mardi : 2,5× votre médiane</p>
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
            De votre matière au post publié, <span className="text-[#ff5a5f]">étape par étape</span>
          </h1>
          <p className="text-lg text-[#5a6b85] mt-4">
            Vous déposez votre matière et fixez votre voix une fois. LinkeePost rédige à partir de vos faits,
            vous relisez, puis les posts partent à l&apos;heure choisie. Voici le parcours.
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
            <h2 className="text-3xl md:text-4xl font-extrabold">Prêt à déposer votre première source ?</h2>
            <p className="text-white/85 mt-3">14 jours gratuits, sans carte bancaire.</p>
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
