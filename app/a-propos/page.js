import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import { BRAND_NAME } from "@/lib/brand";
import { CONTACT_EMAIL } from "@/lib/contact";
import { A_PROPOS, champsManquants, portraitPresent } from "@/lib/aPropos";
import { aProposOuvert } from "@/lib/siteInstitutionnel";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { produitOuvert } from "@/lib/siteProduit";
import { E4 } from "@/lib/e4Page";
import { liaisons, liaisonsEm } from "@/lib/typo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `À propos — ${BRAND_NAME}`,
  description: "Un outil qui préfère montrer ses limites plutôt que les cacher : nos règles, qui est derrière, les questions qu'on nous pose vraiment.",
  alternates: { canonical: "/a-propos" },
};

const REGLES = [
  ["Borner ce que nous disons", "« Dans notre test » plutôt que « toujours ». Chaque résultat dit ce qu'il ne permet pas de conclure.", "#F6E3E0", "#7A2342", "#4A3A50"],
  ["Publier nos preuves", "Protocole figé avant la génération, empreinte datée, résultats et textes en accès public. Chaque chiffre renvoie à une source.", "#DCE9DF", "#2B5340", "#2F4A3C"],
  ["Ne rien promettre sur la portée", "Ni vues, ni réactions, ni conformité à LinkedIn. Nos contrôles sont des indicateurs, pas des prévisions.", "#FCE6D6", "#8A3B12", "#6E2E0E"],
  ["Vous gardez la main", "Vous relisez et vous validez. Les assistants IA préparent des brouillons, ils ne publient rien.", "#F6E3E0", "#7A2342", "#4A3A50"],
];
const Kick = ({ children }) => <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F] mb-3">{children}</p>;

