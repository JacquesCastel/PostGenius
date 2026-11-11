// Contrôle des consignes d'un post libre (lib/consigneRules.js). Lancer : node --test scripts/consigne-rules.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { deriveConsigneRules, checkConsignes, CONSIGNES_CHECKED } from "../lib/consigneRules.js";

const src = (text, origin = "Consignes de style") => [{ origin, text }];
const kinds = (rules) => rules.map((r) => r.kind).sort();

test("zéro émoji : règle dérivée, écart signalé, texte sans émoji accepté", () => {
  const rules = deriveConsigneRules({ sources: src("Ton direct. Zéro émoji.") });
  assert.deepEqual(kinds(rules), ["noEmoji"]);
  assert.equal(checkConsignes("Un post sobre.", rules).length, 0);
  const issues = checkConsignes("Un post 🚀 avec 🎉", rules);
  assert.equal(issues.length, 1);
  assert.match(issues[0].text, /2 émojis/);
  assert.equal(issues[0].severity, "error");
});

test("formulations de zéro émoji reconnues, et rien de plus", () => {
  for (const t of ["Pas d'émojis", "sans emoji", "Aucun émoji", "jamais d'émojis"]) assert.deepEqual(kinds(deriveConsigneRules({ sources: src(t) })), ["noEmoji"], t);
  assert.deepEqual(deriveConsigneRules({ sources: src("Utilise quelques émojis pour rythmer") }), []);
  assert.deepEqual(deriveConsigneRules({ sources: src("Pas d'émoji, sauf pour les annonces") }), [], "consigne conditionnelle : aucune règle devinée");
});

test("hashtags : maximum et zéro, jamais un minimum ni un nombre ambigu", () => {
  const max = deriveConsigneRules({ sources: src("Pas plus de 3 hashtags.") });
  assert.equal(max[0].value, 3);
  assert.equal(checkConsignes("Texte #a #b #c", max).length, 0);
  assert.equal(checkConsignes("Texte #a #b #c #d", max).length, 1);
  assert.equal(deriveConsigneRules({ sources: src("Maximum deux hashtags") })[0].value, 2);
  assert.equal(deriveConsigneRules({ sources: src("Trois hashtags maximum") })[0].value, 3);
  assert.equal(deriveConsigneRules({ sources: src("Aucun hashtag") })[0].value, 0);
  assert.deepEqual(deriveConsigneRules({ sources: src("Au moins 3 hashtags") }), []);
  assert.deepEqual(deriveConsigneRules({ sources: src("3 hashtags") }), [], "nombre sans « maximum » : ambigu, aucune règle");
  const strict = deriveConsigneRules({ sources: [...src("Max 5 hashtags"), ...src("Pas plus de 2 hashtags", "Remarque")] });
  assert.equal(strict[0].value, 2, "la règle la plus stricte l'emporte");
  assert.equal(strict[0].origin, "Remarque");
});

test("les liens ne comptent pas comme hashtags", () => {
  const rules = deriveConsigneRules({ sources: src("Aucun hashtag") });
  assert.equal(checkConsignes("Lire https://exemple.fr/page#section", rules).length, 0);
});

test("mots à éviter : mot entier, pluriel, sans accent ; pas d'écho dans un autre mot", () => {
  const rules = deriveConsigneRules({ avoid: ["leader", "révolutionnaire"] });
  assert.equal(checkConsignes("Nous sommes un acteur discret.", rules).length, 0);
  assert.match(checkConsignes("Les leaders du marché.", rules)[0].text, /« leader »/);
  assert.match(checkConsignes("Une approche REVOLUTIONNAIRE.", rules)[0].text, /« révolutionnaire »/);
  assert.equal(checkConsignes("Un leadership partagé.", rules).length, 0);
});

test("longueur maximale du formulaire", () => {
  const rules = deriveConsigneRules({ maxChars: 100 });
  assert.equal(checkConsignes("a".repeat(100), rules).length, 0);
  const issues = checkConsignes("a".repeat(101), rules);
  assert.match(issues[0].text, /101 caractères pour une longueur maximale de 100/);
  assert.deepEqual(deriveConsigneRules({ maxChars: "abc" }), []);
});

test("vouvoiement et tutoiement : sens, négation, conditionnel, langue", () => {
  const vous = deriveConsigneRules({ sources: src("Vouvoiement systématique, sans exception.") });
  assert.equal(vous[0].side, "vous", "« sans exception » après le mot n'inverse rien");
  assert.equal(deriveConsigneRules({ sources: src("Pas de tutoiement") })[0].side, "vous");
  assert.equal(deriveConsigneRules({ sources: src("Évite le vouvoiement") })[0].side, "tu");
  assert.equal(deriveConsigneRules({ sources: src("Ne tutoie pas les lecteurs") })[0].side, "vous");
  assert.equal(deriveConsigneRules({ sources: src("Tutoiement obligatoire") })[0].side, "tu");
  assert.deepEqual(deriveConsigneRules({ sources: src("Tutoiement seulement dans les posts personnels") }), []);
  assert.deepEqual(deriveConsigneRules({ sources: [...src("Tutoiement"), ...src("Vouvoiement", "Remarque")] }), [], "consignes contradictoires : aucune règle");
  assert.deepEqual(deriveConsigneRules({ sources: src("Vouvoiement"), language: "en" }), [], "contrôlé en français seulement");

  const issues = checkConsignes("Je t'aide : tu peux le faire.", vous);
  assert.equal(issues[0].severity, "warn");
  assert.match(issues[0].text, /vouvoiement/);
  assert.equal(checkConsignes("Vous pouvez le faire, votre équipe aussi.", vous).length, 0);
  const tu = deriveConsigneRules({ sources: src("Tutoie le lecteur") });
  assert.equal(checkConsignes("Tu peux le faire.", tu).length, 0);
  assert.match(checkConsignes("Vous pouvez le faire.", tu)[0].text, /tutoiement/);
});

