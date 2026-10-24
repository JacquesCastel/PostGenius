"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import LpMark from "./LpMark";

// En-tête public partagé (landing, blog, contact, pages légales). Aussi rendu
// depuis app/app/page.js (client) sur l'écran de connexion/inscription — d'où
// le composant client avec vérification de session via /api/auth/me plutôt
// qu'une lecture de cookies côté serveur (incompatible avec cet usage-là).
const NAV = [
  ["/fonctionnalites", "Fonctionnalités"],
  ["/comment-ca-marche", "Comment ça marche"],
  ["/scoring", "Contrôle de forme"],
  ["/tarifs", "Tarifs"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
];

export default function SiteHeader() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [open, setOpen] = useState(false); // menu sur téléphone et tablette

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setLoggedIn(Boolean(d.user)))
      .catch(() => {});
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  };

  return (
    <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-5">
      <div className="bg-white/80 backdrop-blur rounded-full shadow-lg shadow-rose-100/50 border border-white px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="bg-[#ff5a5f] text-white p-1.5 rounded-xl shadow-md shadow-rose-300/40">
            <LpMark size={18} />
          </div>
          <span className="font-extrabold text-[#1b2a4a]">LinkeePost</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#5a6b85] mx-auto">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="hover:text-[#ff5a5f] transition-colors">{label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/app"
            className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-semibold px-4 sm:px-5 py-2 rounded-full shadow-md shadow-rose-300/40 transition-colors"
          >
            Essai gratuit
          </Link>
          {loggedIn ? (
            <button
              onClick={logout}
              title="Se déconnecter"
              aria-label="Se déconnecter"
              className="hidden sm:flex w-9 h-9 rounded-full border border-[#ffd5d6] items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
            >
              <LogOut size={17} />
            </button>
          ) : (
            <Link
              href="/app?mode=login"
              title="Se connecter"
              aria-label="Se connecter"
              className="hidden sm:flex w-9 h-9 rounded-full border border-[#ffd5d6] items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
            >
              <LogIn size={17} />
            </Link>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            data-testid="site-menu-toggle"
            className="lg:hidden w-9 h-9 rounded-full border border-[#ffd5d6] flex items-center justify-center text-[#1b2a4a] hover:text-[#ff5a5f] hover:border-[#ff5a5f] transition-colors"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="lg:hidden mt-2 bg-white rounded-3xl shadow-lg shadow-rose-100/50 border border-white p-2 flex flex-col" data-testid="site-menu">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">{label}</Link>
          ))}
          {loggedIn ? (
            <button type="button" onClick={logout} className="sm:hidden text-left px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">Se déconnecter</button>
          ) : (
            <Link href="/app?mode=login" onClick={() => setOpen(false)} className="sm:hidden px-4 py-3 rounded-2xl text-[15px] font-medium text-[#1b2a4a] hover:bg-[#fff1f1]">Se connecter</Link>
          )}
        </nav>
      )}
    </header>
  );
}
