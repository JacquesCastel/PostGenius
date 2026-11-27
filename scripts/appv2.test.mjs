import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { appV2Mode, appV2Active } from "../lib/appV2.js";

test("interrupteur : valeurs de APP_V2", () => {
  assert.equal(appV2Mode({ APP_V2: "1" }), "on");
  assert.equal(appV2Mode({ APP_V2: "admin" }), "admin");
  assert.equal(appV2Mode({}), "off");
  assert.equal(appV2Mode({ APP_V2: "oui" }), "off");
});

test("interrupteur : qui voit la nouvelle application", () => {
  // ouvert à tous
  assert.equal(appV2Active({ mode: "on", isAdmin: false, pref: null }), true);
  // aperçu administrateur
  assert.equal(appV2Active({ mode: "admin", isAdmin: true, pref: null }), true);
  assert.equal(appV2Active({ mode: "admin", isAdmin: false, pref: "1" }), false);
  // fermé : seul un administrateur peut l'essayer, et revenir en arrière
  assert.equal(appV2Active({ mode: "off", isAdmin: false, pref: "1" }), false);
  assert.equal(appV2Active({ mode: "off", isAdmin: true, pref: null }), false);
  assert.equal(appV2Active({ mode: "off", isAdmin: true, pref: "1" }), true);
  assert.equal(appV2Active({ mode: "admin", isAdmin: true, pref: "0" }), false);
});

