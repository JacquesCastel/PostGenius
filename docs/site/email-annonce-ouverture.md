# E-mail d'annonce de l'ouverture (anciens testeurs de la bêta)

> **Projet du 26 novembre 2026, à envoyer le jour de l'ouverture (fusion de la PR `ACCESS_MODE = "open"`), pas avant.** Les `[À DÉCIDER]` sont des choix de l'éditeur ; les `[À VÉRIFIER]` sont des faits à confirmer avant l'envoi. Rien dans ce texte ne promet de résultat sur LinkedIn.

## Avant l'envoi
1. **Décider ce que gardent les testeurs** (la phrase du 3ᵉ paragraphe) : accès gratuit prolongé de [À DÉCIDER : X jours / jusqu'au JJ mois], tarif de lancement, ou simple essai de 14 jours comme tout le monde.
2. **Vérifier** que la connexion LinkedIn des testeurs fonctionne après le changement de domaine (callback `vercea.app`) : se connecter avec un compte testeur et publier un brouillon de test. Si ce n'est pas sûr, remplacer « Rien à faire de votre côté » par « Si LinkedIn vous demande de vous reconnecter, c'est normal ».
3. **Base légale et désinscription** : c'est un message d'information à des utilisateurs existants, qui annonce aussi une offre payante. Garder le lien de désinscription (`unsubscribeUrl` de `lib/emailLayout.js`) et faire valider par le juriste la qualification (service ou prospection) avec les CGU.
4. **Liste d'envoi** : seulement les comptes testeurs actifs (pas les comptes désactivés, pas les clients d'agence qui n'ont pas souscrit eux-mêmes). Envoyer d'abord un test à soi-même (administration → e-mails).

## Objet
`Vercéa ouvre au public : ce qui change pour vous`

Texte d'aperçu : `LinkeePost devient Vercéa, avec de nouvelles offres. Voici ce qui vous concerne.`

## Corps
**Bonjour {prénom},**

Merci d'avoir testé le produit pendant la bêta. Vos retours ont servi : c'est grâce à eux que nous ouvrons aujourd'hui.

**Ce qui change.** LinkeePost s'appelle désormais **Vercéa**, et le site est sur **vercea.app**. Votre compte, vos sources et vos brouillons sont les mêmes. [À VÉRIFIER : Rien à faire de votre côté.]

**Ce que cela change pour vous.** [À DÉCIDER : phrase sur l'accès des testeurs. Exemple : « En remerciement, votre accès reste gratuit jusqu'au {date}. Ensuite, vous choisissez l'offre qui vous convient, ou vous ne faites rien : aucun prélèvement sans votre action. »]

**Les offres.** Vercéa est ouvert à tous avec 14 jours d'essai gratuit, sans carte bancaire. Trois offres, en euros hors taxes par mois : Essentiel 19 €, Pro 49 €, Agence 129 € (l'abonnement annuel équivaut à neuf mois). Le détail est sur la page des offres. Vous résiliez quand vous voulez, l'effet est à la fin de la période payée.

**Ce que nous continuons à faire.** Le produit signale les chiffres qui ne figurent pas dans vos documents avant publication ; il ne dit pas qu'un chiffre est juste, et il ne promet ni vues ni réactions. Vous relisez, vous décidez.

Une question, une remarque : répondez simplement à cet e-mail.

**Jacques** [À COMPLÉTER : signature et fonction]

**Bouton :** `Ouvrir Vercéa` → `https://vercea.app/app`
**Lien secondaire :** `Voir les offres` → `https://vercea.app/tarifs`
**Pied de page :** lien de désinscription ; adresse de l'éditeur (mentions légales).

## Version texte brut
Même contenu, sans mise en forme, avec les deux liens en clair (`emailText` de `lib/emailLayout.js`).

## À ne pas écrire
- « Gratuit pour toujours », « sans engagement » sans nuance, ou toute promesse de portée, de vues ou de croissance de l'audience.
- Un prix ou une date de fin d'accès qui ne correspondrait pas à ce que le produit applique réellement : vérifier la date de fin d'essai des comptes testeurs (`trialEndsAt`) avant de l'annoncer.
