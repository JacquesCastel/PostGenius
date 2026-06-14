import Link from "next/link";
import {
  Gauge, Sparkles, Check, ChevronRight, PenLine, History, Wand2,
  Zap, Brain, ShieldCheck,
} from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata = {
  title: "Le score d'engagement — LinkeePost",
  description:
    "Comment LinkeePost calcule le potentiel d'engagement de vos posts LinkedIn : une analyse instantanée sur 7 critères, des conseils par l'IA, et une réécriture ciblée pour faire grimper votre score.",
};

const CRITERIA = [
  { label: "Accroche", weight: 20, text: "La première ligne, celle qu'on lit avant le « voir plus ». Courte et porteuse d'une tension (question, chiffre, promesse) : c'est elle qui décide si on clique." },
  { label: "Longueur & aération", weight: 20, text: "Entre 600 et 1 600 caractères, découpé en courts paragraphes. Un pavé compact décourage la lecture ; un texte aéré se lit d'un trait dans le fil." },
  { label: "Question / interaction", weight: 15, text: "Une question ouverte qui invite à réagir. C'est le levier n°1 pour déclencher des commentaires, et l'algorithme adore les commentaires." },
  { label: "Hashtags", weight: 15, text: "2 à 5 hashtags vraiment pertinents pour être trouvé sur vos thématiques — ni zéro, ni une avalanche qui fait spammy." },
  { label: "Format", weight: 10, text: "Le type de contenu. Carrousels et vidéos engagent en moyenne bien plus que le texte seul : on vous le signale quand le sujet s'y prête." },
  { label: "Émojis", weight: 10, text: "1 à 6 émojis pour rythmer le texte et guider l'œil, sans en abuser. Le bon dosage rend le post vivant et crédible." },
  { label: "Appel à l'action", weight: 10, text: "Une incitation claire en fin de post (« Dites-moi en commentaire… », « Partagez si ça vous parle »). On guide votre audience vers la réaction attendue." },
];

const STEPS = [
  {
    icon: Zap,
    title: "1 · Analyse instantanée",
    text: "Dès qu'un post est généré, LinkeePost l'évalue en temps réel sur 7 critères mesurables issus des bonnes pratiques LinkedIn, et en tire une note sur 100. Aucun délai, aucun appel externe : c'est immédiat.",
  },
  {
    icon: Brain,
    title: "2 · Conseils personnalisés par l'IA",
    text: "En parallèle, l'IA lit votre post et ajoute 2 à 3 conseils concrets et actionnables, propres à votre contenu — au-delà de ce que les critères automatiques détectent.",
  },
  {
    icon: Wand2,
    title: "3 · Réécriture ciblée",
    text: "D'un clic, appliquez les conseils. Vous choisissez le périmètre : tout le post, ou seulement l'accroche, le corps ou la signature. L'IA réécrit en gardant votre sujet, votre langue et votre ton.",
  },
  {
    icon: History,
    title: "4 · Score en direct + historique",
    text: "À chaque modification, le score se recalcule sous vos yeux et la jauge s'anime. Chaque version est conservée dans un historique, restaurable à tout moment.",
  },
];

