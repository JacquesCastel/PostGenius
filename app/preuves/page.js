import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { E4, NOM_DU_TEST } from "@/lib/e4Page";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic"; // l'interrupteur se lit à chaque requête : l'ouverture ne demande pas de nouveau build

export const metadata = {
  title: `Preuves — ${BRAND_NAME}`,
  description: "Ce que nous prouvons, et comment : protocole figé avant, textes publiés en entier, limites écrites.",
  alternates: { canonical: "/preuves" },
};

const MANIERES = [
  ["Figé avant", "Le protocole est publié avec une empreinte et une date, avant la première génération."],
  ["Publié en entier", "Tous les textes, toutes les grilles de classement. Une génération par cas, aucune sélection."],
  ["Limites écrites", "Chaque résultat dit ce qu'il ne permet pas de conclure, et qui l'a classé."],
  ["Le défavorable aussi", "Ce qui ne nous avantage pas est publié au même niveau que le reste."],
];

export default function PreuvesPage() {
  const titre = liaisonsEm("Ce que nous prouvons,", "et comment.");
  if (!preuvesOuvertes()) notFound();
  const moyenneC = E4.conditions.find((c) => c.notre).moyenne, moyenneB = E4.conditions[1].moyenne;
  return (
    <Shell>
      <div className="max-w-[960px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]">Preuves</p>
        <h1 className="font-display text-[40px] sm:text-[56px] leading-[1.06] tracking-[-0.02em] mt-3">
          {titre[0]}<em className="text-[#C2456F]">{titre[1]}</em>
        </h1>
        <p className="text-[19px] sm:text-xl leading-relaxed text-[#4A3A50] mt-6 max-w-[760px]">
          Une preuve, ici, c'est un protocole publié avant le test, des textes complets et des limites écrites. Vous pouvez la vérifier sans nous croire sur parole. Elle porte sur ce que fait l'outil de vos informations.
        </p>

        <h2 className="font-display text-[28px] sm:text-[32px] tracking-[-0.01em] mt-14 mb-5">{liaisons("Notre manière de prouver")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MANIERES.map(([titre, texte], i) => (
            <div key={titre} className="bg-white border border-[#EFE4E0] rounded-3xl p-6">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-display text-xl" style={{ background: i === 3 ? "#FCE6D6" : "#F6E3E0", color: i === 3 ? "#8A3B12" : "#7A2342" }}>{i + 1}</div>
              <h3 className="text-[17px] font-semibold mt-3.5 mb-1.5">{liaisons(titre)}</h3>
              <p className="text-sm leading-relaxed text-[#4A3A50]">{texte}</p>
            </div>
          ))}
        </div>

        <h2 className="font-display text-[28px] sm:text-[32px] tracking-[-0.01em] mt-16 mb-5">{liaisons("Les preuves publiées")}</h2>
        <div className="bg-white border border-[#EFE4E0] rounded-[32px] p-6 sm:p-10">
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">Invention de faits · test E4</span>
            <span className="text-[13px] text-[#6B5A70]">Résultats du {E4.date}</span>
          </div>
          <h3 className="font-display text-[26px] sm:text-[32px] leading-[1.15] mt-4 mb-2.5">{liaisons("Une IA qui écrit votre post LinkedIn invente-t-elle des faits ?")}</h3>
          <p className="text-[17px] leading-[1.7] text-[#4A3A50] mb-4">
            Nous avons relevé, dans {E4.nbTextes} textes, tout fait contrôlable : chiffres, dates, noms propres, études et sources citées, citations. Dans notre test, un modèle généraliste a inventé ou déformé {moyenneB} éléments par post même avec les faits fournis ; {NOM_DU_TEST}, {moyenneC}. Dix sujets fictifs, un seul classeur.
          </p>
          <div className="bg-[#FCF8F5] rounded-[20px] p-5 sm:px-6 flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-4 justify-between items-baseline">
              <span className="text-sm font-semibold">Protocole figé</span>
              <span className="text-[13px] text-[#6B5A70]">{E4.gel}</span>
            </div>
            <div className="font-mono text-[13px] leading-normal text-[#4A3A50] break-all bg-white border border-[#EFE4E0] rounded-xl px-3.5 py-3">SHA-256 : {E4.empreinte}</div>
            <a href={E4.gists.gel} className="text-sm font-semibold text-[#9E3157] hover:text-[#7A2342]">Voir la publication datée (gist public) →</a>
          </div>
          <div className="flex flex-wrap gap-4 mt-7">
            <Link href="/preuves/test-e4" className="bg-[#C2456F] text-white font-semibold text-[15px] px-6 py-3 rounded-full hover:bg-[#9E3157]">Lire le test, ses résultats et ses limites</Link>
            <a href={`${E4.depot}/compte-rendu/annexe-textes.md`} className="border-[1.5px] border-[#C2456F] text-[#9E3157] font-semibold text-[15px] px-6 py-2.5 rounded-full hover:bg-[#F6E3E0]">Consulter les {E4.nbTextes} textes</a>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="bg-[#DCE9DF] rounded-[28px] p-7">
            <h3 className="text-lg font-semibold text-[#1F4030] mb-3">Ce qu'on publie ici</h3>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-[#2F4A3C]"><li>Ce qui a été figé avant d'être mesuré.</li><li>Les résultats complets, y compris ceux qui ne nous avantagent pas.</li><li>Les empreintes et les liens pour les vérifier.</li></ul>
          </div>
          <div className="bg-[#F6E3E0] rounded-[28px] p-7">
            <h3 className="text-lg font-semibold text-[#7A2342] mb-3">Ce qu'on n'y met pas</h3>
            <ul className="list-disc pl-5 flex flex-col gap-2 text-[15px] leading-relaxed text-[#4A3A50]"><li>Des témoignages ou des chiffres sans source publique.</li><li>Des promesses de portée ou de résultat.</li></ul>
          </div>
        </div>
        <p className="mt-10 text-sm leading-relaxed text-[#6B5A70]">Une empreinte prouve qu'un texte n'a pas changé depuis sa date de publication, pas qu'il est exact.</p>
      </div>
    </Shell>
  );
}
