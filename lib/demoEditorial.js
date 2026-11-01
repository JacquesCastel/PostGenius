import fs from "fs";
import bundled from "@/content/demo-editoriale.json";
import { IDENTITIES, SUBJECT, COMPANY_IDS, displayOf, validateEntry, firstLine, distinctTerms, cleanComparison } from "./demoEditorialCore.mjs";

// Démonstration de l'intelligence éditoriale (page /demo-editoriale) : lecture des exemples déjà générés. AUCUN appel IA à la visite.
// Un exemple n'est affiché que si son enregistrement de génération est complet et que son empreinte se recalcule (lib/demoEditorialCore.mjs) ;
// sinon la page dit qu'il est indisponible. Jamais de texte de remplacement.
// DEMO_EDITORIALE_FIXTURE (chemin d'un fichier) sert aux TESTS : la page affiche alors un bandeau « données de test », jamais « authentique ».
export function loadDemo() {
  let data = bundled;
  const fixturePath = process.env.DEMO_EDITORIALE_FIXTURE;
  if (fixturePath) {
    try { data = JSON.parse(fs.readFileSync(fixturePath, "utf8")); } catch { data = { entries: {} }; }
  }
  // Données de test : variable d'environnement OU fichier qui se déclare « fixture ». Dans ce cas AUCUNE provenance n'est présentée
  // (ni « génération réelle », ni date, ni nombre de générations, ni empreinte) : un jeu de test ne peut pas passer pour authentique,
  // même si quelqu'un le copie par erreur dans content/demo-editoriale.json.
  const fixture = Boolean(fixturePath) || data.fixture === true;
  const identities = IDENTITIES.map((identity) => {
    const raw = data.entries?.[identity.id] ?? null;
    const check = raw ? validateEntry(raw, identity.id) : null;
    const status = !raw ? "absent" : check.ok ? "ok" : "invalid";
    const rec = raw?.record;
    return {
      id: identity.id,
      name: identity.name,
      kind: identity.kind,
      fictional: identity.fictional,
      control: Boolean(identity.control),
      accent: identity.accent,
      display: displayOf(identity),
      status,
      // Le texte est toujours affiché ; les informations de provenance (et le « why » écrit par le moteur) ne sont transmises que pour un
      // exemple AUTHENTIQUE : vérifié (empreinte recalculée à l'identique) et hors données de test.
      entry: status === "ok"
        ? {
            authentic: !fixture,
            text: rec.response.text,
            why: !fixture && rec.response.why ? { hook: rec.response.why.hook ?? "", structure: rec.response.why.structure ?? "", cta: rec.response.why.cta ?? "" } : null,
            generatedAt: !fixture ? raw.generatedAt ?? null : null,
            selectedFrom: !fixture ? raw.selectedFrom ?? null : null,
            hash: !fixture ? raw.recordHash.slice(0, 12) : null,
            modelHint: !fixture ? raw.engine?.modelHint ?? null : null,
          }
        : null,
    };
  });
  const ok = identities.filter((i) => i.status === "ok" && !i.control);
  const derived = ok.length >= 2
    ? { firstLines: Object.fromEntries(ok.map((i) => [i.id, firstLine(i.entry.text)])), terms: distinctTerms(Object.fromEntries(ok.map((i) => [i.id, i.entry.text]))) }
    : null;
  return {
    subject: SUBJECT,
    identities,
    derived,
    comparison: ok.length >= 2 ? cleanComparison(data.comparison) : null,
    fixture,
    allAuthentic: !fixture && ok.length === COMPANY_IDS.length,
    availableCount: ok.length,
    companyIds: COMPANY_IDS,
  };
}
