import Link from "next/link";
import Shell from "@/components/v2/Shell";
import JsonLd from "@/components/home/JsonLd";
import { JOIN_HREF, pick } from "@/lib/access";
import { BRAND_NAME } from "@/lib/brand";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { produitOuvert } from "@/lib/siteProduit";
import { E4 } from "@/lib/e4Page";
import { liaisons } from "@/lib/typo";

// Nouvelle accueil (maquette « Accueil »). Les cartes de preuve n'existent que si la preuve est publiée (SITE_PREUVES=1) :
// aucune carte vers une page fermée, aucun chiffre sans page qui le démontre.
const ETAPES = [
  ["Déposez vos sources", "Documents, liens, notes, ou quelques minutes de dictée. L'enregistrement n'est pas conservé : seul le texte que vous gardez l'est."],
  ["Rédigez à votre voix", "Votre profil, vos mots à privilégier ou à éviter et vos posts passés guident la rédaction. Vous voyez d'où vient chaque post."],
  ["Relisez, puis décidez", "Les chiffres absents de vos documents sont signalés avant publication. Rien ne remplace votre relecture."],
];

// Questions d'accueil : celles qui répondent aux objections les plus courantes. Les réponses reprennent ce que disent déjà
// /securite, /a-propos et le contrôle de forme : aucune promesse nouvelle. Pas de FAQPage JSON-LD (les textes restent en dur ici).
const QUESTIONS = [
  ["Qui écrit réellement les posts ?", "L'IA rédige à partir de ce que vous avez déposé (documents, liens, notes, anciens posts) et de vos consignes de style. Chaque post peut être retouché, validé ou refusé avant publication."],
  ["Le texte peut-il contenir des chiffres inventés ?", "Cela peut arriver avec n'importe quelle IA. Avant publication, le contrôle signale les chiffres absents de vos informations ; il ne prouve pas qu'un chiffre est juste. Relisez chaque post."],
  ["Que devient ce que je dépose ?", "Vos documents et vos liens servent à rédiger vos posts : leur contenu est transmis au modèle d'IA uniquement pour cela, et vous pouvez les supprimer à tout moment. L'enregistrement d'une dictée n'est pas conservé, seul le texte que vous gardez l'est."],
  ["Mes posts seront-ils publiés sans mon accord ?", "Vous décidez : avec la validation activée, chaque post planifié attend votre feu vert."],
  ["Puis-je résilier à tout moment ?", "Oui, l'abonnement est sans engagement : la résiliation prend effet à la fin de la période en cours."],
];

function Verification() {
  return produitOuvert()
    ? <Link href="/produit/verification" className="font-semibold text-[#7A2342] hover:underline">Comment ça marche →</Link>
    : null;
}

