"use client";

import Link from "next/link";
import { ChevronRight, FlaskConical, ArrowRight } from "lucide-react";

// Démonstration de l'intelligence éditoriale : une même information, trois profils, trois prises de parole.
// Au centre : les trois publications COMPLÈTES, côte à côte. Autour : le strict nécessaire.
//
// Règles d'honnêteté (chacune est vérifiée par un test) :
//  - « génération réelle », « texte non modifié », date, nombre de générations, empreinte : affichés UNIQUEMENT pour un exemple authentique
//    (vérifié au chargement, hors données de test), et rangés dans la zone secondaire repliée ;
//  - sorties du moteur (publications, « choix d'écriture » annoncés avec le post) et analyses faites après génération (lecture éditoriale,
//    relevé de mots) sont dans des zones distinctes, chacune étiquetée ;
//  - en l'absence d'exemple : un état explicite, jamais un texte de remplacement.

const ACCENTS = {
  rose: { card: "border-rose-200 bg-rose-50/70", bar: "bg-[#ff5a5f]", text: "text-[#c93a40]", chip: "bg-rose-100 text-rose-800", post: "border-rose-200" },
  teal: { card: "border-teal-200 bg-teal-50/70", bar: "bg-teal-500", text: "text-teal-700", chip: "bg-teal-100 text-teal-800", post: "border-teal-200" },
  violet: { card: "border-violet-200 bg-violet-50/70", bar: "bg-violet-500", text: "text-violet-700", chip: "bg-violet-100 text-violet-800", post: "border-violet-200" },
  amber: { card: "border-amber-200 bg-amber-50/70", bar: "bg-amber-500", text: "text-amber-800", chip: "bg-amber-100 text-amber-900", post: "border-amber-200" },
  slate: { card: "border-slate-200 bg-slate-50/70", bar: "bg-slate-500", text: "text-slate-700", chip: "bg-slate-200 text-slate-800", post: "border-slate-200" },
};

const initials = (name) => name.split(/\s+/)[0].slice(0, 2).toUpperCase(); // évite « AI » pour BELVANTE INDUSTRIE
const dateFr = (iso) => { try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); } catch { return ""; } };
const splitPost = (text) => { const lines = String(text).split("\n"); const i = lines.findIndex((l) => l.trim()); return i < 0 ? ["", ""] : [lines[i].trim(), lines.slice(i + 1).join("\n").replace(/^\n+/, "")]; };

