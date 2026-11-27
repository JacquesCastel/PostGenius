import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/v2/Shell";
import SousNavProduit from "@/components/v2/SousNavProduit";
import { BRAND_NAME } from "@/lib/brand";
import { produitOuvert } from "@/lib/siteProduit";
import { preuvesOuvertes } from "@/lib/sitePreuves";
import { liaisons, liaisonsEm } from "@/lib/typo";
import * as C from "@/lib/produitMethode";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Comment l'outil fonctionne — ${BRAND_NAME}`,
  description: "Pour chaque étape, ce que fait l'IA, ce que vérifie un code que l'on peut lire, et ce que vous décidez.",
  alternates: { canonical: "/produit/methode" },
};

const H2 = "font-display text-[30px] sm:text-[36px] leading-[1.12] tracking-[-0.015em]";
const KICK = "text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]";
const ACTEUR = { IA: ["#F6E3E0", "#7A2342"], Code: ["#DCE9DF", "#2B5340"], Vous: ["#FCE6D6", "#8A3B12"] };

// « **gras** » dans les textes de contenu
const gras = (t) => String(t).split("**").map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p));
const Acteur = ({ nom }) => <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full mr-1.5" style={{ background: ACTEUR[nom][0], color: ACTEUR[nom][1] }}>{nom}</span>;
const Test = () => <span className="inline-block text-xs font-semibold bg-[#FCF8F5] border border-[#E8DCD8] text-[#6B5A70] px-3 py-1 rounded-full">{C.ETAT_TEST}</span>;
const Carte = ({ children, className = "" }) => <div className={`bg-white border border-[#EFE4E0] rounded-3xl p-6 ${className}`}>{children}</div>;
const P = ({ children, className = "" }) => <p className={`text-[16px] leading-relaxed text-[#4A3A50] ${className}`}>{children}</p>;
const Lien = ({ href, children }) => <Link href={href} className="font-semibold text-[#9E3157] hover:text-[#7A2342] underline">{children}</Link>;

