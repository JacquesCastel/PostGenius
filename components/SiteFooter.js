import Link from "next/link";
import { Linkedin } from "lucide-react";
import ChatWidget from "./ChatWidget";

// Pied de page public partagé (landing, blog, contact, pages légales)
export default function SiteFooter() {
  return (
    <>
    <footer className="mt-10 border-t border-rose-100/70 pt-10 pb-8">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-[#7c8aa3]">
          <div className="flex items-center gap-2">
            <div className="bg-[#ff5a5f] text-white p-1.5 rounded-lg">
              <Linkedin size={14} />
            </div>
            <span className="font-bold text-[#1b2a4a]">PostGenius</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-5">
            <Link href="/fonctionnalites" className="hover:text-[#ff5a5f]">Fonctionnalités</Link>
            <Link href="/comment-ca-marche" className="hover:text-[#ff5a5f]">Comment ça marche</Link>
            <Link href="/tarifs" className="hover:text-[#ff5a5f]">Tarifs</Link>
            <Link href="/blog" className="hover:text-[#ff5a5f]">Blog</Link>
            <Link href="/contact" className="hover:text-[#ff5a5f]">Contact</Link>
            <Link href="/mentions-legales" className="hover:text-[#ff5a5f]">Mentions légales</Link>
            <Link href="/cgu" className="hover:text-[#ff5a5f]">CGU</Link>
            <Link href="/confidentialite" className="hover:text-[#ff5a5f]">Confidentialité</Link>
          </nav>
        </div>

        {/* Contenu SEO (petit) */}
        <p className="text-[11px] leading-relaxed text-gray-400 mt-8 max-w-4xl mx-auto text-center">
          <strong className="font-semibold text-gray-500">PostGenius</strong> est l'outil tout-en-un pour gérer
          votre présence sur <Link href="/fonctionnalites" className="hover:text-[#ff5a5f] underline">LinkedIn</Link> :
          génération de posts par intelligence artificielle, création de carrousels et de scripts vidéo, campagnes
          éditoriales guidées par l'IA, veille de votre secteur et inspirations, programmation et publication
          automatique sur votre profil personnel comme sur vos pages entreprise, génération d'images, et suivi des
          statistiques (impressions, vues, taux d'engagement). Conçu pour les indépendants, consultants, dirigeants,
          créateurs de contenu et équipes marketing qui veulent publier régulièrement sur LinkedIn — posts, articles
          et campagnes — sans y passer leurs soirées. Découvrez nos
          {" "}<Link href="/tarifs" className="hover:text-[#ff5a5f] underline">offres et tarifs</Link>,
          {" "}le <Link href="/comment-ca-marche" className="hover:text-[#ff5a5f] underline">fonctionnement étape par étape</Link>
          {" "}et nos <Link href="/blog" className="hover:text-[#ff5a5f] underline">conseils pour réussir sur LinkedIn</Link>.
          Essai gratuit 14 jours, sans carte bancaire.
        </p>
      </div>
    </footer>
    <ChatWidget />
    </>
  );
}