function Section({ eyebrow, title, id, children }) {
  return (
    <section aria-labelledby={`${id}-t`} id={id} className="max-w-6xl mx-auto px-5 sm:px-6 py-8 sm:py-12">
      {eyebrow && <p className="text-xs font-semibold tracking-widest uppercase text-[#ff5a5f]">{eyebrow}</p>}
      <h2 id={`${id}-t`} className="text-2xl sm:text-3xl font-extrabold mt-1">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Post({ id, c }) {
  const a = ACCENTS[c.accent] ?? ACCENTS.slate;
  const ok = c.status === "ok";
  const [first, rest] = ok ? splitPost(c.entry.text) : ["", ""];
  return (
    <article data-testid={`demo-post-${id}`} aria-label={`Prise de parole de ${c.name}`} className={`demo-in rounded-3xl bg-white border ${a.post} shadow-lg shadow-rose-100/30 p-5 sm:p-6 flex flex-col`}>
      <header className="flex items-center gap-3">
        <span className={`w-10 h-10 shrink-0 rounded-full ${a.bar} text-white text-sm font-bold flex items-center justify-center`} aria-hidden>{initials(c.name)}</span>
        <div className="min-w-0"><p className="font-bold leading-tight">{c.name}</p><p className="text-xs text-[#5a6b85]">{c.kind}</p></div>
      </header>
      {ok ? (
        <>
          {!c.entry.authentic && <p data-testid={`demo-testchip-${id}`} className="mt-3 self-start text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Texte de test, pas une génération de LinkeePost</p>}
          <p className="mt-4 text-[16px] font-bold leading-snug text-[#1b2a4a]">{first}</p>
          {rest && <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line text-[#2b3a57]">{rest}</p>}
        </>
      ) : (
        <div className="mt-4 flex-1 rounded-2xl border border-dashed border-[#c9d3e3] bg-[#f8fafc] p-5 text-sm text-[#5a6b85]" data-testid={`demo-empty-${id}`}>
          <p className="font-semibold text-[#1b2a4a]">{c.status === "invalid" ? "Exemple indisponible" : "Prise de parole en préparation"}</p>
          <p className="mt-1">{c.status === "invalid" ? "Sa vérification d'intégrité a échoué : par prudence, il n'est pas affiché." : "Cette prise de parole sera produite par le moteur de LinkeePost, jamais écrite à la main. Elle n'a pas encore été générée."}</p>
        </div>
      )}
    </article>
  );
}

export default function DemoEditoriale({ subject, identities, derived, comparison, fixture, allAuthentic, availableCount, joinHref, joinLabel }) {
  const companies = identities.filter((i) => !i.control);
  const control = identities.find((i) => i.control && i.status === "ok") ?? null;
  const authenticList = companies.filter((c) => c.status === "ok" && c.entry.authentic);

  return (
    <div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          @keyframes demoIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
          .demo-in { animation: demoIn .4s ease-out both; }
          .demo-in:nth-child(2) { animation-delay: .08s; } .demo-in:nth-child(3) { animation-delay: .16s; }
        }
      `}</style>

      {fixture && (
        <div role="alert" data-testid="demo-fixture" className="bg-amber-500 text-white text-sm font-medium text-center px-4 py-2.5">
          <FlaskConical size={15} className="inline -mt-0.5 mr-1.5" aria-hidden /> Données de test : ces textes ne sont pas des générations de LinkeePost.
        </div>
      )}

      <header className="max-w-6xl mx-auto px-5 sm:px-6 pt-10 sm:pt-14">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#ff5a5f]">Démonstration</p>
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mt-2">Une information.<br className="sm:hidden" /> Trois profils. <span className="text-[#ff5a5f]">Trois prises de parole.</span></h1>
        <p className="text-lg text-[#5a6b85] mt-4 max-w-2xl">Le sujet est identique. Seul change le profil de celui qui parle. Lisez ce que LinkeePost écrit.</p>
      </header>

      {/* 1. La même information */}
      <Section eyebrow="Étape 1" title="La même information" id="demo-sujet">
        <div className="rounded-3xl bg-white border border-white shadow-lg shadow-rose-100/40 p-6 sm:p-7">
          <p className="text-lg sm:text-xl leading-relaxed" data-testid="demo-subject">{subject.text}</p>
          <p className="text-sm text-[#5a6b85] mt-3" data-testid="demo-subject-note">
            {allAuthentic ? "Ce texte, mot pour mot, a été donné au moteur pour chacun des trois profils." : "Sujet commun de la démonstration : le même texte est destiné aux trois profils."}
          </p>
        </div>
      </Section>

      {/* 2. Trois profils (cartes courtes) */}
      <Section eyebrow="Étape 2" title="Trois profils" id="demo-entreprises">
        <ul className="grid md:grid-cols-3 gap-4">
          {companies.map((c) => {
            const a = ACCENTS[c.accent];
            return (
              <li key={c.id} data-testid={`demo-card-${c.id}`} className={`rounded-3xl border ${a.card} p-5`}>
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 shrink-0 rounded-full ${a.bar} text-white text-xs font-bold flex items-center justify-center`} aria-hidden>{initials(c.name)}</span>
                  <div className="min-w-0"><p className="font-extrabold leading-tight">{c.name}</p><p className="text-xs text-[#5a6b85]">{c.kind}</p></div>
                </div>
                {c.fictional && <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${a.chip}`}>{c.id === "expert" ? "Expert fictif" : "Entreprise fictive"}</span>}
                <dl className="mt-3 space-y-2 text-[13.5px] leading-snug">
                  <div><dt className={`inline font-bold ${a.text}`}>Positionnement. </dt><dd className="inline text-[#34445f]">{c.display.positioning}</dd></div>
                  <div><dt className={`inline font-bold ${a.text}`}>Conviction. </dt><dd className="inline text-[#34445f]">{c.display.conviction}</dd></div>
                </dl>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* 3. Trois prises de parole : les publications complètes, côte à côte */}
      <Section eyebrow="Étape 3" title="Trois prises de parole" id="demo-prise-de-parole">
        <div className="grid lg:grid-cols-3 gap-5 items-stretch" data-testid="demo-posts">
          {companies.map((c) => <Post key={c.id} id={c.id} c={c} />)}
        </div>
        {allAuthentic && (
          <p className="text-sm text-[#5a6b85] mt-4" data-testid="demo-authentic-line">Textes générés par le moteur de LinkeePost, repris sans modification. Détails de la méthode en bas de page.</p>
        )}

        {control && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white/80 p-5 sm:p-6" data-testid="demo-control">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Le témoin : la même information, sans aucun profil</p>
            {!control.entry.authentic && <p className="mt-2 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">Texte de test, pas une génération de LinkeePost</p>}
            <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line max-w-3xl">{control.entry.text}</p>
            <p className="text-sm text-[#5a6b85] mt-3">{control.entry.authentic ? "Même moteur, même information, même consigne de style, mais aucune information sur l'entreprise : voici ce que le moteur écrit quand il ne sait pas qui parle." : "Même information, aucun profil : voici ce que l'on attend d'un témoin."}</p>
          </div>
        )}
      </Section>

      {/* 4. Lecture éditoriale : analyse humaine, faite après génération */}
      {comparison && (
        <Section eyebrow="Notre lecture" title="Ce que nous en lisons" id="demo-lecture">
          <div className="rounded-3xl bg-[#fffaf0] border border-amber-200 p-5 sm:p-6 overflow-x-auto" data-testid="demo-reading">
            <p className="text-sm font-semibold text-amber-900">Analyse éditoriale rédigée après génération par {comparison.authoredBy}. Ce n&apos;est pas une sortie du moteur.</p>
            <table className="w-full min-w-[40rem] text-sm mt-4">
              <thead><tr className="text-left text-xs text-[#5a6b85]"><th className="py-2 pr-3 w-36" scope="col"><span className="sr-only">Critère</span></th>{companies.filter((c) => c.status === "ok").map((c) => <th key={c.id} scope="col" className="py-2 pr-3 font-bold text-[#1b2a4a]">{c.name}</th>)}</tr></thead>
              <tbody>
                {comparison.rows.map((r) => (
                  <tr key={r.label} className="border-t border-amber-100 align-top"><th scope="row" className="py-3 pr-3 text-left font-semibold">{r.label}</th>{companies.filter((c) => c.status === "ok").map((c) => <td key={c.id} className="py-3 pr-3 text-[#34445f]">{r[c.id] || "—"}</td>)}</tr>
                ))}
              </tbody>
            </table>
            {comparison.note && <p className="text-xs text-[#5a6b85] mt-3">{comparison.note}</p>}
          </div>
        </Section>
      )}

      {/* Zone secondaire : méthode, profils complets, relevé technique, provenance */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-4" aria-label="Détails de la démonstration">
        <details className="rounded-3xl bg-white/70 border border-white p-5 sm:p-6" data-testid="demo-details">
          <summary className="cursor-pointer font-bold">Détails de la démonstration : méthode, profils complets, relevé technique</summary>
          <div className="mt-5 space-y-7 text-sm text-[#34445f]">
            <div>
              <h3 className="font-bold text-[#1b2a4a]">Profils complets saisis pour la démonstration</h3>
              <p className="text-xs text-[#5a6b85] mt-1">{allAuthentic ? "Ce sont les champs transmis au moteur lors de la génération (vérifiés à partir de l'enregistrement conservé)." : "Ce sont les profils saisis pour la démonstration."} Les consignes de style sont identiques pour les trois entreprises.</p>
              <div className="grid md:grid-cols-3 gap-4 mt-3">
                {companies.map((c) => (
                  <dl key={c.id} className="space-y-1.5">
                    <dt className="font-extrabold text-[#1b2a4a]">{c.name}</dt>
                    {[["Activité", c.display.activity], ["Cible", c.display.target]].map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}. </dt><dd className="inline">{v}</dd></div>)}
                  </dl>
                ))}
              </div>
            </div>

            {authenticList.length > 0 ? (
              <div data-testid="demo-provenance">
                <h3 className="font-bold text-[#1b2a4a]">Provenance des textes</h3>
                <ul className="mt-2 space-y-2">
                  {authenticList.map((c) => (
                    <li key={c.id}>
                      <span className="font-semibold">{c.name}.</span> Généré par le moteur de LinkeePost{c.entry.generatedAt ? ` le ${dateFr(c.entry.generatedAt)}` : ""}.
                      {c.entry.selectedFrom ? ` Retenu parmi ${c.entry.selectedFrom} génération${c.entry.selectedFrom > 1 ? "s" : ""} (le choix est humain).` : ""} Empreinte {c.entry.hash} : recalculée à l&apos;identique au chargement de la page, donc le texte affiché est celui qui a été enregistré à la génération.
                    </li>
                  ))}
                </ul>
                {authenticList.some((c) => c.entry.why) && (
                  <div className="mt-5" data-testid="demo-why">
                    <h3 className="font-bold text-[#1b2a4a]">Choix d&apos;écriture annoncés par le moteur avec chaque texte</h3>
                    <p className="text-xs text-[#5a6b85] mt-1">Sortie du moteur, écrite dans la même génération que le post.</p>
                    <div className="grid md:grid-cols-3 gap-4 mt-3">
                      {authenticList.filter((c) => c.entry.why).map((c) => (
                        <dl key={c.id} className="space-y-1.5"><dt className="font-extrabold text-[#1b2a4a]">{c.name}</dt>
                          {[["Accroche", c.entry.why.hook], ["Structure", c.entry.why.structure], ["Fin", c.entry.why.cta]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}. </dt><dd className="inline">{v}</dd></div>)}
                        </dl>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p data-testid="demo-noprov" className="rounded-2xl bg-[#f8fafc] border border-dashed border-[#c9d3e3] p-4">{fixture ? "Données de test : aucune information de provenance n'est présentée, car aucun de ces textes n'a été généré par LinkeePost." : "Aucune génération authentique n'est encore publiée : il n'y a donc pas de provenance à présenter."}</p>
            )}

            {derived && (
              <div data-testid="demo-compare">
                <h3 className="font-bold text-[#1b2a4a]">Relevé mécanique des textes (analyse faite après génération)</h3>
                <p className="text-xs text-[#5a6b85] mt-1">Reproductible, sans IA : la première ligne de chaque texte, et les mots de plus de quatre lettres présents dans ce texte et absents des deux autres.</p>
                <div className="grid md:grid-cols-3 gap-4 mt-3">
                  {companies.filter((c) => c.status === "ok").map((c) => (
                    <div key={c.id}><p className="font-extrabold text-[#1b2a4a]">{c.name}</p><p className="mt-1"><span className="font-semibold">Première ligne. </span>{derived.firstLines[c.id]}</p><p className="mt-1"><span className="font-semibold">Mots propres. </span>{derived.terms[c.id]?.length ? derived.terms[c.id].join(" · ") : "—"}</p></div>
                  ))}
                </div>
              </div>
            )}

            <ul className="list-disc pl-5 space-y-1 text-[#34445f]">
              <li>BELVANTE INDUSTRIE, CANTEVEL Conseil et Mathis Garlandier (Garlandier Conseil) sont fictifs : deux entreprises et un expert indépendant inventés pour la démonstration. Rien n&apos;est publié sur LinkedIn.</li>
              <li>Les profils sont des données que nous avons saisies : la démonstration montre des textes cohérents avec une identité, pas un angle que le moteur aurait découvert seul.</li>
            </ul>
          </div>
        </details>
      </section>

      {/* 5. Conversion */}
      <section className="max-w-6xl mx-auto px-5 sm:px-6 py-12 sm:py-16" aria-labelledby="demo-cta-t">
        <div className="rounded-[2rem] bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white p-8 sm:p-12 text-center shadow-2xl shadow-rose-300/50">
          <h2 id="demo-cta-t" className="text-2xl sm:text-4xl font-extrabold">Et votre point de vue ?</h2>
          <p className="text-white/90 mt-3 max-w-xl mx-auto">Donnez votre profil et vos propres contenus à LinkeePost, et lisez ce qu&apos;il écrit pour vous.</p>
          <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href={joinHref} data-testid="demo-cta" className="inline-flex items-center gap-2 bg-white text-[#d63b42] font-bold px-7 py-3.5 rounded-full hover:bg-rose-50 transition-colors">
              {joinLabel} <ChevronRight size={17} aria-hidden />
            </Link>
            <Link href="/fonctionnalites" className="inline-flex items-center gap-2 font-semibold text-white/95 hover:underline">
              Voir toutes les fonctionnalités <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