test("mesure du 11 novembre : une consigne limitée à une partie du post ou assortie d'une exception ne produit aucune règle ; chaque consigne est lue dans sa proposition", () => {
  assert.deepEqual(deriveConsigneRules({ sources: src("Pas de hashtag dans le corps du texte") }), [], "faux positif relevé par la mesure");
  assert.deepEqual(deriveConsigneRules({ sources: src("Pas d'émojis dans le titre") }), []);
  assert.deepEqual(deriveConsigneRules({ sources: src("Pas d'émoji, sauf pour les annonces") }), []);
  assert.deepEqual(kinds(deriveConsigneRules({ sources: src("Pas d'émojis, tutoiement seulement sur les posts personnels") })), ["noEmoji"]);
  // exemple affiché par l'application : « ouverture » appartient à une autre proposition que « pas d'émojis »
  assert.deepEqual(kinds(deriveConsigneRules({ sources: src("je tutoie mon audience, pas d'emojis,\nphrases courtes, une anecdote en ouverture") })), ["address", "noEmoji"]);
  assert.deepEqual(kinds(deriveConsigneRules({ sources: src("Pas plus de 3 hashtags, pas d'émojis, vouvoiement") })), ["address", "maxHashtags", "noEmoji"]);
});

test("« ton » (le ton d'un texte) ne déclenche pas le contrôle du vouvoiement", () => {
  const vous = deriveConsigneRules({ sources: src("Vouvoiement") });
  assert.equal(checkConsignes("Le ton est direct et sobre.", vous).length, 0);
});

test("texte vide, règles absentes ou consignes sans rien de contrôlable : aucun écart", () => {
  assert.deepEqual(checkConsignes("", [{ kind: "maxChars", value: 1, id: "length", origin: "x" }]), []);
  assert.deepEqual(checkConsignes("Un texte", []), []);
  assert.deepEqual(checkConsignes("Un texte", undefined), []);
  assert.deepEqual(deriveConsigneRules({ sources: src("Ton direct, phrases courtes, pas de jargon.") }), []);
  assert.deepEqual(deriveConsigneRules(), []);
});

test("règles sérialisables (envoyées au navigateur) et résumé de ce qui est contrôlé", () => {
  const rules = deriveConsigneRules({ sources: src("Zéro émoji. Maximum 2 hashtags. Vouvoiement."), avoid: ["leader"], maxChars: 1300 });
  assert.deepEqual(JSON.parse(JSON.stringify(rules)), rules);
  assert.deepEqual(kinds(rules), ["address", "avoidTerms", "maxChars", "maxHashtags", "noEmoji"]);
  assert.match(CONSIGNES_CHECKED, /sans contrôle ensuite/);
});

test("route /api/consignes : lit les consignes de l'utilisateur, sans IA ; le moteur d'écriture n'est pas touché (lecture du code)", () => {
  const route = fs.readFileSync(new URL("../app/api/consignes/route.js", import.meta.url), "utf8");
  assert.ok(route.includes('from "@/lib/consigneRules"') && route.includes("deriveConsigneRules("));
  assert.ok(route.includes("getUserId(req)") && route.includes("401"), "réservée aux comptes connectés");
  assert.ok(!/anthropic|openai|fetch\(/i.test(route), "aucun appel à l'IA ni au réseau");
  for (const f of ["../app/api/generate/route.js", "../lib/linkedinRules.js"]) {
    const src = fs.readFileSync(new URL(f, import.meta.url), "utf8");
    assert.ok(!src.includes("consigneRules"), `${f} : moteur d'écriture figé, non modifié par ce contrôle`);
  }
});

test("interface : le contrôle s'applique au texte affiché et ne le modifie pas (lecture du code)", () => {
  const page = fs.readFileSync(new URL("../app/app/page.js", import.meta.url), "utf8");
  assert.ok(page.includes("<ConsignesCheck text="));
  const comp = page.slice(page.indexOf("function ConsignesCheck"), page.indexOf("function PlanText"));
  assert.ok(comp.includes("checkConsignes(text, rules)") && !comp.includes("setResult") && !comp.includes("onChange"), "aucune écriture dans le texte");
});

test("terminer par une question : consigne reconnue (y compris l'exemple de l'application), contrôle de la dernière ligne", () => {
  for (const t of ["Je tutoie mon audience, phrases courtes, pas d'émojis, une question pour finir", "Termine toujours par une question.", "Finis par une question", "Question finale obligatoire", "Conclus par une question ouverte"]) {
    assert.ok(kinds(deriveConsigneRules({ sources: src(t) })).includes("endsWithQuestion"), t);
  }
  for (const t of ["Pas de question finale", "Évite de finir par une question", "Une question pour finir, sauf pour les annonces", "Ne termine pas par une question"]) {
    assert.ok(!kinds(deriveConsigneRules({ sources: src(t) })).includes("endsWithQuestion"), t);
  }
  const rules = deriveConsigneRules({ sources: src("Une question pour finir") });
  assert.equal(checkConsignes("Un constat.\n\nEt vous, que faites-vous ?", rules).length, 0);
  assert.equal(checkConsignes("Un constat.\n\nEt vous, que faites-vous ? 🙂", rules).length, 0, "un émoji final ne cache pas la question");
  assert.equal(checkConsignes("Un constat.\n\nEt vous, que faites-vous ?\n\n#qualité #industrie", rules).length, 0, "les hashtags finaux sont ignorés");
  const issues = checkConsignes("Un constat sans question.\n\n#qualité", rules);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, "warn");
  assert.match(issues[0].text, /terminer par une question/);
});

