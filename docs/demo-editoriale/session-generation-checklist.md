# Check-list de la session de génération (démonstration éditoriale)

La session ne sert **plus qu'à une chose** : les **quatre générations** de la démonstration (BELVANTE INDUSTRIE, CANTEVEL Conseil, Mathis Vauberlet, témoin), E4 étant terminé. Si autre chose doit être regroupé dans cette session, le dire **avant** de commencer.

**Ordre impératif : profils figés et publiés, puis session.** Si un profil change après le gel, les empreintes sont à refaire.

## A. Avant la session (par Jacques)
- [ ] Profil de l'expert relu et validé (`lib/demoEditorialCore.mjs`, identité `expert`), noms vérifiés (`verification-noms-fictifs.md` ; facultatif : registres Infogreffe / INPI).
- [ ] Protocole de test relu (`protocole-test.md`, section « Décisions du 10 novembre 2026 ») : les seuils s'appliquent à trois profils, aucun changement.
- [ ] **Gel publié** : gist public daté contenant les fichiers et le tableau d'empreintes de `gel-demo-empreintes.md` ; adresse et heure notées dans `journal-generation.md`.
- [ ] La clé `ANTHROPIC_API_KEY` ajoutée **par vous** dans les paramètres de l'environnement (menu de l'environnement, Edit, variables d'environnement) : le nom est réservé aux outils de session, qui ne peuvent pas la poser. **Jamais dans le chat.** Une nouvelle session est nécessaire pour qu'elle soit prise en compte.

## B. Au début de la session (par l'assistant, avec vérifications affichées)
- [ ] La variable existe, sans l'afficher : `test -n "$ANTHROPIC_API_KEY" && echo présente`.
- [ ] **Le gel est respecté** : `node scripts/demo-gel-check.mjs` affiche « Gel respecté » (les quatre fichiers du gist et les fichiers du moteur ont exactement les empreintes publiées). En cas d'écart, **ne rien générer**.
- [ ] **Moteur intact** : couvert par le script ci-dessus (route de génération et modules importés) ; commit de référence du gel noté ; `EDITORIAL_ENGINE` non défini (moteur A par défaut) ; `ANTHROPIC_MODEL` non défini ou égal à `claude-sonnet-4-6`.
- [ ] Aucun simulateur, aucune variable `DEMO_EDITORIALE_FIXTURE`.
- [ ] **Base isolée** : PostgreSQL local jetable (jamais Neon de production ni la base de l'application) ; `DEMO_EDITORIALE_DB_OK=1` ; l'hôte affiché par le script est `localhost`.

## C. Génération
1. `npm ci`, `npx prisma db push`, `npm run build`, puis `PORT=<port dédié> npm start` (un seul processus ; ne jamais arrêter un processus par son nom : un conteneur de production peut tourner sur la machine).
2. `DEMO_EDITORIALE_DB_OK=1 node --env-file=.env scripts/demo-editorial.mjs seed` (quatre comptes isolés).
3. `node --env-file=.env scripts/demo-editorial.mjs generate --base http://localhost:<port> --runs 1` : **une seule génération par identité**, aucune sélection.
4. Chaque enregistrement contient la **requête**, le **profil lu en base au moment de l'appel**, le **contexte rapporté par le moteur** et la **réponse brute**, avec une **empreinte SHA-256** (`candidates.json`).
5. En cas d'échec **sans réponse** (réseau, 429, 5xx) : relancer **seulement** cette identité, **consigner** l'échec et la relance. Une réponse reçue est conservée telle quelle ; **jamais** de régénération pour obtenir un texte plus flatteur.
6. `list` (lecture), puis `publish --belvante <id> --cantevel <id> --expert <id> --temoin <id>` : avec `--runs 1`, **il n'y a aucun choix à faire**. Puis `verify`.
7. Copier `data/demo-editoriale/candidates.json` dans le dépôt (le dossier `data/` est ignoré par git) pour conserver les enregistrements bruts ; vérifier qu'aucune clé n'y figure (`grep -l "sk-ant"`).
8. Ne jamais éditer `content/demo-editoriale.json` à la main. Ne pas déployer sans validation de Jacques.

## D. Après la session : révocation (même procédure qu'E4)
- [ ] **Supprimer la variable** `ANTHROPIC_API_KEY` de l'environnement (Edit) ; l'assistant relit la configuration pour confirmer (`environment_variable_names` vide, aucun secret réseau, aucun hôte).
- [ ] **Révoquer la clé** dans la console Anthropic. Si c'est la clé de production, la remplacer **d'abord** (comparer les quatre derniers caractères sans les afficher), puis révoquer l'ancienne.
- [ ] Arrêter l'application par son numéro de processus ; supprimer la base jetable, le `.env`, les comptes locaux (`data/demo-editoriale/accounts.json`) ; vider l'historique du terminal.
- [ ] Contrôler qu'aucune trace de clé ne reste : `grep -rIl "sk-ant-" . --exclude-dir=node_modules --exclude-dir=.git` (le README contient l'exemple `sk-ant-...`, sans clé).
- [ ] Contrôler la production en générant un post.
- [ ] Noter chaque étape dans `journal-generation.md`.

## Interdits (inchangés)
Créer une fixture ; retoucher un texte ; relancer jusqu'à obtenir un texte plus flatteur sans l'annoncer ; modifier le moteur, un profil ou le sujet après le gel ; publier quoi que ce soit sur LinkedIn ; mettre une clé dans le chat, un commit ou un gist.