const page = readFileSync(new URL("../app/app/page.js", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/app/ShellV2.js", import.meta.url), "utf8");
const status = readFileSync(new URL("../app/api/status/route.js", import.meta.url), "utf8");

test("le statut public annonce l'interrupteur", () => {
  assert.match(status, /appV2Mode\(\)/);
});

test("menu à cinq entrées : Aujourd'hui, Écrire, Mes posts, Mes résultats, Mon copilote (+ Mes clients en Agence)", () => {
  for (const l of ["Aujourd'hui", "Écrire", "Mes posts", "Mes résultats", "Mon copilote", "Mes clients"]) assert.ok(page.includes(`label: "${l}"`), l);
});

test("Mon espace est dans le menu de la photo, avec toutes ses entrées et la sortie de session", () => {
  for (const id of ["profile", "themes", "datalake", "connections", "brand-kit", "billing"]) assert.ok(shell.includes(`"${id}"`), id);
  assert.match(shell, /data-testid="avatar-menu"/);
  assert.match(shell, /Se déconnecter/);
});

test("aucune vue n'est retirée : chaque ancienne entrée reste atteignable dans le nouveau menu", () => {
  const reachable = [...page.matchAll(/match: \[([^\]]*)\]/g)].flatMap((m) => m[1].match(/"[^"]+"/g) ?? []).map((s) => s.slice(1, -1));
  const tabs = [...shell.matchAll(/\["([a-z-]+)", "/g)].map((m) => m[1]);
  const all = new Set([...reachable, ...tabs, "dashboard", "copilot", "clients"]);
  for (const v of ["dashboard", "create", "campaigns", "datalake", "share", "events", "history", "engage", "leads", "stats", "copilot", "profile", "themes", "connections", "brand-kit", "billing", "clients"]) assert.ok(all.has(v), `vue ${v} introuvable dans le nouveau menu`);
});

test("l'ancien menu reste le défaut et le menu administrateur / agence / client n'est pas touché", () => {
  assert.match(page, /const v2Shell = appV2Active\(/);
  assert.match(page, /!user\.isSuperAdmin && !agencyHome && !clientMode/);
  assert.ok(page.includes('label: "Tableau de bord"'), "ancien menu conservé");
});

test("les identifiants de test du menu sont conservés", () => {
  assert.ok(page.includes('data-testid="app-logo"'));
});

test("tranche 2 : Aujourd'hui en liste de choses à faire, onglets discrets, ancien tableau de bord intact hors interrupteur", () => {
  assert.match(page, /v2 && todoItems\.length > 0/);
  assert.ok(page.includes('data-testid="dash-todo"'));
  assert.ok(page.includes('{v2 && weekBlock}'));
  // l'ancien bandeau et les grands onglets existent toujours pour l'ancienne application
  assert.ok(page.includes('data-testid="dash-hero"'));
  assert.ok(page.includes('aria-label="Sections du tableau de bord"'));
  // aucune fonction retirée : planning et résultats restent des onglets
  for (const t of ['"today"', '"planning"', '"results"']) assert.ok(page.includes(t));
});

test("tranche 2 : logo Vercéa et photo LinkedIn dans la nouvelle application", () => {
  assert.match(page, /v2Shell \? <BrandV2 \/>/);
  assert.match(page, /photoUrl=\{linkedin\?\.picture/);
  assert.match(shell, /export function BrandV2/);
  assert.match(shell, /data-testid="avatar-photo"/);
  assert.match(shell, /onError=\{\(\) => setBroken\(true\)\}/); // photo cassée : on retombe sur l'initiale
});

test("pictos du menu : ceux des maquettes, un par entrée", () => {
  for (const k of ["sun", "pen", "doc", "bar", "spark"]) assert.ok(page.includes(`pico: "${k}"`), k);
  assert.match(shell, /export function NavIconV2/);
  assert.ok(shell.includes('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z'), "étoile du copilote");
});

test("création d'un post : les quatre étapes sont indiquées (idée, relecture, moment, terminé)", () => {
  assert.match(shell, /\["Idée", "Relecture", "Moment", "Terminé"\]/);
  assert.match(page, /<CreateStepsV2 step=\{scheduleDraft && scheduleFromCreate \? 3 : 2\}/);
  assert.match(page, /<CreateStepsV2 step=\{nextStep && !result && !seriesResult && !loading \? 4 : 1\}/);
});

test("création : les choix du copilote sont résumés et dépliables, sans retirer aucun bloc", () => {
  assert.match(shell, /export function CreateChoicesV2/);
  assert.ok(shell.includes("Le copilote a choisi pour vous"));
  // les blocs d'origine restent dans la page, seulement masqués tant qu'on ne clique pas sur « Changer »
  for (const id of ["mood-block", "context-picker", "moment-picker", "publish-as", "pillar-block"]) {
    assert.ok(page.includes(`data-testid="${id}"`), id);
  }
  assert.match(page, /v2Shell && isTopic && genMode === "single" && !v2Open\.mood \? "hidden"/);
  assert.match(page, /!v2Open\.where \? "hidden"/);
  // l'ancienne phrase d'introduction reste pour l'ancienne application
  assert.match(page, /isTopic && !v2Shell && \(/);
});

test("téléphone : barre du bas à cinq icônes, mêmes entrées que le menu, bouton d'aide remonté", () => {
  assert.match(shell, /export function BottomBarV2/);
  assert.match(page, /<BottomBarV2 items=\{NAV_V2\.filter\(\(i\) => !i\.mobileOnly\)\}/);
  assert.ok(page.includes('v2Shell ? "pb-24 md:pb-0"'), "le contenu ne passe pas sous la barre");
  assert.ok(page.includes('bottom-24 md:bottom-5'), "le bouton « ? » ne passe pas sous la barre");
});

test("titres de la nouvelle application : Mes sources, Réponses à traiter, Mes résultats, Mon copilote", () => {
  for (const t of ['"Mes sources"', '"Réponses à traiter"', '"Mes résultats"', '"Mon copilote"']) assert.ok(page.includes(t), t);
  assert.ok(page.includes('"Datalake éditorial"'), "ancien titre conservé");
});

test("couleurs : l'aperçu LinkedIn garde les couleurs de LinkedIn, le reste suit la charte", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.ok(css.includes('.app-v2 [class*="text-[#0a66c2]"]:not([data-testid="li-preview"] *)'));
  assert.ok(css.includes('.app-v2 [class*="text-[#1b2a4a]"]'));
  assert.ok(css.includes("accent-color: #c2456f"));
});

test("Mes posts : liste à onglets d'état, calendrier et tableau (glisser-déposer conservé)", () => {
  assert.match(shell, /export function PostsToolbarV2/);
  for (const k of ["list", "calendar", "board"]) assert.ok(shell.includes(`["${k}", "`), k);
  assert.match(page, /const v2List = v2Shell && postsMode === "list"/);
  assert.match(page, /\.filter\(\(col\) => !v2List \|\| col\.id === effCol\)/);
  // le tableau et son glisser-déposer existent toujours, ainsi que le calendrier de l'ancienne application
  assert.ok(page.includes("handleKanbanDrop(col.id"));
  assert.match(page, /\(!v2Shell \|\| postsMode === "calendar"\)/);
});

test("Mes résultats : quatre chiffres en haut dans la nouvelle application, l'écran Statistiques reste dessous", () => {
  assert.ok(page.includes('data-testid="results-kpis"'));
  for (const l of ["Posts publiés", "Impressions", "Réactions", "Contrôle de forme"]) assert.ok(page.includes(`["${l}"`), l);
  assert.ok(page.includes('<h2 className="font-semibold text-lg">Statistiques</h2>'));
});

test("Mon profil : barre de complétude et ce qui manque, au-dessus du profil existant", () => {
  assert.match(shell, /export function ProfileCompletenessV2/);
  assert.ok(page.includes("{v2Shell && <ProfileCompletenessV2 profile={profile} />}"));
  assert.ok(page.includes("<ProfilePage"));
});

test("Mes posts en liste : même largeur que l'en-tête, deux colonnes de cartes (une sur petit écran) sans défilement interne ni titre de colonne", () => {
  assert.ok(page.includes('<main className={`p-6 ${v2Shell ? "max-w-5xl mx-auto" : ""}`}>'));
  assert.ok(page.includes('v2List ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-start" : "space-y-3 max-h-[68vh] overflow-y-auto pr-1"'));
  assert.ok(page.includes('${v2List ? "hidden" : ""}'));
});

test("Aujourd'hui : calé sur la maquette (salutation, choses à faire, semaine, idées et campagne en deux colonnes)", () => {
  assert.ok(page.includes('data-testid="dash-greeting"'));
  assert.ok(page.includes('"Rien d\'urgent aujourd\'hui."'));
  assert.ok(page.includes('lg:grid-cols-[1.35fr_1fr]'));
  assert.ok(page.includes('data-testid="reco-compact"'));
  assert.ok(page.includes('"Voir le calendrier"'));
  // l'ancien tableau de bord garde ses blocs : seconde vie, compteurs, grands onglets
  for (const id of ["dash-repurpose", "dash-kpi", 'aria-label="Sections du tableau de bord"']) assert.ok(page.includes(id), id);
  // ... et rien n'est perdu : seconde vie dans Écrire, planning derrière « Voir le calendrier »
  assert.ok(shell.includes('data-testid="write-repurpose"'));
  assert.ok(page.includes('data-testid="dash-back-today"'));
});

test("Écrire : titre et quatre cartes de la maquette, puis « Reprendre » (brouillons)", () => {
  assert.ok(shell.includes("Par où voulez-vous"));
  for (const cta of ["Écrire un post →", "Planifier une campagne →", "Choisir un contenu →", "Préparer un événement →"]) assert.ok(shell.includes(cta), cta);
  assert.ok(shell.includes('data-testid="write-resume"'));
  assert.ok(page.includes('view === "dashboard" || view === "write") ? "hidden"'));
  assert.ok(page.includes('setListCol("brouillon")'));
});
