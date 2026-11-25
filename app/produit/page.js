import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { produitOuvert } from "@/lib/siteProduit";
import { MOTS } from "@/lib/produitPages";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Produit — ${BRAND_NAME}`,
  description: "De vos sources à un post relu, étape par étape : rédaction à votre voix, deux contrôles, programmation, mesure.",
  alternates: { canonical: "/produit" },
};

const ETAPES = [
  ["Sources", "Documents, liens, notes, dictée."],
  ["Rédaction", "À votre voix, dans la langue de votre audience."],
  ["Contrôles", "Chiffres à vérifier, contrôle de forme."],
  ["Publication", "Programmation, validation, résultats."],
];

const OFFRE_PRO = "Pro et Agence";
const BLOCS = [
  { kicker: "Votre matière", titre: "Une base de connaissances que vous pilotez", bg: "#FFFFFF", points: [
    "Documents, liens et notes : rien n'est retenu sans votre clic.",
    "Dictée vocale : l'enregistrement n'est pas conservé, seul le texte gardé l'est.",
    "Partage depuis le téléphone (Android) ou un favori du navigateur.",
    ["Seconde vie d'un contenu : un article ou un webinaire devient une série de posts.", OFFRE_PRO]] },
  { kicker: "Votre voix", titre: "Des posts qui vous ressemblent", bg: "#FFFFFF", points: [
    "Profil de rédaction : activité, cible, ton, mots à privilégier ou à éviter.",
    `${MOTS.langues} langues de rédaction, toujours relues avant utilisation.`,
    "Copilote éditorial : des sujets argumentés chaque jour, qui s'affinent selon vos choix.",
    "Retouche, variantes et réécriture ciblée de l'accroche, du corps ou de la signature."] },
  { kicker: "Publier", titre: "Programmer, sans perdre la main", bg: "#FFFFFF", points: [
    "Calendrier et kanban, validation avant envoi si vous la voulez.",
    "Publication sur votre profil, avec l'autorisation OAuth de LinkedIn : aucun mot de passe LinkedIn ne nous est confié.",
    ["Campagnes guidées : une série cohérente, validée sur un exemple.", OFFRE_PRO],
    "Visuels par IA, plan de tournage et téléprompteur pour la vidéo."] },
  { kicker: "Mesurer", titre: "Ce que disent vos propres chiffres", bg: "#FFFFFF", points: [
    "Commentaires et réactions de chaque post publié, progression par campagne.",
    "Le coach compare vos posts à votre médiane, avec le nombre de posts et un niveau de confiance.",
    `Avant ${MOTS.seuilCoach} posts mesurés, il ne dit rien plutôt que d'inventer.`,
    "Il ne prétend pas deviner l'algorithme de LinkedIn."] },
  { kicker: "Équipe et clients", titre: "Chacun voit ce qu'il doit voir", bg: "#FFFFFF", offre: "Offre Agence", points: [
    "Vos clients valident leurs posts depuis un lien privé, sans compte.",
    "Affectation des clients aux collaborateurs, cloisonnement par défaut.",
    "Rapport mensuel partageable en lecture seule."] },
  { kicker: "Assistants IA", titre: "Parlez de vos posts à votre assistant", bg: "#FFFFFF", offre: OFFRE_PRO, points: [
    "Il lit vos posts, votre planning et vos résultats, et prépare des brouillons.",
    "Il ne programme ni ne publie rien : un brouillon reste un brouillon jusqu'à votre relecture.",
    "Retrait en un clic, avec effet immédiat."] },
];

function Pastille({ children }) {
  return <span className="inline-block ml-1.5 align-middle text-[11px] font-semibold bg-[#F6E3E0] text-[#7A2342] px-2.5 py-0.5 rounded-full">{children}</span>;
}