export default function ScoringPage() {
  return (
    <div className="relative overflow-hidden text-[#1b2a4a] bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-[40rem] -right-24 w-[24rem] h-[24rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative">
        <SiteHeader />

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-6 pt-12 pb-10 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full mb-5">
              <Gauge size={13} /> Score d'engagement
            </p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
              Savez-vous si votre post va <span className="text-[#ff5a5f]">marcher</span>, avant de le publier ?
            </h1>
            <p className="text-lg text-[#5a6b85] mt-5">
              LinkeePost note le potentiel d'engagement de chaque post sur 100, vous montre exactement quoi améliorer,
              et réécrit pour vous ce qui doit l'être. Voici comment.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <Link href="/app" className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-7 py-3.5 rounded-full shadow-lg shadow-rose-300/50 inline-flex items-center justify-center gap-2 transition-colors">
                Tester gratuitement <ChevronRight size={17} />
              </Link>
              <Link href="/fonctionnalites" className="border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a] font-semibold px-7 py-3.5 rounded-full text-center transition-colors">
                Toutes les fonctionnalités
              </Link>
            </div>
          </div>

          {/* Aperçu de la jauge */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-rose-200/40 border border-white">
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
                { label: "Ajouter 2-3 hashtags", ok: false },
                { label: "Appel à l'action clair", ok: true },
              ].map((f) => (
                <div key={f.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${f.ok ? "bg-green-50 text-green-700" : "bg-[#fff1f1] text-[#ff5a5f]"}`}>
                  {f.ok ? <Check size={15} /> : <PenLine size={15} />} {f.label}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Procédé en 4 temps */}
        <section className="max-w-5xl mx-auto px-6 py-14">
          <p className="text-center text-sm font-semibold text-[#ff5a5f]">Notre procédé</p>
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mt-2">Une méthode hybride : la vitesse de l'automatique, la finesse de l'IA</h2>
          <p className="text-[#5a6b85] text-center mt-3 max-w-2xl mx-auto">
            On combine une analyse instantanée et déterministe avec l'intelligence d'un modèle qui lit vraiment votre post.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mt-12">
            {STEPS.map((s) => (
              <div key={s.title} className="bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 p-6">
                <div className="p-3 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-4">
                  <s.icon size={22} />
                </div>
                <h3 className="font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-[#5a6b85] leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Les 7 critères */}
        <section className="max-w-5xl mx-auto px-6 py-14">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center">Les 7 critères, et leur poids</h2>
          <p className="text-[#5a6b85] text-center mt-3 max-w-2xl mx-auto">
            Le score sur 100 se répartit entre sept critères. Pour chacun, LinkeePost vous dit où vous en êtes et comment progresser.
          </p>
          <div className="mt-12 space-y-4">
            {CRITERIA.map((c) => (
              <div key={c.label} className="bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/30 p-6">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <h3 className="font-bold">{c.label}</h3>
                  <span className="text-sm font-extrabold text-[#ff5a5f] shrink-0">{c.weight} pts</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#ff5a5f] to-pink-400" style={{ width: `${c.weight}%` }} />
                </div>
                <p className="text-sm text-[#5a6b85] leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Niveaux de score */}
        <section className="max-w-5xl mx-auto px-6 py-10">
          <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-10">Lire votre score</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { range: "80–100", label: "Excellent", color: "#16a34a", bg: "bg-green-50" },
              { range: "60–79", label: "Bon", color: "#ff5a5f", bg: "bg-[#fff1f1]" },
              { range: "40–59", label: "Moyen", color: "#f59e0b", bg: "bg-amber-50" },
              { range: "0–39", label: "À retravailler", color: "#ef4444", bg: "bg-red-50" },
            ].map((l) => (
              <div key={l.label} className={`${l.bg} rounded-2xl p-5 text-center`}>
                <p className="text-2xl font-extrabold" style={{ color: l.color }}>{l.range}</p>
                <p className="text-sm font-semibold mt-1" style={{ color: l.color }}>{l.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Honnêteté méthodo */}
        <section className="max-w-3xl mx-auto px-6 py-12">
          <div className="bg-white rounded-3xl border border-white shadow-lg shadow-sky-100/40 p-7 flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 shrink-0">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold mb-1.5">Un indicateur de qualité, pas une boule de cristal</h3>
              <p className="text-sm text-[#5a6b85] leading-relaxed">
                Le score reflète le respect des bonnes pratiques qui favorisent l'engagement — il ne prédit pas un nombre de vues ou de likes,
                car la performance réelle dépend aussi de votre réseau, du sujet et du moment. C'est un copilote qui vous évite les erreurs
                classiques et vous pousse vers vos meilleurs posts. La décision finale reste la vôtre.
              </p>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-4xl mx-auto px-6 py-16">
          <div className="rounded-[2.5rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white text-center p-12 shadow-2xl shadow-rose-300/50 relative overflow-hidden">
            <div className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <h2 className="text-3xl md:text-4xl font-extrabold">Faites grimper le score de votre prochain post</h2>
            <p className="text-white/85 mt-3">14 jours d'essai gratuit, sans carte bancaire.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-7">
              <Link href="/app" className="inline-flex items-center gap-2 bg-white text-[#ff5a5f] font-bold px-7 py-3.5 rounded-full hover:bg-rose-50 transition-colors">
                Créer mon compte <ChevronRight size={17} />
              </Link>
              <Link href="/comment-ca-marche" className="inline-flex items-center gap-2 bg-white/15 border border-white/40 text-white font-semibold px-7 py-3.5 rounded-full hover:bg-white/25 transition-colors">
                Comment ça marche
              </Link>
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}
