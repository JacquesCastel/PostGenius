import SiteHeader from "../SiteHeader";
import SiteFooter from "../SiteFooter";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";

// Gabarit du nouveau site : fond porcelaine, encre prune, polices Fraunces (titres) et DM Sans (texte), en-tête et pied de page « v2 ».
// Couleurs : porcelaine #FCF8F5, blush #F6E3E0, framboise #C2456F, prune #2E1F33, sauge #DCE9DF, pêche #FCE6D6.
export default function Shell({ children, mainClassName = "" }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FCF8F5] text-[#2E1F33] font-body-v2 antialiased">
      <SiteHeader variant="v2" />
      <main className={`flex-1 w-full ${mainClassName}`}>{children}</main>
      <SiteFooter variant="v2" />
    </div>
  );
}