export default function ProduitPage() {
  if (!produitOuvert()) notFound();
  const titre = liaisonsEm("De vos sources à un post relu,", "étape par étape.");
  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]">Produit</p>
        <h1 className="font-display text-[38px] sm:text-[56px] leading-[1.06] tracking-[-0.02em] mt-3 max-w-[860px]">
          {titre[0]}<em className="text-[#C2456F]">{titre[1]}</em>
        </h1>
        <p className="text-[19px] sm:text-xl leading-relaxed text-[#4A3A50] mt-6 max-w-[720px]">
          Vous déposez la matière, {BRAND_NAME} rédige, contrôle et planifie. Vous relisez et vous validez : rien ne part sans votre accord si vous le souhaitez.
        </p>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ETAPES.map(([nom, texte], i) => (
            <li key={nom} className="flex gap-3.5 items-start bg-white border border-[#EFE4E0] rounded-3xl p-5">
              <span className="flex-none w-10 h-10 rounded-full bg-[#F6E3E0] text-[#7A2342] font-display text-xl flex items-center justify-center">{i + 1}</span>
              <div><strong className="block text-base">{nom}</strong><p className="text-sm leading-relaxed text-[#4A3A50] mt-0.5">{texte}</p></div>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {BLOCS.map((b) => (
            <section key={b.kicker} className="bg-white border border-[#EFE4E0] rounded-[28px] p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#C2456F]">{b.kicker}</p>
              <h3 className="font-display text-[24px] leading-[1.15] mt-2 mb-4">{liaisons(b.titre)}</h3>
              <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[15px] leading-relaxed text-[#4A3A50]">
                {b.points.map((p) => Array.isArray(p)
                  ? <li key={p[0]}>{p[0]}<Pastille>{p[1]}</Pastille></li>
                  : <li key={p}>{p}</li>)}
              </ul>
              {b.offre && <p className="mt-4"><Pastille>{b.offre}</Pastille></p>}
            </section>
          ))}
        </div>

        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mt-16">Les deux contrôles</p>
        <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] mt-2 mb-8">{liaisons("Le fond d'un côté, la forme de l'autre.")}</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Link href="/produit/verification" className="block rounded-[28px] bg-[#FCE6D6] p-8 no-underline text-[#2E1F33] hover:shadow-md transition-shadow">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#8A3B12]">Chiffres à vérifier</span>
            <span className="block font-display text-[26px] leading-[1.15] mt-3">{liaisons("Les chiffres absents de vos informations sont signalés.")}</span>
            <span className="block text-[15px] leading-relaxed text-[#6E2E0E] mt-3">Indicatif, ne remplace pas votre relecture.</span>
            <span className="block font-semibold text-[#7A2342] mt-5">Voir comment ça marche →</span>
          </Link>
          <Link href="/scoring" className="block rounded-[28px] bg-[#DCE9DF] p-8 no-underline text-[#2E1F33] hover:shadow-md transition-shadow">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#2B5340]">Contrôle de forme · {OFFRE_PRO}</span>
            <span className="block font-display text-[26px] leading-[1.15] mt-3">{liaisons("Sept critères à règles fixes, détaillés un par un.")}</span>
            <span className="block text-[15px] leading-relaxed text-[#2F4A3C] mt-3">Une note de mise en forme, pas une prévision de vues.</span>
            <span className="block font-semibold text-[#1F4030] mt-5">Voir les critères →</span>
          </Link>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 bg-white border border-[#EFE4E0] rounded-3xl px-7 py-6">
          <p className="text-[15px] leading-relaxed text-[#4A3A50] max-w-[640px]">Où sont vos données, comment elles sont protégées, et ce que nous n&apos;avons pas (pas de certification SOC 2 ni ISO 27001).</p>
          <Link href="/securite" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Sécurité et confidentialité</Link>
        </div>
        <p className="mt-6 text-sm"><Link href="/produit/methode" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Comment l&apos;outil fonctionne, étape par étape →</Link></p>
      </div>
    </Shell>
  );
}
