import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { JOIN_HREF, pick } from "@/lib/access";
import { produitOuvert } from "@/lib/siteProduit";
import { BRAND_NAME } from "@/lib/brand";
import { liaisons, liaisonsEm } from "@/lib/typo";

// Page « Contrôle de forme » (nouveau style v2, texte de la maquette « /scoring »).
// Les nombres affichés (points par critère, seuils) sont contrôlés contre lib/score.js par scripts/scoring-page.test.mjs.
export const dynamic = "force-dynamic"; // l'interrupteur du lien « Chiffres à vérifier » se lit à chaque requête

export const metadata = {
  title: `Le contrôle de forme — ${BRAND_NAME}`,
  description:
    `Comment ${BRAND_NAME} contrôle la forme de vos posts LinkedIn : une note sur 100, sept critères à règles fixes, le même texte obtenant toujours la même note. Un indicateur de mise en forme, pas une prévision de vues.`,
  alternates: { canonical: "/scoring" },
};

const CRITERES = [
  { label: "Accroche", points: 25, texte: "La première ligne, seule visible avant le « voir plus » : elle doit porter à elle seule l'idée du post, pas juste l'annoncer. Moins de 90 caractères. Une question ou un « : » peut aider, sans jamais être obligatoire." },
  { label: "Longueur et aération", points: 25, texte: "Entre 400 et 1 600 caractères, découpé en courts paragraphes. Un pavé compact décourage la lecture, quelle que soit sa longueur." },
  { label: "Question ou interaction", points: 10, texte: "Un bonus, pas une fin imposée : une question ouverte qui vient naturellement invite aux commentaires. Un post qui conclut sur sa propre idée fonctionne aussi bien." },
  { label: "Hashtags", points: 10, texte: "Aucun minimum : zéro hashtag est un choix valable. Au-delà de 5, le texte commence à paraître chargé." },
  { label: "Format", points: 10, texte: "Le texte seul est déjà un format efficace quand il est bien écrit. Carrousel ou vidéo restent une option si le sujet s'y prête." },
  { label: "Émojis", points: 10, texte: "De 0 à 6 émojis pour rythmer le texte sans l'alourdir. Zéro émoji obtient la note pleine." },
  { label: "Appel à l'action", points: 10, texte: "Si ça vient naturellement, une invitation explicite (« Dites-moi en commentaire… ») peut aider. Un post qui se suffit à lui-même n'en a pas besoin." },
];

const EXEMPLE = [
  ["Accroche", "25 / 25"],
  ["Longueur et aération", "20 / 25"],
  ["Question ou interaction", "0 / 10"],
  ["Hashtags, format, émojis, appel à l'action", "40 / 40"],
];

const LIMITES = [
  "Elle ne prévoit ni vues, ni likes, ni commentaires. Un post très bien construit peut ne rien donner, un post imparfait peut bien marcher.",
  "Elle ne juge ni le fond, ni l'exactitude : un chiffre inventé peut très bien obtenir 100 sur 100.",
  "Ses seuils sont des règles de mise en forme que nous avons fixées, pas des lois de LinkedIn.",
];