export default function MethodePage() {
  if (!produitOuvert()) notFound();
  const titre = liaisonsEm("Qui fait quoi,", "à chaque étape.");
  return (
    <Shell>
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <SousNavProduit courante="/produit/methode" />
        <h1 className="font-display text-[38px] sm:text-[54px] leading-[1.06] tracking-[-0.02em]">{titre[0]}<em className="text-[#C2456F]">{titre[1]}</em></h1>
        <p className="text-[19px] sm:text-xl leading-relaxed text-[#4A3A50] mt-6">De vos sources à un post relu. Pour chaque étape, nous disons ce que fait l&apos;IA, ce que vérifie un code que l&apos;on peut lire, et ce que vous décidez.</p>
        <div className="mt-6 flex flex-wrap gap-2.5 text-[13px] font-semibold">
          <span className="px-3.5 py-1.5 rounded-full bg-[#F6E3E0] text-[#7A2342]">IA : propose, rédige</span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#DCE9DF] text-[#2B5340]">Code : règles fixes, toujours le même résultat</span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#FCE6D6] text-[#8A3B12]">Vous : décidez</span>
        </div>

        <section className="mt-14">
          <p className={KICK}>1 · Votre matière</p>
          <h2 className={`${H2} mt-2 mb-3`}>{liaisons("Une base de connaissances qui vous appartient")}</h2>
          <P className="mb-5">Vous déposez des documents, des liens, des notes. C&apos;est ce qui sert de matière aux posts. Voici ce qui se passe ensuite.</P>
          <div className="grid gap-4 md:grid-cols-3">
            {C.MATIERE.map(([qui, texte]) => <Carte key={qui}><Acteur nom={qui} /><P className="mt-3">{texte}</P></Carte>)}
          </div>
          <P className="mt-5">Pour un nouveau post, les sources utiles au sujet sont choisies par le sens et par les mots. Les sources utilisées sont montrées à côté du post.</P>
        </section>

        <section className="mt-14">
          <p className={KICK}>2 · L&apos;écriture</p>
          <h2 className={`${H2} mt-2 mb-3`}>{liaisons("Ce que reçoit l'IA pour écrire")}</h2>
          <P className="mb-5">Votre profil et vos consignes de style, vos sources, vos remarques, la langue, l&apos;humeur, le public et l&apos;angle du post. Et des règles écrites noir sur blanc.</P>
          <Carte>
            <h3 className="font-semibold text-lg mb-3">Les règles données à l&apos;IA</h3>
            <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[16px] leading-relaxed text-[#4A3A50]">{C.REGLES_IA.map((r) => <li key={r}>{r}</li>)}</ul>
          </Carte>
          <div className="mt-4 bg-[#FCE6D6] rounded-2xl px-5 py-4 text-[15px] leading-relaxed text-[#6E2E0E]"><strong>Ce sont des consignes, pas des garanties.</strong> Une IA peut ne pas les suivre : c&apos;est pourquoi des contrôles existent après l&apos;écriture. Les sources ne sont pas citées dans le texte du post.</div>
        </section>

        <section className="mt-14">
          <p className={KICK}>3 · Les contrôles</p>
          <h2 className={`${H2} mt-2 mb-3`}>{liaisons("Un contrôle à chaque étape")}</h2>
          <P className="mb-5">Avant, pendant, après. Aucun ne s&apos;exécute à votre place : chacun vous montre quelque chose, et vous choisissez.</P>
          <div className="grid gap-4 md:grid-cols-3">
            {C.CONTROLES_ETAPES.map((c) => (
              <Carte key={c.titre}>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#6B5A70]">{c.quand}</p>
                <h3 className="font-display text-[20px] leading-[1.2] mt-2 mb-2.5">{liaisons(c.titre)}</h3>
                <P>{c.texte} {c.fort && <strong>{c.fort}</strong>}{c.suite}{c.lien && <> <Lien href={c.lien[0]}>{c.lien[1]}</Lien>.</>}</P>
                <div className="mt-3">{c.acteurs.map((a) => <Acteur key={a} nom={a} />)}</div>
                {c.test && <p className="mt-3"><Test /></p>}
              </Carte>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {C.CONTROLES_APRES.map((c) => (
              <Carte key={c.titre}>
                <h3 className="font-display text-[20px] leading-[1.2] mb-2.5">{liaisons(c.titre)}</h3>
                <P>{gras(c.texte)}{c.lien && <> <Lien href={c.lien[0]}>{c.lien[1]}</Lien>.</>}{c.suite}</P>
                <div className="mt-3">{c.acteurs.map((a) => <Acteur key={a} nom={a} />)}</div>
                {c.test && <p className="mt-3"><Test /></p>}
              </Carte>
            ))}
          </div>
          <Carte className="mt-4">
            <h3 className="font-display text-[22px] leading-[1.2] mb-2.5">{liaisons("Vos consignes sont contrôlées sur chaque post")}</h3>
            <P>{gras(C.CONSIGNES_TEXTE)}</P>
            <div className="mt-4 flex flex-wrap gap-2">{C.CONSIGNES_POINTS.map((p) => <span key={p} className="text-[13px] font-semibold bg-[#FCF8F5] border border-[#EFE4E0] text-[#4A3A50] px-3 py-1.5 rounded-full">{p}</span>)}</div>
            <P className="mt-4">{C.CONSIGNES_LIMITE}</P>
          </Carte>
        </section>

        <section className="mt-14">
          <p className={KICK}>4 · Quand il y a un doute</p>
          <h2 className={`${H2} mt-2 mb-3`}>Vous tranchez.</h2>
          <P className="mb-5">Le texte n&apos;est jamais modifié en silence. Chaque doute vous est montré, avec le passage concerné, et vous avez les gestes suivants.</P>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {C.GESTES.map(([nom, texte]) => <div key={nom} className="bg-[#FCE6D6] rounded-2xl p-5"><strong className="block text-[16px] text-[#6E2E0E]">{nom}</strong><p className="text-[14px] leading-relaxed text-[#6E2E0E] mt-1">{texte}</p></div>)}
          </div>
          <P className="mt-5"><strong>Une exception, à connaître :</strong> si vous activez le pilote automatique, la meilleure recommandation est programmée sans passer par une validation. Il est désactivé par défaut.</P>
          <P className="mt-3">Les gestes Confirmer, Modifier, Reformuler et Retirer sont ceux de la relecture indépendante, aujourd&apos;hui <strong>{C.ETAT_TEST.toLowerCase()}</strong>.</P>
        </section>

        <section className="mt-14">
          <p className={KICK}>5 · L&apos;accompagnement</p>
          <h2 className={`${H2} mt-2 mb-5`}>{liaisons("Savoir quoi publier, et quand")}</h2>
          <div className="grid gap-4 md:grid-cols-3">{C.ACCOMPAGNEMENT.map(([t, x]) => <Carte key={t}><h3 className="font-display text-[20px] mb-2">{liaisons(t)}</h3><P>{x}</P></Carte>)}</div>
        </section>

        <section className="mt-14">
          <p className={KICK}>6 · La gestion éditoriale</p>
          <h2 className={`${H2} mt-2 mb-5`}>{liaisons("Une ligne, un rythme, des campagnes")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {C.GESTION.map(([t, x, offre]) => (
              <Carte key={t}><h3 className="font-display text-[20px] mb-2">{liaisons(t, { fin: !offre })}{offre && <span className="inline-block ml-2 align-middle text-[11px] font-semibold bg-[#F6E3E0] text-[#7A2342] px-2.5 py-0.5 rounded-full font-body-v2">{offre}</span>}</h3><P>{x}</P></Carte>
            ))}
          </div>
        </section>

        <section className="mt-14 bg-[#F6E3E0] rounded-[28px] p-7 sm:p-9">
          <h2 className={`${H2} mb-4`}>{liaisons("Ce que l'outil ne fait pas")}</h2>
          <ul className="list-disc pl-5 flex flex-col gap-2.5 text-[16px] leading-relaxed text-[#4A3A50]">{C.LIMITES.map((l) => <li key={l}>{l}</li>)}</ul>
          {preuvesOuvertes() && <P className="mt-5">Ce que nous avons mesuré, et comment le vérifier : <Lien href="/preuves">la page Preuves</Lien>.</P>}
        </section>
      </div>
    </Shell>
  );
}
