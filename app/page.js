import { accueilV2Ouvert } from "@/lib/siteAccueil";
import LegacyHome, { metadata as legacyMetadata } from "@/components/home/LegacyHome";
import HomeV2 from "@/components/home/HomeV2";
import { BRAND_NAME } from "@/lib/brand";
import { pick } from "@/lib/access";

// Page vitrine publique. Tant que SITE_ACCUEIL=1 n'est pas posé sur le serveur, l'ancienne accueil s'affiche, strictement inchangée.
// Rendu à la requête : l'interrupteur se lit à chaque requête, et le contenu de l'ancienne (offres, hero, FAQ) est éditable depuis l'admin.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  if (!accueilV2Ouvert()) return legacyMetadata;
  return {
    title: `${BRAND_NAME} — Vos sources, vos consignes, votre voix`,
    description: `${BRAND_NAME} rédige vos posts LinkedIn à partir de vos documents, de vos notes et de votre voix, et signale avant publication les chiffres absents de vos informations. ` + pick("Accès sur invitation pendant la bêta fermée.", "Essai gratuit 14 jours."),
    alternates: { canonical: "/" },
  };
}

export default async function Page() {
  return accueilV2Ouvert() ? <HomeV2 /> : <LegacyHome />;
}
