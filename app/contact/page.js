import { Mail, Clock, MessagesSquare } from "lucide-react";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact — LinkeePost",
  description:
    "Une question sur LinkeePost, une demande de démo ou un besoin spécifique ? Écrivez-nous, nous répondons rapidement.",
};

const POINTS = [
  { icon: MessagesSquare, title: "Avant-vente & démo", text: "Vous hésitez sur l'offre adaptée ou vous voulez une démo ? On vous guide." },
  { icon: Mail, title: "Support", text: "Un souci technique, une question sur votre compte ? On vous débloque." },
  { icon: Clock, title: "Réponse rapide", text: "Nous répondons en général sous 24 h ouvrées, à l'adresse que vous indiquez." },
];

export default function ContactPage() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 text-[#1b2a4a] min-h-screen flex flex-col">
      <div className="pointer-events-none absolute -top-32 -left-32 w-[26rem] h-[26rem] rounded-full bg-rose-200/40 blur-3xl" />
      <div className="pointer-events-none absolute top-40 -right-24 w-[22rem] h-[22rem] rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative flex flex-col flex-1">
        <SiteHeader />
        <main className="max-w-6xl mx-auto px-6 py-14 flex-1 w-full grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Gauche — communication */}
          <div>
            <p className="text-sm font-semibold text-[#ff5a5f]">Contact</p>
            <h1 className="text-4xl md:text-5xl font-extrabold mt-2 leading-tight">
              Parlons de votre présence <span className="text-[#ff5a5f]">LinkedIn</span>
            </h1>
            <p className="text-lg text-[#5a6b85] mt-4 leading-relaxed">
              Une question sur les offres, une demande de démo, un besoin particulier ou un souci technique ?
              Écrivez-nous : une vraie personne vous lit et vous répond.
            </p>
            <p className="text-[#5a6b85] mt-3 leading-relaxed">
              Pas besoin d'attendre pour tester LinkeePost — l'essai est gratuit pendant 14 jours, sans carte
              bancaire. Le formulaire est là pour tout le reste.
            </p>

            <ul className="mt-8 space-y-4">
              {POINTS.map((p) => (
                <li key={p.title} className="flex items-start gap-3">
                  <span className="bg-[#fff1f1] text-[#ff5a5f] p-2.5 rounded-2xl shrink-0">
                    <p.icon size={20} />
                  </span>
                  <div>
                    <p className="font-bold">{p.title}</p>
                    <p className="text-sm text-[#5a6b85] leading-relaxed">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-8 inline-flex items-center gap-2 text-sm text-[#5a6b85]">
              <Mail size={15} className="text-[#ff5a5f]" /> ou directement :{" "}
              <a href="mailto:contact@postgenius.network" className="font-semibold text-[#ff5a5f] hover:underline">
                contact@postgenius.network
              </a>
            </p>
          </div>

          {/* Droite — formulaire */}
          <div className="bg-white rounded-3xl border border-white shadow-xl shadow-rose-100/40 p-7 w-full lg:justify-self-end lg:max-w-md">
            <h2 className="text-xl font-extrabold">Envoyez-nous un message</h2>
            <p className="text-sm text-[#5a6b85] mt-1 mb-5">On vous répond à l'adresse indiquée.</p>
            <ContactForm />
          </div>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
