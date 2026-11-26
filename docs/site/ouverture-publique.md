# Ouverture publique (passage de la bêta fermée à la vente)

Décision du 26 novembre 2026 : démarrage par **14 jours d'essai gratuit sans carte**, prix actuels (Essentiel 19 €, Pro 49 €, Agence 129 € par mois HT, annuel = 9 mois).

## Ce que change `ACCESS_MODE = "open"` (`lib/access.js`)
- Tous les textes passent de « Bêta fermée / Demander une invitation » à « Essai gratuit, sans carte bancaire / Démarrer gratuitement » (en-tête, accueil, tarifs, contact, écran d'inscription).
- Les boutons mènent à `/app` (inscription libre) au lieu de `/beta`.
- La page `/beta` reste en ligne (non référencée) ; son texte parle encore de bêta fermée. À rediriger ou retirer après l'ouverture.
- Les invitations déjà envoyées (e-mail « bêta fermée », `lib/invites.js`) gardent leur texte.

## À faire avant de fusionner
1. CGU relues (renouvellement automatique, TVA, rétractation, remboursement) : administration → pages légales.
2. Stripe en mode réel : voir `STRIPE.md` §6 (produits « Vercéa … », webhook sur `https://vercea.app/api/stripe/webhook`, portail client).
3. Un achat réel de bout en bout (abonnement, facture, résiliation, remboursement).

## Le jour J
1. Fusionner la PR, `./deploy.sh`.
2. Technique → Actions : rouvrir les inscriptions (`signupsClosed` à faux).
3. Contrôler : `/tarifs` sans le mot « bêta », bouton d'inscription vers `/app`, inscription d'un compte test jusqu'à l'essai.

## Retour arrière
Remettre `ACCESS_MODE = "beta"`, redéployer, et refermer les inscriptions dans Technique → Actions.
