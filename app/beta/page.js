import { Gift, Handshake, ListChecks } from "lucide-react";
import Shell from "@/components/v2/Shell";
import ContactForm from "@/app/contact/ContactForm";
import { CONTACT_EMAIL } from "@/lib/contact";
import { INVITE_ACCESS_DAYS } from "@/lib/invites";
import { BRAND_NAME } from "@/lib/brand";

// Page de la bêta fermée : ce que les testeurs reçoivent, ce qu'on attend d'eux, comment demander une invitation.
// Volontairement hors du plan du site et du pied de page tant que la bêta n'est pas annoncée : on y arrive par un lien.
// Nouveau style (v2) : le texte est celui de la page précédente ; seule la mise en forme change.
export const metadata = {
  title: `Bêta fermée — ${BRAND_NAME}`,
  description: `${BRAND_NAME} ouvre l'accès à un petit groupe de testeurs. Demandez une invitation.`,
  robots: { index: false, follow: false },
  alternates: { canonical: "/beta" },
};

const BLOCS = [
  {
    icon: Gift,
    bg: "#F6E3E0",
    fg: "#7A2342",
    title: "Ce que vous recevez",
    items: [
      `Un accès complet à l'offre Pro pendant ${INVITE_ACCESS_DAYS} jours, sans carte bancaire ni engagement.`,
      "Un interlocuteur direct : vos questions arrivent à la personne qui construit l'outil.",
      "Une influence réelle : ce que vous signalez est corrigé en priorité.",
    ],
  },
  {
    icon: Handshake,
    bg: "#DCE9DF",
    fg: "#2B5340",
    title: "Ce que nous attendons de vous",
    items: [
      `Utiliser ${BRAND_NAME} sur de vrais posts, pas seulement pour regarder.`,
      "Un court retour chaque semaine : une dizaine de minutes, à l'écrit ou au téléphone.",
      "Nous dire franchement ce qui bloque, ce qui manque et ce qui ne sert à rien.",
    ],
  },
  {
    icon: ListChecks,
    bg: "#FCE6D6",
    fg: "#8A3B12",
    title: "Comment ça se passe",
    items: [
      "Vous demandez une invitation avec le formulaire ci-dessous.",
      "Si votre profil correspond, vous recevez un lien par e-mail.",
      "Vous créez votre compte, vous connectez LinkedIn (la connexion passe par l'API officielle, jamais par votre mot de passe), puis vous écrivez votre premier post.",
    ],
  },
];

export default function BetaPage() {
  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-8 pb-24">
        <span className="inline-block text-xs font-semibold uppercase tracking-[0.06em] bg-[#F6E3E0] text-[#7A2342] px-3.5 py-1.5 rounded-full">Bêta fermée</span>
        <h1 className="font-display text-[42px] sm:text-[54px] leading-[1.06] tracking-[-0.02em] mt-5 max-w-3xl">
          Construisons {BRAND_NAME} <em className="text-[#C2456F]">ensemble.</em>
        </h1>
        <p className="text-[19px] text-[#4A3A50] mt-6 leading-[1.65] max-w-3xl">
          {BRAND_NAME} prépare, programme et mesure vos posts LinkedIn. Avant de l&apos;ouvrir à tous, nous l&apos;ouvrons à un petit groupe de testeurs :
          dirigeants et indépendants, consultants, petites agences. Les places sont limitées.
        </p>

        <div className="grid md:grid-cols-3 gap-5 mt-12">
          {BLOCS.map((b) => (
            <section key={b.title} className="bg-white rounded-[28px] border border-[#EFE4E0] p-7">
              <span className="inline-flex w-11 h-11 rounded-full items-center justify-center" style={{ background: b.bg, color: b.fg }}><b.icon size={20} /></span>
              <h2 className="font-semibold text-xl mt-4">{b.title}</h2>
              <ul className="mt-3 space-y-2.5 text-[15px] text-[#4A3A50] leading-relaxed list-disc pl-5">
                {b.items.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </section>
          ))}
        </div>

        <section id="invitation" className="mt-16 grid lg:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="font-display text-4xl tracking-[-0.015em]">Demander une invitation</h2>
            <p className="text-[17px] text-[#4A3A50] mt-3 leading-[1.7]">
              Dites-nous qui vous êtes et ce que vous publiez aujourd&apos;hui sur LinkedIn. Nous répondons sous quelques jours.
            </p>
            <p className="text-sm text-[#6B5A70] mt-5 leading-relaxed">
              Vous avez déjà un lien d&apos;invitation ? Ouvrez-le depuis votre e-mail. Une question ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#9E3157] hover:underline">{CONTACT_EMAIL}</a>
            </p>
          </div>
          <div className="bg-white rounded-[28px] border border-[#EFE4E0] p-7 sm:p-8 shadow-[0_18px_40px_rgba(46,31,51,0.08)]" data-testid="beta-form">
            <ContactForm variant="v2" defaultSubject="Demande d'invitation à la bêta" messagePlaceholder="Votre activité, votre profil LinkedIn, ce que vous aimeriez que l'outil fasse pour vous" submitLabel="Demander une invitation" />
          </div>
        </section>
      </div>
    </Shell>
  );
}
