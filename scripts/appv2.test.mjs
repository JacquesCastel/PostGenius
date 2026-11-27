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