export default function HomeV2() {
  // Titre en trois lignes fixes (une idée par ligne), puis une promesse en sous-titre, plus petite.
  const LIGNES = ["Vos sources,", "vos consignes,", "votre voix."];
  const sousTitre = liaisons("Ce qui s'en écarte nettement, on le signale.");
  const B = E4.conditions.find((c) => c.code === "B");
  const C = E4.conditions.find((c) => c.notre);
  return (
    <Shell>
      <JsonLd />
      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <section className="pt-8 pb-16 flex flex-wrap gap-12 lg:gap-16 items-center">
          <div className="flex-[1_1_480px] min-w-0">
            <p className="inline-block bg-[#F6E3E0] text-[#7A2342] text-[13px] font-semibold px-3.5 py-1.5 rounded-full mb-4">{pick("Bêta fermée · accès sur invitation", "Essai gratuit, sans carte bancaire")}</p>
            <h1 className="font-display text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.05] tracking-[-0.02em]">{LIGNES.map((l) => <span key={l} className="block whitespace-nowrap">{l}</span>)}</h1>
            <p className="font-display italic text-[22px] sm:text-[28px] leading-[1.25] text-[#C2456F] mt-5 max-w-[540px]">{sousTitre}</p>
            <p className="text-[17px] sm:text-[19px] leading-relaxed text-[#4A3A50] mt-6 max-w-[540px]">
              {BRAND_NAME} rédige vos posts LinkedIn à partir de vos documents, de vos notes et de votre voix. Avant publication, il signale les chiffres absents de vos informations et les écarts à vos consignes explicites : émojis, hashtags, tutoiement, longueur. Vous relisez, vous décidez.
            </p>
            <div className="flex flex-wrap gap-3.5 mt-8">
              <Link href={JOIN_HREF} className="bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-7 py-3.5 rounded-full">{pick("Demander une invitation", "Démarrer gratuitement")}</Link>
              {preuvesOuvertes() && <Link href="/preuves" className="border-[1.5px] border-[#C2456F] text-[#9E3157] hover:bg-[#F6E3E0] font-semibold px-7 py-3 rounded-full">Voir la preuve</Link>}
            </div>
          </div>
          <div className="flex-[1_1_420px] min-w-0 bg-white border border-[#EFE4E0] rounded-[28px] p-6 sm:p-7 shadow-[0_18px_40px_rgba(46,31,51,0.08)]" data-testid="accueil-exemple">
            <div className="flex justify-between items-center mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B5A70]">Brouillon de post</span>
              <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">Exemple fictif</span>
            </div>
            <p className="text-base leading-[1.65]">Après notre refonte du processus d&apos;accueil, le délai moyen est passé de 6 à 4 semaines, et <mark className="bg-[#FCE6D6] text-[#8A3B12] px-1.5 rounded-md font-semibold">37 %</mark> de nos nouveaux clients nous ont recommandés.</p>
            <div className="mt-4 bg-[#FCE6D6] rounded-2xl px-4 py-3.5 text-sm leading-relaxed text-[#6E2E0E]"><strong>« 37 % » n&apos;apparaît dans aucun de vos documents.</strong> Ajoutez la source, corrigez le chiffre ou retirez-le avant de publier.</div>
            <div className="mt-3 bg-[#DCE9DF] rounded-2xl px-4 py-3 text-sm leading-relaxed text-[#1F4030]">« de 6 à 4 semaines » retrouvé dans votre document d&apos;étude de cas.</div>
            <div className="mt-3 bg-[#FCE6D6] rounded-2xl px-4 py-3 text-sm leading-relaxed text-[#6E2E0E]">4 hashtags alors que vos consignes en limitent le nombre à 2.</div>
          </div>
        </section>
      </div>

      <section className="bg-white border-y border-[#EFE4E0]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-8 py-16">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Comment ça se passe&nbsp;?</p>
          <h2 className="font-display text-[26px] sm:text-[32px] lg:text-[38px] tracking-[-0.015em] mb-10 lg:whitespace-nowrap" data-testid="accueil-gestes-titre">{liaisons("Trois gestes, et c'est vous qui gardez la main.")}</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {ETAPES.map(([nom, texte], i) => (
              <div key={nom} className="bg-[#FCF8F5] rounded-3xl p-7">
                <div className="w-11 h-11 rounded-full bg-[#F6E3E0] text-[#7A2342] font-display text-[22px] flex items-center justify-center">{i + 1}</div>
                <h3 className="text-xl font-semibold mt-4 mb-2">{liaisons(nom)}</h3>
                <p className="text-base leading-relaxed text-[#4A3A50]">{texte}</p>
              </div>
            ))}
          </div>
          {produitOuvert() && <p className="mt-8"><Link href="/produit/methode" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Voir le détail, étape par étape →</Link></p>}
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-8">
        <section className="pt-20 pb-10">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Deux contrôles, deux rôles</p>
          <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] mb-9 max-w-[680px]">{liaisons("Le fond d'un côté, la forme de l'autre.")}</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-[#FCE6D6] rounded-[28px] p-8 sm:p-9">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#8A3B12]">Chiffres à vérifier</span>
              <h3 className="font-display text-[26px] sm:text-[28px] leading-[1.15] mt-3 mb-2.5">{liaisons("Un chiffre absent de vos informations est signalé.")}</h3>
              <p className="text-base leading-relaxed text-[#4A3A50] mb-5">Indicatif : le contrôle compare les chiffres du post à ce que vous avez fourni. Il ne prouve pas qu&apos;un chiffre est juste.</p>
              <Verification />
            </div>
            <div className="bg-[#DCE9DF] rounded-[28px] p-8 sm:p-9">
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#2B5340]">Contrôle de forme</span>
              <h3 className="font-display text-[26px] sm:text-[28px] leading-[1.15] mt-3 mb-2.5">{liaisons("Une note de mise en forme, à règles fixes.")}</h3>
              <p className="text-base leading-relaxed text-[#2F4A3C] mb-5">Accroche, longueur, aération, appel à l&apos;action : le même texte obtient toujours la même note. Ce n&apos;est pas une prévision de vues.</p>
              <Link href="/scoring" className="font-semibold text-[#1F4030] hover:underline">Voir les critères →</Link>
            </div>
          </div>
        </section>

        {preuvesOuvertes() && (
          <section id="preuves" className="pt-14 pb-20">
            <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Preuves</p>
            <h2 className="font-display text-[26px] sm:text-[32px] lg:text-[38px] tracking-[-0.015em] mb-9 lg:whitespace-nowrap" data-testid="accueil-mesure-titre">{liaisons("Ce que nous avons mesuré, et rien de plus.")}</h2>
            <div className="flex flex-wrap gap-7 items-stretch">
              <div className="flex-[2_1_560px] bg-white border border-[#EFE4E0] rounded-[28px] p-7 sm:p-9">
                <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">Test E4 · résultats du {E4.date}</span>
                <h3 className="font-display text-[26px] sm:text-[28px] leading-[1.15] mt-4 mb-2.5">{liaisons("Une IA qui écrit votre post invente-t-elle des faits ?")}</h3>
                <p className="text-base leading-relaxed text-[#4A3A50] mb-5">
                  Chiffres, dates, noms, sources, citations : dans notre test, un modèle généraliste a inventé ou déformé {B.moyenne} éléments par post même avec les faits fournis ; {BRAND_NAME}, {C.moyenne}. Dix sujets fictifs, un seul classeur : protocole figé avant génération, tout publié, y compris ce qui ne nous avantage pas.
                </p>
                <Link href="/preuves/test-e4" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Lire le test et ses limites →</Link>
              </div>
              <div className="flex-[1_1_320px] bg-[#F6E3E0] rounded-[28px] p-7 sm:p-9">
                <h3 className="font-display text-2xl mb-4">Ce que nous ne promettons pas</h3>
                <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[15px] leading-relaxed text-[#4A3A50]">
                  <li>Aucune promesse de portée, de vues ou de réactions.</li>
                  <li>Aucune garantie de conformité à LinkedIn.</li>
                  <li>Un chiffre non signalé n&apos;est pas un chiffre juste : relisez.</li>
                </ul>
              </div>
            </div>
          </section>
        )}

        <section id="offres" className="pb-10 pt-6">
          <div className="bg-white border border-[#EFE4E0] rounded-[28px] px-7 sm:px-10 py-8 flex flex-wrap gap-6 items-center justify-between">
            <div className="flex-[1_1_380px] min-w-0">
              <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-2">Offres</p>
              <p className="text-[17px] leading-relaxed text-[#4A3A50]">{pick("Pendant la bêta fermée, l'accès est offert aux testeurs invités. Les offres prévues à l'ouverture publique sont détaillées sur la page des tarifs.", "Les offres sont détaillées sur la page des tarifs, avec un comparatif complet.")}</p>
            </div>
            <Link href="/tarifs" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Voir les offres →</Link>
          </div>
        </section>

        <section id="faq" className="pb-16 pt-6 max-w-[820px]">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">Questions fréquentes</p>
          <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] mb-7">{liaisons("Avant de vous lancer.")}</h2>
          <div className="flex flex-col gap-3">
            {QUESTIONS.map(([q, a]) => (
              <details key={q} className="bg-white border border-[#EFE4E0] rounded-2xl p-5 group">
                <summary className="font-semibold text-[16px] cursor-pointer list-none flex items-center justify-between gap-4">{liaisons(q)}<span aria-hidden className="text-[#C2456F] transition-transform group-open:rotate-90">›</span></summary>
                <p className="text-[15px] leading-relaxed text-[#4A3A50] mt-3">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pb-24 pt-8">
          <div className="bg-[#F6E3E0] rounded-[36px] px-6 sm:px-14 py-10 sm:py-14 flex flex-wrap gap-8 items-center justify-between">
            <div className="flex-[1_1_400px] min-w-0">
              <h2 className="font-display text-[30px] sm:text-[36px] leading-[1.1] mb-2.5">{liaisons(pick("Une place dans la bêta fermée.", "Essayez sur vos propres sources."))}</h2>
              <p className="text-[17px] leading-relaxed text-[#4A3A50]">{pick("Accès offert aux testeurs invités, sans carte bancaire. Tarifs prévus à l'ouverture publique.", "14 jours d'essai gratuit, sans carte bancaire.")}</p>
            </div>
            <Link href={JOIN_HREF} className="bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-8 py-3.5 rounded-full">{pick("Demander une invitation", "Démarrer gratuitement")}</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