export default function AProposPage() {
  const d = A_PROPOS;
  if (!aProposOuvert(process.env, champsManquants(d))) notFound();
  const titre = liaisonsEm("Un outil qui préfère", "montrer ses limites plutôt que les cacher.");
  const B = E4.conditions.find((c) => c.code === "B");
  const faq = [
    ["Un post généré par IA peut-il contenir un chiffre inventé ?",
      <>Cela peut arriver. Dans notre test, {B.textes} posts sur 10 d&apos;un modèle généraliste, même avec les faits fournis, contenaient au moins un élément inventé ou déformé{preuvesOuvertes() && <> (<Link href="/preuves/test-e4" className="font-semibold text-[#9E3157] underline">le test et ses limites</Link>)</>}. C&apos;est pourquoi les chiffres absents de vos documents sont signalés avant publication. Ce contrôle est indicatif : il ne prouve pas qu&apos;un chiffre est juste, relisez toujours.</>],
    [`${BRAND_NAME} me fera-t-il gagner en portée ?`, "Nous ne le promettons pas. Le contrôle de forme note la mise en forme d'un post à règles fixes ; ce n'est pas une prévision de vues ou de réactions."],
    ["Mes données et mes enregistrements, que deviennent-ils ?",
      <>L&apos;enregistrement d&apos;une dictée n&apos;est pas conservé, seul le texte que vous gardez l&apos;est. Le détail, y compris ce que nous n&apos;avons pas comme certification, est sur la page <Link href="/securite" className="font-semibold text-[#9E3157] underline">Sécurité et confidentialité</Link>.</>],
    ["Quelque chose ne va pas dans un résultat que vous publiez ?", `Écrivez-nous.${d.engagementCorrection?.trim() ? ` ${d.engagementCorrection.trim()}` : ""}`],
  ];
  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <section className="flex flex-wrap gap-12 items-center pb-12">
          <div className="flex-[1_1_520px] min-w-0 entete-centre">
            <Kick>À propos</Kick>
            <h1 className="font-display text-[38px] sm:text-[54px] leading-[1.06] tracking-[-0.02em]">{titre[0]}<em className="text-[#C2456F]">{titre[1]}</em></h1>
            <p className="text-[19px] leading-relaxed text-[#4A3A50] mt-6 max-w-[560px]">Nous avons commencé par une question simple : quand une IA écrit un post, y glisse-t-elle des chiffres que personne ne lui a donnés ? Nous l&apos;avons mesuré, et c&apos;est de là que vient le produit.</p>
          </div>
        </section>

        <section className="flex flex-wrap gap-12 py-12 border-t border-[#EFE4E0]">
          <div className="flex-[1_1_320px] min-w-0"><Kick>Pourquoi</Kick><h2 className="font-display text-[30px] sm:text-[38px] leading-[1.1] tracking-[-0.015em]">{liaisons("Né d'un constat, pas d'une promesse.")}</h2></div>
          <div className="flex-[2_1_480px] min-w-0 text-[17px] leading-[1.75] text-[#4A3A50] flex flex-col gap-4">
            <p>{d.pourquoi}</p>
            <p>Notre parti pris : le produit signale les chiffres absents de vos documents avant publication, et nous publions ce que nous mesurons, avec ses limites.{produitOuvert() && <> <Link href="/produit/methode" className="font-semibold text-[#9E3157] underline">Comment l&apos;outil fonctionne, étape par étape</Link>.</>}</p>
          </div>
        </section>

        <section className="py-12">
          <Kick>Nos règles</Kick>
          <h2 className="font-display text-[30px] sm:text-[40px] tracking-[-0.015em] mb-9 max-w-[700px]">{liaisons("Quatre règles que nous nous imposons.")}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REGLES.map(([nom, texte, bg, num, enc], i) => (
              <div key={nom} className="rounded-[28px] p-7" style={{ background: bg }}>
                <div className="w-11 h-11 rounded-full bg-white font-display text-[22px] flex items-center justify-center" style={{ color: num }}>{i + 1}</div>
                <h3 className="text-lg font-semibold mt-4 mb-2">{liaisons(nom)}</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: enc }}>{texte}</p>
              </div>
            ))}
          </div>
        </section>

        {portraitPresent(d) && (
        <section className="py-6">
            <div className="bg-white border border-[#EFE4E0] rounded-[32px] p-7 sm:p-10 flex flex-wrap gap-10 items-center">
              <div className="flex-none w-[150px] h-[190px] rounded-t-[75px] rounded-b-[14px] bg-[#F6E3E0] text-[#7A2342] font-display text-5xl flex items-center justify-center" aria-hidden="true">{d.portrait.prenomNom.trim().split(/\s+/).map((m) => m[0]).slice(0, 2).join("").toUpperCase()}</div>
              <div className="flex-[1_1_360px] min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6B5A70] mb-1.5">Qui est derrière</p>
                <h2 className="font-display text-[28px] font-medium mb-1">{d.portrait.prenomNom}</h2>
                <p className="text-[15px] text-[#6B5A70] mb-3.5">{d.portrait.role}</p>
                <p className="text-base leading-[1.7] text-[#4A3A50]">{d.portrait.presentation}</p>
              </div>
            </div>
          </section>
        )}

        <section className="py-12 max-w-[820px]">
          <Kick>Questions fréquentes</Kick>
          <h2 className="font-display text-[30px] sm:text-[38px] tracking-[-0.015em] mb-7">{liaisons("Les questions qu'on nous pose vraiment.")}</h2>
          <div className="flex flex-col gap-3">
            {faq.map(([q, r], i) => (
              <details key={q} open={i === 0} className="bg-white border border-[#EFE4E0] rounded-[20px] px-6 py-5">
                <summary className="font-semibold text-[17px] leading-snug cursor-pointer">{q}</summary>
                <p className="mt-3 text-base leading-[1.7] text-[#4A3A50]">{r}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="pt-6">
          <div className="bg-[#F6E3E0] rounded-[32px] px-6 sm:px-12 py-10 flex flex-wrap gap-8 items-center justify-between">
            <div className="flex-[1_1_400px] min-w-0">
              <h2 className="font-display text-[26px] mb-2">Éditeur du site</h2>
              <p className="text-[15px] leading-[1.7] text-[#4A3A50]">{d.editeur.raisonSociale}, {d.editeur.formeJuridique}, {d.editeur.villeSiege}. Contact : {CONTACT_EMAIL}. Détails complets dans les <Link href="/mentions-legales" className="font-semibold text-[#9E3157] underline">mentions légales</Link>.</p>
            </div>
            <Link href="/contact" className="bg-[#C2456F] hover:bg-[#9E3157] text-white font-semibold px-6 py-3 rounded-full">Nous écrire</Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
