import Link from "next/link";
import { LogIn } from "lucide-react";
import LpMark from "./LpMark";

// En-tête public partagé (landing, blog, contact, pages légales)
export default function SiteHeader() {
  return (
    <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
      <div className="bg-white/80 backdrop-blur rounded-full shadow-lg shadow-rose-100/50 border border-white px-5 py-2.5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="bg-[#ff5a5f] text-white p-1.5 rounded-xl shadow-md shadow-rose-300/40">
            <LpMark size={18} />
          </div>
          <span className="font-extrabold text-[#1b2a4a]">LinkeePost</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#5a6b85] mx-auto">
          <Link href="/fonctionnalites" className="hover:text-[#ff5a5f] transition-colors">Fonctionnalités</Link>
          <Link href="/comment-ca-marche" className="hover:text-[#ff5a5f] transition-colors">Comment ça marche</Link>
          <Link href="/tarifs" className="hover:text-[#ff5a5f] transition-colors">Tarifs</Link>
          <Link href="/blog" className="hover:text-[#ff5a5f] transition-colors">Blog</Link>
          <Link href="/contact" className="hover:text-[#ff5a5f] transition-colors">Contact</Link>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/app"
            className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-semibold px-5 py-2 rounded-full shadow-md shadow-rose-300/40 transition-colors"
          >
            Essai gratuit
          </Link>
          <Link
            href="/app?mode=login"
            title="Se connecter"
            aria-label="Se connecter"
            className="w-9 h-9 rounded-full border border-[#ffd5d6] flex items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
          >
            <LogIn size={17} />
          </Link>
        </div>
      </div>
    </header>
  );
}
