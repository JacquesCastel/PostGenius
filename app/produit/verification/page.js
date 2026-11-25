import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { produitOuvert } from "@/lib/siteProduit";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { MOTS } from "@/lib/produitPages";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Chiffres à vérifier — ${BRAND_NAME}`,
  description: "Un chiffre absent de vos informations est signalé avant publication. Ce que le contrôle fait, et ce qu'il ne fait pas.",
  alternates: { canonical: "/produit/verification" },
};

const H2 = "font-display text-[28px] sm:text-[32px] tracking-[-0.01em]";
const Liste = ({ items, className = "" }) => <ul className={`list-disc pl-5 flex flex-col gap-2.5 ${className}`}>{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
const Fort = ({ children }) => <strong>{children}</strong>;

export default function VerificationPage() {
  if (!produitOuvert()) notFound();
  const titre = liaisonsEm("Un chiffre absent de vos informations est", "signalé avant publication.");
  return (
    <Shell>
      <div className="max-w-[820px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <p className="text-sm text-[#6B5A70] mb-5"><Link href="/produit" className="text-[#6B5A70] hover:text-[#7A2342]">Produit</Link> &nbsp;/&nbsp; Chiffres à vérifier</p>
        <p className="inline-block bg-[#FCE6D6] text-[#8A3B12] text-[13px] font-semibold px-3.5 py-1.5 rounded-full mb-3.5">Contrôle interne · indicatif</p>
        <h1 className="font-display text-[36px] sm:text-[50px] leading-[1.08] tracking-[-0.02em]">{titre[0]}<em className="text-[#C2456F]">{titre[1]}</em></h1>
        <p className="text-[19px] sm:text-xl leading-relaxed text-[#4A3A50] mt-6">
          Le contrôle repère un nombre qui ne figure dans aucune des informations données à la rédaction. Il ne dit pas si ce nombre est faux : il vous demande de le regarder.
        </p>

        <div className="mt-10 bg-white border border-[#EFE4E0] rounded-[28px] p-6 sm:p-9" data-testid="verification-exemple">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B5A70]">Exemple</span>
            <span className="text-xs font-semibold bg-[#F6E3E0] text-[#7A2342] px-3 py-1 rounded-full">Exemple fictif</span>
          </div>
          <p className="text-[17px] leading-[1.7]">Notre équipe a accompagné <mark className="bg-[#DCE9DF] text-[#1F4030] px-1.5 rounded-md font-semibold">12 clients</mark> sur ce chantier, pour un gain de <mark className="bg-[#FCE6D6] text-[#8A3B12] px-1.5 rounded-md font-semibold">37 %</mark>.</p>
          <div className="mt-5 flex flex-col gap-3">
            <div className="bg-[#DCE9DF] rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-[#1F4030]"><Fort>« 12 clients »</Fort> figure avec la même unité dans vos informations : non signalé.</div>
            <div className="bg-[#FCE6D6] rounded-2xl px-4 py-3 text-[15px] leading-relaxed text-[#6E2E0E]"><Fort>« 37 % »</Fort> ne figure dans aucune de vos informations : signalé. Vous l&apos;avez peut-être vécu : à vous de le confirmer ou de le retirer.</div>
          </div>
        </div>

        <h2 className={`${H2} mt-14 mb-4`}>{liaisons("Ce que le contrôle fait")}</h2>
        <Liste className="text-[17px] leading-[1.65] text-[#4A3A50]" items={[
          <><Fort>Il compare</Fort> les nombres du post à toutes les informations données à la rédaction : thématique, profil, sources, consignes.</>,
          <><Fort>Il tient compte de l&apos;unité :</Fort> « 11 collaborateurs » ne valide pas « 11 mois ». « % » et « pour cent » sont équivalents, comme « an » et « ans », « € » et « euros ».</>,
          <><Fort>Il ignore ce qui n&apos;est pas un chiffre avancé comme un fait :</Fort> une année seule, un nombre à un chiffre sans unité, les liens et les hashtags. Il en signale {MOTS.maxChiffres} au plus.</>,
        ]} />

        <div className="mt-10 bg-[#FCE6D6] rounded-[28px] p-6 sm:p-9">
          <h2 className="font-display text-[26px] mb-4">{liaisons("Ce qu'il ne fait pas")}</h2>
          <Liste className="text-base leading-relaxed text-[#6E2E0E]" items={[
            "Il ne dit pas qu'un nombre est faux : un nombre signalé peut être vrai, vous l'avez peut-être vécu.",
            "Il ne garantit pas qu'un nombre non signalé est exact : il peut venir d'une source qui se trompe, ou être déformé.",
            "Il ne contrôle ni les noms propres, ni les citations, ni les études citées.",
            "Il ne remplace pas votre relecture.",
          ]} />
        </div>

        <h2 className={`${H2} mt-14 mb-4`}>{liaisons("Ce qu'une empreinte prouve, et ne prouve pas")}</h2>
        <p className="text-[17px] leading-[1.7] text-[#4A3A50] mb-5">
          Dans nos tests publics, nous figeons un texte et publions son empreinte numérique (SHA-256) avec la date. <Fort>Le produit n&apos;émet pas d&apos;empreintes : elles servent uniquement à nos tests.</Fort> Voici ce qu&apos;elles disent.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="bg-[#DCE9DF] rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-[#1F4030] mb-3">Elle prouve</h3>
            <Liste className="text-[15px] leading-relaxed text-[#2F4A3C]" items={["Que le texte n'a pas changé depuis la date de publication de l'empreinte.", "Que nous n'avons pas pu l'ajuster après avoir vu les résultats."]} />
          </div>
          <div className="bg-[#F6E3E0] rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-[#7A2342] mb-3">Elle ne prouve pas</h3>
            <Liste className="text-[15px] leading-relaxed text-[#4A3A50]" items={["Que le contenu est exact.", "Que le protocole est bien conçu, ni que le résultat se généralise."]} />
          </div>
        </div>
        {preuvesOuvertes() && <p className="mt-6"><Link href="/preuves" className="font-semibold text-[#9E3157] hover:text-[#7A2342]">Voir les empreintes publiées sur la page Preuves →</Link></p>}
      </div>
    </Shell>
  );
}