test("voix de la marque : lue en priorité pour un post de page, l'emporte sur les consignes personnelles, absente d'un post de profil", () => {
  const sources = [
    { origin: "Voix de la marque", text: "nous vouvoyons, phrases courtes, jamais de jargon", authority: true },
    { origin: "Consignes de style", text: "Je tutoie mon audience, pas d'émojis" },
  ];
  const page = deriveConsigneRules({ sources, orgVoice: true });
  const address = page.find((r) => r.kind === "address");
  assert.equal(address.side, "vous", "la voix de la marque l'emporte sur le tutoiement personnel");
  assert.equal(address.origin, "Voix de la marque");
  assert.ok(page.some((r) => r.kind === "noEmoji"), "les autres consignes restent contrôlées");
  assert.ok(page.some((r) => r.kind === "noFirstPersonSingular"));
  // Sans autorité (post de profil) : les deux consignes se contredisent, aucune règle de tutoiement n'est devinée
  const profile = deriveConsigneRules({ sources: sources.map(({ authority, ...s }) => s) });
  assert.ok(!profile.some((r) => r.kind === "address"));
  assert.ok(!profile.some((r) => r.kind === "noFirstPersonSingular"));
});

test("page entreprise : la première personne du singulier est signalée, « nous » et « notre » non ; hors français, aucun contrôle", () => {
  const rules = deriveConsigneRules({ orgVoice: true });
  assert.equal(checkConsignes("Nous accompagnons nos clients, notre équipe aussi.", rules).length, 0);
  assert.match(checkConsignes("J'ai rencontré un client.", rules)[0].text, /« j' »/);
  assert.match(checkConsignes("Mon équipe est fière.", rules)[0].text, /« mon »/);
  assert.equal(checkConsignes("Le mode d'emploi est simple.", rules).length, 0, "« mode » ne contient pas « mon »");
  assert.deepEqual(deriveConsigneRules({ orgVoice: true, language: "en" }), []);
});

test("route /api/consignes lit la voix de la marque avant les consignes de style, pour une page seulement (lecture du code)", () => {
  const route = fs.readFileSync(new URL("../app/api/consignes/route.js", import.meta.url), "utf8");
  assert.ok(route.includes("profile?.brandVoice") && route.includes("authority: true") && route.includes("orgVoice: org"));
  assert.ok(route.indexOf("Voix de la marque") < route.indexOf("Consignes de style"), "la voix de la marque est lue en premier");
  const page = fs.readFileSync(new URL("../app/app/page.js", import.meta.url), "utf8");
  assert.ok(page.includes("voiceKind={pair ?"));
});

test("formulations ajoutées : « ne dépasse jamais N hashtags » et « limite-toi à N hashtags »", () => {
  assert.equal(deriveConsigneRules({ sources: src("Ne dépasse jamais 3 hashtags") })[0].value, 3);
  assert.equal(deriveConsigneRules({ sources: src("Limite-toi à 3 hashtags") })[0].value, 3);
  assert.equal(deriveConsigneRules({ sources: src("Ne dépasse pas deux hashtags") })[0].value, 2);
  assert.deepEqual(deriveConsigneRules({ sources: src("Ne dépasse jamais 3 000 caractères") }), [], "sans le mot hashtag, aucune règle");
});

test("question finale : une signature après la question ne la masque pas", () => {
  const rules = deriveConsigneRules({ sources: src("Une question pour finir") });
  assert.equal(checkConsignes("Un constat.\n\nEt vous ?\n\n— Marie", rules).length, 0);
  assert.equal(checkConsignes("Un constat.\n\nEt vous ?\n\n- Marie Dupont, directrice\n\n#rh", rules).length, 0);
  assert.equal(checkConsignes("Un constat sans question.\n\n— Marie", rules).length, 1, "sans question, l'écart reste signalé");
});
