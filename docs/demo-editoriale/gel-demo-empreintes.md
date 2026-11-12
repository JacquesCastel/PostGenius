# Gel de la démonstration éditoriale : empreintes SHA-256

**Statut : prêt à publier. Rien n'a été généré.** Établi le 10 novembre 2026, **avant** la session de génération des quatre textes. Les fichiers figés ci-dessous sont ceux du commit `56c6a7fde208467d058274bcdb12ca0b63278721` (branche `claude/funny-goodall-f2dvgs`) ; le commit qui ajoute cette page ne modifie aucun d'entre eux. Tout changement d'un seul caractère de l'un d'eux après la publication invalide le gel : les empreintes et les générations seraient à refaire.

## Ce qui est figé

**Les quatre fichiers du gist** (mêmes noms dans le gist) :

| Fichier du gist | Chemin dans le dépôt | SHA-256 | Ce qu'il fige |
|---|---|---|---|
| `demoEditorialCore.mjs` | `lib/demoEditorialCore.mjs` | `809a927dff1fabe5c6e143d7dc3dacde5a7a073c2ddc5f2ed173cc99b9719b7d` | le sujet commun, les trois profils et le témoin, les consignes de style, la validation des exemples |
| `demo-editorial.mjs` | `scripts/demo-editorial.mjs` | `5379b63a5d318e20396e52ec5db457a3abb956beba6e2fdfca521dd4511ca63b` | le dispositif de génération, d'enregistrement et de publication (`--runs 1` par défaut) |
| `protocole-test.md` | `docs/demo-editoriale/protocole-test.md` | `979aeb5514f5e98562067e9be0a31de85108867578c6f3ebacd1f240913a69d9` | le protocole du test d'appariement et ses seuils (40 %, 60 %) |
| `session-generation-checklist.md` | `docs/demo-editoriale/session-generation-checklist.md` | `38d74b379ae02ed7ad8acb4f002a8ae9fb177192103ac2d75036e9a781f8c1b3` | la procédure de la session de génération et ses règles |

**Le moteur de génération** (non copié dans le gist ; empreintes à vérifier dans le dépôt) : la route de génération et les modules qu'elle importe directement.

| Chemin dans le dépôt | SHA-256 |
|---|---|
| `app/api/generate/route.js` | `fd60408f9d667f97fcbfed797882740bb1761f9262f236fd0481503e656305b7` |
| `lib/contextOverlay.js` | `fed2c9bbb39678e94e66a2abb821749d9c7e2377266fb9d43d71b4bb57112de8` |
| `lib/contexts.js` | `a35cf3f94f98ed05d580d830646afb2bf428428c793eab498b7d862a9a714e31` |
| `lib/db.js` | `2b62d9c4de9b2717303abde8e02c2ce225c91e377fca87e3b45b360c24776032` |
| `lib/figureCheck.js` | `0558e89c16b1ae6cf9d6a01013283e2c5d5e29602d12d12eae9c3c6a997e221a` |
| `lib/gating.js` | `2585bcce52b0ef2a46b7f1016afbe67cf82f4aa020cd6978682b7555a53d57c1` |
| `lib/generationSource.js` | `c36be7e34e738005bb0085d96a582eec316dea63b4f0341a6dcf8e1ec64e0a0f` |
| `lib/knowledge.js` | `40ae2a9d703bf9d38a5c0e0710778319badbd2fc0371455a26522e664560a488` |
| `lib/knowledgeText.js` | `d1d78fa113c90cb76c25cdd976ef5cab88ce7c99bf92a7a895d42ca9619b7355` |
| `lib/languageElements.js` | `bd7aa1eafa56684b6ba7c6d7f4102d59a607640f34dc73e65566034b85bb35ed` |
| `lib/languageStore.js` | `06966f78e2c2979d9160be634459aa604d292e7ec7d99b7a59876024e7eb84a8` |
| `lib/languages.js` | `bd36a5c1dfd1973f8a1cf52e90748ae81a91924b1576a430c8b748901e6a7036` |
| `lib/linkedinRules.js` | `08106fa65f636455d24427065e265ceaf632c3b9457621f07fe21bfbc8f08fc5` |
| `lib/moments.js` | `4c95135b782ed6e60d7d634910fd3560528bc7c2361205725bb284ab933ab4ba` |
| `lib/moods.js` | `1674ee17d5aaf68384edbe27061ddc19b9378371ba60019038a70c9360a1c47d` |
| `lib/postContext.js` | `6030960deed597d87dd624478cd099661089e597fd5abb163c3c087bca0ced3e` |
| `lib/postMemory.js` | `55051e07888d21f944925dc01f5dc7aae5f51f54803f0f22d7065db8c07f42e4` |
| `lib/publishVoice.js` | `96649fda546a6c4314e4d3e56215d0c5a315dadd49a57e54d0e8617f5144c9da` |
| `lib/refineChat.js` | `ae79db3b1fa0d52492a2a166dcbbc8cd971efeb0e05f78f6663179cffacf271d` |
| `lib/remarks.js` | `9555f38eeaf82a514f398d26b0a1fafad693f3a63634c3568212ad65514256be` |
| `lib/session.js` | `bca1610b16d46c6e2ee7d43276aa505626b6f986436109fc3be204886ebf1a5e` |
| `lib/shootingKit.js` | `bf1d9fb67491ffb67916eb4cd2dd9330edd07d3d50b7e7bf9cc6fd4dd6ad2cef` |
| `lib/styleCorpus.js` | `e74a0236e7f7f7865d96982f84238dc4dbd2a055166119ee2a1a83859e1fe9f6` |
| `lib/usage.js` | `5ee6c279e4fc8c750c5b0f786f477dd428d3979226adcbab465aa04ae493df6e` |

