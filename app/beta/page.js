import { Gift, Handshake, ListChecks } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContactForm from "@/app/contact/ContactForm";
import { CONTACT_EMAIL } from "@/lib/contact";
import { INVITE_ACCESS_DAYS } from "@/lib/invites";

// Page de la bêta fermée : ce que les testeurs reçoivent, ce qu'on attend d'eux, comment demander une invitation.
// Volontairement hors du plan du site et du pied de page tant que la bêta n'est pas annoncée : on y arrive par un lien.
export const metadata = {
  title: "Bêta fermée — LinkeePost",
  description: "LinkeePost ouvre l'accès à un petit groupe de testeurs. Demandez une invitation.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/beta" },
};

const BLOCS = [
  {
    icon: Gift,
    title: "Ce que vous recevez",
    items: [
      `Un accès complet à l'offre Pro pendant ${INVITE_ACCESS_DAYS} jours, sans carte bancaire ni engagement.`,
      "Un interlocuteur direct : vos questions arrivent à la personne qui construit l'outil.",
      "Une influence réelle : ce que vous signalez est corrigé en priorité.",
    ],
  },
  {
    icon: Handshake,
    title: "Ce que nous attendons de vous",
    items: [
      "Utiliser LinkeePost sur de vrais posts, pas seulement pour regarder.",
      "Un court retour chaque semaine : une dizaine de minutes, à l'écrit ou au téléphone.",
      "Nous dire franchement ce qui bloque, ce qui manque et ce qui ne sert à rien.",
    ],
  },
  {
    icon: ListChecks,
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
    <div className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 text-[#1b2a4a] min-h-screen flex flex-col">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[26rem] h-[26rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="relative flex flex-col flex-1">
        <SiteHeader />
        <main className="max-w-5xl mx-auto px-6 py-14 flex-1 w-full">
          <p className="text-sm font-semibold text-[#ff5a5f]">Bêta fermée</p>
          <h1 className="text-4xl md:text-5xl font-extrabold mt-2 leading-tight">
            Construisons <span className="text-[#ff5a5f]">LinkeePost</span> ensemble
          </h1>
          <p className="text-lg text-[#5a6b85] mt-4 leading-relaxed max-w-3xl">
            LinkeePost prépare, programme et mesure vos posts LinkedIn. Avant de l'ouvrir à tous, nous l'ouvrons à un petit groupe de testeurs :
            dirigeants et indépendants, consultants, petites agences. Les places sont limitées.
          </p>

          <div className="grid md:grid-cols-3 gap-5 mt-10">
            {BLOCS.map((b) => (
              <section key={b.title} className="bg-white rounded-3xl border border-white shadow-lg shadow-rose-100/40 p-6">
                <span className="inline-flex bg-[#fff1f1] text-[#ff5a5f] p-2.5 rounded-2xl"><b.icon size={20} /></span>
                <h2 className="font-extrabold text-lg mt-3">{b.title}</h2>
                <ul className="mt-3 space-y-2.5 text-sm text-[#5a6b85] leading-relaxed">
                  {b.items.map((t) => <li key={t} className="flex gap-2"><span className="text-[#ff5a5f]">•</span><span>{t}</span></li>)}
                </ul>
              </section>
            ))}
          </div>

          <section id="invitation" className="mt-12 grid lg:grid-cols-2 gap-10 items-start">
            <div>
              <h2 className="text-2xl font-extrabold">Demander une invitation</h2>
              <p className="text-[#5a6b85] mt-3 leading-relaxed">
                Dites-nous qui vous êtes et ce que vous publiez aujourd'hui sur LinkedIn. Nous répondons sous quelques jours.
              </p>
              <p className="text-sm text-[#5a6b85] mt-4">
                Vous avez déjà un lien d'invitation ? Ouvrez-le depuis votre e-mail. Une question ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#ff5a5f] hover:underline">{CONTACT_EMAIL}</a>
              </p>
            </div>
            <div className="bg-white rounded-3xl border border-white shadow-xl shadow-rose-100/40 p-6" data-testid="beta-form">
              <ContactForm defaultSubject="Demande d'invitation à la bêta" messagePlaceholder="Votre activité, votre profil LinkedIn, ce que vous aimeriez que LinkeePost fasse pour vous" submitLabel="Demander une invitation" />
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