export default function ScoringPage() {
  const titre = liaisonsEm("Une note de mise en forme,", "pas une prédiction.");
  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <div className="text-center"><span className="inline-block text-xs font-semibold uppercase tracking-[0.06em] bg-[#DCE9DF] text-[#2B5340] px-3.5 py-1.5 rounded-full">Contrôle de forme · offres Pro et Agence</span></div>

        <div className="mt-8 flex flex-col items-center gap-10">
          <div className="min-w-0 entete-centre">
            <h1 className="font-display text-[38px] sm:text-[54px] leading-[1.06] tracking-[-0.02em]">{titre[0]}<em className="text-[#C2456F]">{titre[1]}</em></h1>
            <p className="text-[19px] leading-relaxed text-[#4A3A50] mt-6 max-w-[560px]">Sept critères à règles fixes : le même texte obtient toujours la même note. Elle dit si un post est bien construit, jamais combien de vues ou de réactions il aura.</p>
          </div>
          <div className="w-full max-w-[640px] min-w-0 bg-white border border-[#EFE4E0] rounded-[28px] p-6 sm:p-8 shadow-[0_18px_40px_rgba(46,31,51,0.08)]" data-testid="scoring-exemple">
            <div className="flex justify-between items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B5A70]">Note de forme</span>
              <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">Exemple de mise en forme · fictif</span>
            </div>
            <div className="flex items-baseline gap-3 mt-4">
              <span className="font-display text-[64px] leading-none text-[#2B5340]">85</span>
              <span className="text-[#6B5A70]">/ 100</span>
              <span className="ml-auto text-sm font-semibold bg-[#DCE9DF] text-[#1F4030] px-3 py-1 rounded-full">Bien construit</span>
            </div>
            <div className="h-2.5 bg-[#F1E8E4] rounded-full overflow-hidden mt-4" role="img" aria-label="85 sur 100"><div className="h-full bg-[#2B5340] rounded-full" style={{ width: "85%" }} /></div>
            <ul className="mt-5 flex flex-col gap-2 text-[15px]">
              {EXEMPLE.map(([nom, valeur]) => <li key={nom} className="flex justify-between gap-4"><span>{nom}</span><span className="font-semibold whitespace-nowrap">{valeur}</span></li>)}
            </ul>
            <p className="text-[13px] leading-relaxed text-[#6B5A70] mt-5">Valeurs inventées pour montrer la forme d&apos;une note. Elle ne prévoit aucune vue ni aucune réaction.</p>
          </div>
        </div>

        <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] mt-20">{liaisons("Les sept critères")}</h2>
        <p className="text-[17px] leading-relaxed text-[#4A3A50] mt-3 max-w-[720px]">Chaque critère rapporte des points selon des seuils écrits. Les deux premiers pèsent la moitié de la note.</p>
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {CRITERES.map((c) => (
            <div key={c.label} className="bg-white border border-[#EFE4E0] rounded-3xl p-6">
              <div className="flex justify-between items-baseline gap-3">
                <h3 className="font-semibold text-[18px]">{liaisons(c.label)}</h3>
                <span className="text-sm font-bold text-[#9E3157] whitespace-nowrap">{c.points} points</span>
              </div>
              <div className="h-2 bg-[#F1E8E4] rounded-full overflow-hidden my-3"><div className="h-full bg-[#C2456F] rounded-full" style={{ width: `${c.points * 4}%` }} /></div>
              <p className="text-[15px] leading-relaxed text-[#4A3A50]">{c.texte}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 bg-[#FCE6D6] rounded-[28px] p-7 sm:p-9">
          <h2 className="font-display text-[28px] mb-4">{liaisons("Ce que la note ne dit pas")}</h2>
          <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[16px] leading-relaxed text-[#6E2E0E]">{LIMITES.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="mt-5 text-[16px] leading-relaxed text-[#6E2E0E]">
            Pour le fond, c&apos;est un autre contrôle :{" "}
            {produitOuvert() ? <Link href="/produit/verification" className="font-semibold underline">Chiffres à vérifier</Link> : <strong>Chiffres à vérifier</strong>}.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-5 bg-white border border-[#EFE4E0] rounded-3xl px-7 py-6">
          <p className="text-[16px] leading-relaxed text-[#4A3A50] max-w-[640px]">
            Le contrôle de forme est inclus à partir de l&apos;offre Pro. {pick("Pendant la bêta, il est ouvert aux testeurs invités.", "14 jours d'essai gratuit, sans carte bancaire.")}
          </p>
          <Link href={JOIN_HREF} className="bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-7 py-3.5 rounded-full">{pick("Demander une invitation", "Tester gratuitement")}</Link>
        </div>
      </div>
    </Shell>
  );
}
