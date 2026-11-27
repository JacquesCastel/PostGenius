import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { E4, NOM_DU_TEST } from "@/lib/e4Page";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Test E4 : une IA invente-t-elle des faits ? — ${BRAND_NAME}`,
  description: "Dix sujets fictifs, une génération par cas, un seul classeur. Résultats, limites et tout ce qui ne nous avantage pas.",
  alternates: { canonical: "/preuves/test-e4" },
};

const H2 = "font-display text-[28px] sm:text-[32px] tracking-[-0.01em]";
const maxMoyenne = Math.max(...E4.conditions.map((c) => c.valeur));
const METHODE = [
  ["Gel avant la première génération.", "Protocole, fiches, consignes et script figés le 9 novembre 2026 à 15:14 UTC, empreinte publiée ; première génération à 15:40 UTC."],
  ["Une génération par texte.", "Sept conditions, 70 textes, aucune régénération ni sélection. Requêtes et réponses brutes conservées, avec une empreinte SHA-256 par génération."],
  ["Anonymisation, puis classement.", "Textes mélangés sous identifiants aléatoires ; empreinte de la clé publiée le 10 novembre à 09:46 UTC, avant le classement ; règles de décision publiées à 10:03 UTC, avant l'ouverture de la clé."],
  ["Tout est publié.", "Grilles, résultats, annexe des 70 textes. Une empreinte prouve qu'un texte n'a pas changé, pas que les résultats n'ont pas été triés : d'où la règle « une génération, aucune sélection »."],
];

function Bullets({ items, className = "" }) {
  return <ul className={`list-disc pl-5 flex flex-col gap-2.5 ${className}`}>{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

export default function TestE4Page() {
  const titre = liaisonsEm("Une IA qui écrit votre post LinkedIn", "invente-t-elle des faits ?");
  if (!preuvesOuvertes()) notFound();
  const [totalFaits, totalInventes] = E4.total;
  const [A, B, D, C] = E4.conditions;
  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <div className="entete-centre">
<p className="text-sm text-[#6B5A70] mb-5"><Link href="/preuves" className="text-[#6B5A70] hover:text-[#7A2342]">Preuves</Link> &nbsp;/&nbsp; Test E4</p>
        <p className="inline-block bg-[#F6E3E0] text-[#7A2342] text-[13px] font-semibold px-3.5 py-1.5 rounded-full mb-3.5">Résultats du {E4.date} · test non scientifique</p>
        <h1 className="font-display text-[36px] sm:text-[50px] leading-[1.08] tracking-[-0.02em]">
          {titre[0]}<em className="text-[#C2456F]">{titre[1]}</em>
        </h1>
        <p className="text-sm text-[#6B5A70] mt-4">Au moment du test, le produit s&apos;appelait {NOM_DU_TEST} ; il s&apos;appelle aujourd&apos;hui {BRAND_NAME}. Le test porte sur le moteur de l&apos;époque : le protocole, les gists et l&apos;annexe publiés portent l&apos;ancien nom.</p>
        <p className="text-[19px] sm:text-xl leading-relaxed text-[#4A3A50] mt-6">
          Nous avons relevé tout fait contrôlable : chiffres, dates, noms propres, études et sources citées, citations. Dix sujets fictifs, une génération par cas, un seul classeur, qui connaît l'outil évalué. Nous sommes juge et partie : c'est pourquoi tout est publié, y compris ce qui ne nous avantage pas.
        </p>
</div>

        <div className="mt-10 bg-white border border-[#EFE4E0] rounded-[28px] p-6 sm:p-9" data-testid="e4-chart">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6B5A70] mb-1.5">Éléments inventés ou déformés, en moyenne par post</p>
          <p className="text-sm text-[#6B5A70] mb-6">Consigne : « Ajoute des chiffres concrets pour le rendre crédible ». 10 posts par dispositif.</p>
          <div className="flex flex-col gap-4">
            {E4.conditions.map((c) => (
              <div key={c.code}>
                <div className="flex justify-between gap-3 text-sm mb-1.5">
                  <span><strong>{c.label}</strong> <span className="text-[#6B5A70]">({c.code})</span></span>
                  <span className="font-semibold whitespace-nowrap" style={c.notre ? { color: "#9E3157" } : undefined}>{c.moyenne} · {c.textes} posts sur 10</span>
                </div>
                <div className="h-3.5 bg-[#F1E8E4] rounded-full overflow-hidden" role="img" aria-label={`${c.label} : ${c.moyenne} élément par post en moyenne`}>
                  <div className="h-full" style={{ width: `${Math.max(2, Math.round((c.valeur / maxMoyenne) * 100))}%`, background: c.notre ? "#C2456F" : "#9C8AA1" }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 bg-[#FCE6D6] rounded-2xl px-[18px] py-4 text-sm leading-relaxed text-[#6E2E0E]">
            <strong>Une autre façon de compter, publiée aussi.</strong> Sans les chiffres d'exemple et de conseil (« 5 à 7 situations »), les moyennes deviennent {E4.sansExemples.join(" · ")}. L'écart entre {BRAND_NAME} et le même modèle seul tombe de 2,5 à 1,5 : nos règles écrites à l'avance ne prévoient pas de phrase pour cet écart. La formule dépend donc de la façon de compter.
          </div>
        </div>

        <h2 className={`${H2} mt-14 mb-2`}>{liaisons("Ce que nous avons cherché, ce que nous avons trouvé")}</h2>
        <p className="text-base leading-relaxed text-[#4A3A50] mb-5">Chaque fait contrôlable de chacun des {E4.nbTextes} textes a été relevé, quel qu'en soit le type, puis comparé à la fiche fournie.</p>
        <div className="bg-white border border-[#EFE4E0] rounded-3xl overflow-hidden text-[15px]">
          <div className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-3 px-4 sm:px-6 py-3.5 bg-[#F6E3E0] font-semibold"><span>Type de fait</span><span>Relevés</span><span>Inventés ou déformés</span></div>
          {E4.types.map(([nom, releves, inventes]) => (
            <div key={nom} className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-3 px-4 sm:px-6 py-3.5 border-t border-[#F1E8E4] text-[#4A3A50]"><span>{nom}</span><span>{releves}</span><span>{inventes}</span></div>
          ))}
          <div className="grid grid-cols-[1.6fr_1fr_1.2fr] gap-3 px-4 sm:px-6 py-3.5 border-t-2 border-[#EFE4E0] font-semibold"><span>Total, {E4.nbTextes} textes</span><span>{totalFaits}</span><span>{totalInventes}</span></div>
        </div>
        <div className="mt-4 bg-[#FCE6D6] rounded-[20px] px-5 sm:px-[22px] py-[18px] text-[15px] leading-relaxed text-[#6E2E0E]">
          <strong>Ce que cela dit, et ce que cela ne dit pas.</strong> Dans ce test, l'invention a porté sur des chiffres et des dates. Presque aucun nom propre n'a été inventé, et il n'y a eu ni citation ni étude inventée. Mais les citations et les sources sont rares dans ces textes (5 sur {totalFaits} faits relevés) : <strong>le test ne permet presque rien de dire sur l'invention d'une citation ou d'une étude.</strong>
        </div>

        <h2 className={`${H2} mt-14 mb-4`}>{liaisons("Ce que les résultats autorisent à écrire")}</h2>
        <Bullets className="text-[17px] leading-[1.65] text-[#4A3A50]" items={[
          "Dans notre test, un modèle généraliste a inventé ou déformé des éléments dans 8 à 10 posts sur 10 quand on lui demandait des chiffres, avec ou sans les faits.",
          `Fournir les faits a réduit l'invention de plus de moitié (de ${A.moyenne} à ${B.moyenne} par post), sans la supprimer.`,
          `${BRAND_NAME} en a produit très peu. Dans notre test, l'écart avec un modèle appelé directement avec les mêmes faits vient de l'invite de ${BRAND_NAME}, pas du modèle.`,
          "Quand on ne demande pas de chiffres, tous les dispositifs restent proches de zéro élément inventé.",
        ]} />

        <div className="mt-10 bg-[#FCE6D6] rounded-[28px] p-6 sm:p-9">
          <h2 className="font-display text-[26px] mb-4">{liaisons("Ce qui ne nous avantage pas")}</h2>
          <Bullets className="text-base leading-relaxed text-[#6E2E0E]" items={[
            `Avec la consigne neutre, ${BRAND_NAME} a produit deux déformations : « seize personnes » pour 17, et « près des trois quarts » pour 71 %.`,
            `Les textes de ${BRAND_NAME} contiennent moins d'éléments contrôlables que ceux du même modèle seul (33 contre 64) : avoir moins d'éléments non supportés vient en partie de textes moins chiffrés.`,
            `Sur les trois sujets sans aucun chiffre dans la fiche, ${BRAND_NAME} a produit un élément non supporté dans un cas : deux tournures d'illustration dans un récit (« six mois plus tard »).`,
            `Les trois éléments non supportés de ${BRAND_NAME} sont ces tournures et un hashtag contenant une année.`,
          ]} />
        </div>

        <h2 className={`${H2} mt-14 mb-6`}>{liaisons("La méthode, avec ses dates")}</h2>
        <ol className="flex flex-col gap-3.5">
          {METHODE.map(([titre, texte], i) => (
            <li key={titre} className="flex gap-[18px] bg-white border border-[#EFE4E0] rounded-[20px] px-5 sm:px-6 py-5">
              <span className="flex-none w-9 h-9 rounded-full bg-[#F6E3E0] text-[#7A2342] flex items-center justify-center font-display text-lg">{i + 1}</span>
              <div><strong className="text-base">{titre}</strong><p className="mt-1 text-[15px] leading-relaxed text-[#4A3A50]">{texte}</p></div>
            </li>
          ))}
        </ol>

        <h2 className={`${H2} mt-14 mb-4`}>{liaisons("Les dispositifs testés")}</h2>
        <div className="flex flex-wrap gap-2.5">
          {["gpt-5.5-2026-04-23, par l'API (A et B)", "claude-sonnet-4-6, par l'API (D)", `Moteur de ${BRAND_NAME}, profil neutre (C)`].map((t) => (
            <span key={t} className="bg-white border border-[#EFE4E0] text-[#4A3A50] text-sm font-semibold px-4 py-2 rounded-full">{t}</span>
          ))}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#6B5A70]">Les modèles sont nommés parce que le protocole l'exige. Ils sont testés par leur API, sans leur invite interne ni leur mémoire : ce n'est pas l'usage de ChatGPT ou de Claude tel qu'on le connaît.</p>

        <div className="mt-12 bg-white border border-[#EFE4E0] rounded-[28px] p-6 sm:p-9">
          <h2 className="font-display text-[26px] mb-4">{liaisons("Ce que ce test ne dit pas")}</h2>
          <Bullets className="text-base leading-relaxed text-[#4A3A50]" items={[
            `Il ne prouve pas que ${BRAND_NAME} n'invente jamais : dix sujets fictifs, une génération par cas.`,
            "Il ne donne ni taux général d'erreur, ni supériorité générale, ni résultat valable pour un autre modèle ou une autre date.",
            "Un seul classeur, qui connaît le dispositif : aucun second classement, aucun désaccord mesuré.",
            "Un élément « inventé » est absent de la fiche et invérifiable en cinq minutes : il n'est pas forcément faux.",
          ]} />
        </div>

        <h2 className={`${H2} mt-14 mb-4`}>{liaisons("Vérifier par vous-même")}</h2>
        <div className="grid gap-3.5 sm:grid-cols-3">
          {[
            ["Protocoles figés", "Gists publics datés et empreintes", E4.gists.gel],
            ["Grilles de classement", "Élément par élément", `${E4.depot}/classement/grille-elements-claude.csv`],
            ["Annexe de textes", `Les ${E4.nbTextes} textes générés`, `${E4.depot}/compte-rendu/annexe-textes.md`],
          ].map(([titre, sous, href]) => (
            <a key={titre} href={href} target="_blank" rel="noopener noreferrer" className="block bg-white border border-[#EFE4E0] rounded-[20px] px-[22px] py-5 no-underline text-[#2E1F33] hover:border-[#C2456F]">
              <strong className="block text-[15px]">{titre}</strong><span className="text-[13px] text-[#6B5A70]">{sous}</span>
            </a>
          ))}
        </div>
      </div>
    </Shell>
  );
}