Un module importé indirectement n'est pas couvert : c'est une limite, que le commit de référence ci-dessus complète.

## Ce que fige `demoEditorialCore.mjs`
- **Le sujet commun**, mot pour mot (367 caractères) : une tolérance de fabrication trop contraignante, aucun gain chiffré connu.
- **Trois profils fictifs** : BELVANTE INDUSTRIE (PME d'usinage de précision), CANTEVEL Conseil (cabinet de conseil en achats industriels), Mathis Vauberlet, Vauberlet Conseil (consultant et formateur indépendant en cotation fonctionnelle), **et un témoin sans profil**. Noms vérifiés dans les registres le 10 novembre 2026 (`verification-noms-fictifs.md`, document d'accompagnement non figé).
- **Les mêmes consignes de style pour les quatre** : « Phrases courtes et concrètes. Aucun jargon. Pas d'exagération. Aucun chiffre inventé : si un chiffre n'est pas fourni, n'en donne pas. »
- Le **type** de post (simple), la **longueur maximale** (1 300 caractères) et la **langue** (français) sont ceux de `demo-editorial.mjs`.

## Conditions de génération (écrites avant)
- **Moteur** : `EDITORIAL_ENGINE` non défini (moteur A par défaut) ; `ANTHROPIC_MODEL` non défini ou égal à `claude-sonnet-4-6` ; base de démonstration jetable, jamais la production.
- **Une seule génération par identité** (`--runs 1`) : **aucun choix** entre plusieurs essais, aucune sélection du « meilleur ».
- **Échec sans réponse** (réseau, 429, 5xx) : relance de cette identité seulement, consignée. **Toute réponse reçue est conservée telle quelle** ; jamais de régénération pour obtenir un texte plus flatteur.
- **Enregistrement** de chaque génération : requête, profil lu en base au moment de l'appel, contexte rapporté par le moteur, réponse brute, empreinte SHA-256 de l'enregistrement.
- **Publication** des quatre textes **sans modification**, puis vérification des empreintes au chargement de la page.
- **Révocation** de la clé de génération à l'issue de la session.

## Vérifier soi-même
Dans le dépôt, avant toute génération :

```bash
node scripts/demo-gel-check.mjs
```

La commande doit afficher « Gel respecté ». Pour les quatre fichiers du gist, `sha256sum <fichier>` doit donner l'empreinte du tableau.

## Ce que le gel garantit, et ce qu'il ne garantit pas
Il garantit que ces fichiers n'ont pas changé depuis la publication. Il **ne garantit pas** qu'aucun texte n'a été trié : ce sont la règle « une génération, aucune sélection » et la publication intégrale des enregistrements qui y répondent. Une empreinte n'est pas une signature : quelqu'un ayant accès au dépôt pourrait la recalculer ; la preuve de fond reste l'historique daté du gist et du dépôt.

Les entreprises et la personne de la démonstration sont fictives ; toute ressemblance avec des entreprises ou des personnes réelles serait fortuite.
