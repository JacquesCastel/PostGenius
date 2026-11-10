import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import DemoEditoriale from "@/components/DemoEditoriale";
import { loadDemo } from "@/lib/demoEditorial";
import { JOIN_HREF, pick } from "@/lib/access";

// Prototype isolé : « un même sujet, trois profils, trois prises de parole ». Non indexé, non relié au site : on y arrive par son adresse.
// Les textes sont des générations réelles du moteur, lues dans content/demo-editoriale.json : aucun appel IA à la visite.
export const metadata = {
  title: "Démonstration éditoriale — LinkeePost",
  description: "Un même sujet, trois profils, trois prises de parole : LinkeePost interprète un sujet à travers l'identité de celui qui parle.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/demo-editoriale" },
};
export const dynamic = "force-dynamic"; // permet au jeu de test (variable d'environnement) d'être relu à chaque visite

export default function DemoEditorialePage() {
  let demo = null;
  try { demo = loadDemo(); } catch (e) { console.error("[demo-editoriale]", e?.message); }
  return (
    <div className="relative overflow-hidden bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 text-[#1b2a4a] min-h-screen flex flex-col">
      <div className="relative flex flex-col flex-1">
        <SiteHeader />
        <main className="flex-1 w-full">
          {demo ? (
            <DemoEditoriale {...demo} joinHref={JOIN_HREF} joinLabel={pick("Rejoindre la bêta", "Essayer LinkeePost")} />
          ) : (
            <p className="max-w-3xl mx-auto px-6 py-24 text-center text-[#5a6b85]" data-testid="demo-error">La démonstration est momentanément indisponible. Réessayez dans quelques minutes.</p>
          )}
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
