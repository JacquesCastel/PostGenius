import { Mail, Clock, MessagesSquare } from "lucide-react";
import Shell from "@/components/v2/Shell";
import ContactForm from "./ContactForm";
import { CONTACT_EMAIL } from "@/lib/contact";
import { pick } from "@/lib/access";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = {
  title: `Contact — ${BRAND_NAME}`,
  description:
    `Une question sur ${BRAND_NAME}, une demande de démo ou un besoin spécifique ? Écrivez-nous, nous répondons rapidement.`,
  alternates: { canonical: "/contact" },
};

const POINTS = [
  { icon: MessagesSquare, bg: "#F6E3E0", fg: "#7A2342", title: "Avant-vente & démo", text: "Vous hésitez sur l'offre adaptée ou vous voulez une démo ? On vous guide." },
  { icon: Mail, bg: "#DCE9DF", fg: "#2B5340", title: "Support", text: "Un souci technique, une question sur votre compte ? On vous débloque." },
  { icon: Clock, bg: "#FCE6D6", fg: "#8A3B12", title: "Réponse rapide", text: "Nous répondons en général sous 24 h ouvrées, à l'adresse que vous indiquez." },
];

// Nouveau style (v2). Le texte est celui de la page précédente ; seule la mise en forme change.
export default function ContactPage() {
  return (
    <Shell>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-8 pt-8 pb-24 flex flex-wrap gap-12 lg:gap-16 items-start">
        <div className="flex-[1_1_420px] min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#C2456F]">Contact</p>
          <h1 className="font-display text-[40px] sm:text-[50px] leading-[1.08] tracking-[-0.02em] mt-3">
            Parlons de votre présence <em className="text-[#C2456F]">LinkedIn.</em>
          </h1>
          <p className="text-lg text-[#4A3A50] mt-5 leading-relaxed">
            Une question sur les offres, une demande de démo, un besoin particulier ou un souci technique ?
            Écrivez-nous : une vraie personne vous lit et vous répond.
          </p>
          <p className="text-base text-[#4A3A50] mt-4 leading-relaxed">
            {pick(`${BRAND_NAME} est en bêta fermée : pour y participer, demandez une invitation sur la page de la bêta. Le formulaire est là pour tout le reste.`, `Pas besoin d'attendre pour tester ${BRAND_NAME} — l'essai est gratuit pendant 14 jours, sans carte bancaire. Le formulaire est là pour tout le reste.`)}
          </p>

          <ul className="mt-9 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex items-start gap-4">
                <span className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ background: p.bg, color: p.fg }}>
                  <p.icon size={20} />
                </span>
                <div>
                  <p className="font-semibold text-[17px]">{p.title}</p>
                  <p className="text-[15px] text-[#4A3A50] leading-relaxed mt-1">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-8 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-[#4A3A50]">
            <Mail size={16} className="text-[#C2456F]" /> ou directement :{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-[#9E3157] hover:underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>

        <div className="flex-[1_1_380px] min-w-0 max-w-[460px] bg-white rounded-[28px] border border-[#EFE4E0] p-7 sm:p-8 shadow-[0_18px_40px_rgba(46,31,51,0.08)]">
          <h2 className="text-[22px] font-semibold">Envoyez-nous un message</h2>
          <p className="text-sm text-[#6B5A70] mt-1.5 mb-6">On vous répond à l&apos;adresse indiquée.</p>
          <ContactForm variant="v2" />
        </div>
      </div>
    </Shell>
  );
}
