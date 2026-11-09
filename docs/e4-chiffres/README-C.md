# Condition C : générer avec le vrai moteur LinkeePost (mode d'emploi)

Script : `scripts/e4-generate-c.mjs` (tests : `scripts/e4-generate-c.test.mjs`). 20 textes : `C-S01…C-S10` (consigne chiffrée) et `CN-S01…CN-S10` (consigne neutre).

## Ce que le script fait, et les choix à connaître
- **Moteur** : le vrai `POST /api/generate`, non modifié, moteur A par défaut. Le serveur doit tourner **sans** variable `EDITORIAL_ENGINE` (le script refuse de partir si elle est définie dans son propre environnement, mais ne peut pas voir celle du serveur : à vérifier).
- **Code** : le protocole demande le code de `main` au commit `421c37f`. Le script enregistre le commit réellement utilisé (`git rev-parse HEAD`) dans chaque enregistrement ; le noter au journal.
- **Consigne** : le *thème* envoyé au moteur est la consigne de base **mot pour mot** du fichier gelé (`A-Sxx` pour C, `AN-Sxx` pour CN), qui garde « 150 à 250 mots » et, pour C, « Ajoute des chiffres concrets… ». Le moteur l'insère dans son propre prompt : c'est le produit tel qu'il est.
- **Fiche** : lignes `F1…Fn` du fichier gelé, transmises comme **matière source** (titre « Fiche de faits »). Ce n'est pas la formule « Voici les informations dont tu disposes » de la condition B : le moteur a sa propre formulation, et c'est ce que C mesure.
- **Profil** : un seul compte neutre pour les 20 textes (titre « Professionnel B2B », style « Ton sobre et direct. Phrases courtes. », rien d'autre). Le profil lu en base est vérifié avant la génération et enregistré avec chaque texte.
- **Longueur** : `maxChars` = 1700 (150 à 250 mots ≈ 1 000 à 1 700 caractères). **Valeur choisie par l'assistant, non prévue par le protocole** : à confirmer et à publier avant de générer (`--max-chars`).
- **Une génération par texte**, jamais de régénération ; relance seulement si aucune réponse n'est reçue (réseau, 429, 5xx). Une erreur 4xx ou un texte vide est conservé et signalé.
- **Non couvert par le gel** : ce script n'est pas dans le gist public du 9 novembre. Publier un complément (script, README, empreintes) **avant** de générer.

## Sur le serveur
Prérequis : Node 22, PostgreSQL, le dépôt à jour sur la branche, `npm ci`, **une base jetable ou une copie, jamais la production**.

```bash
npm ci
```
```bash
cp .env.example .env
```
Dans `.env` : `DATABASE_URL` (base jetable), `AUTH_SECRET` (une valeur aléatoire), `ANTHROPIC_API_KEY` (votre clé), pas de `EDITORIAL_ENGINE`.
```bash
npx prisma migrate deploy
```
```bash
npm run build
```
```bash
npm start
```
Dans un second terminal :
```bash
E4_C_DB_OK=1 node --env-file=.env scripts/e4-generate-c.mjs seed
```
```bash
node --env-file=.env scripts/e4-generate-c.mjs generate --base http://localhost:3000 --out data/e4/run1-C
```
Puis copier `data/e4/run1-C/*.json` dans `docs/e4-chiffres/enregistrements-C/`, vérifier qu'aucun fichier ne contient de clé (`grep -l "sk-ant" …`), commiter et pousser.
