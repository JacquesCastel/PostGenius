import Link from "next/link";

// Barre commune aux trois pages « Produit » : on passe de l'une à l'autre sans revenir au menu. La page courante n'est pas un lien.
// Les libellés sont ceux du pied de page (lib/siteNav.js) : un seul vocabulaire pour les mêmes pages.
export const PAGES_PRODUIT = [
  ["/produit", "Vue d'ensemble"],
  ["/produit/methode", "Comment l'outil fonctionne"],
  ["/produit/verification", "Chiffres à vérifier"],
];

export default function SousNavProduit({ courante }) {
  return (
    <nav aria-label="Pages Produit" className="mb-8 flex flex-wrap gap-2 text-[14px] font-semibold" data-testid="sous-nav-produit">
      {PAGES_PRODUIT.map(([href, label]) => href === courante
        ? <span key={href} aria-current="page" className="px-4 py-2 rounded-full bg-[#2E1F33] text-white">{label}</span>
        : <Link key={href} href={href} className="px-4 py-2 rounded-full bg-white border border-[#EFE4E0] text-[#6B5A70] hover:border-[#C2456F] hover:text-[#9E3157] transition-colors">{label}</Link>)}
    </nav>
  );
}
