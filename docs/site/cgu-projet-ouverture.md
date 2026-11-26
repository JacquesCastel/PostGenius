# Projet de CGU pour l'ouverture à la vente (à faire relire par un juriste)

> **Statut : projet de travail du 26 novembre 2026, rédigé par l'assistant, non validé juridiquement.** Il s'appuie sur les CGU actuelles (`lib/footer-pages.js`) et sur le comportement réel du produit (`lib/plans.js`, `lib/subscriptionChange.js`, webhook Stripe). Les passages entre crochets `[À DÉCIDER]` sont des choix de l'éditeur ; les `[À VÉRIFIER]` sont des points de droit à confirmer. Rien n'est publié : le texte se saisit dans l'administration (pages légales, « CGU »), ce qui n'exige aucun déploiement.

## Ce que ce projet change par rapport au texte actuel
1. **Tarifs** : renvoi à `/tarifs` (le texte actuel renvoie à la page d'accueil, qui n'affiche plus les tarifs), prix en euros HT, **TVA** ajoutée, **annuel** mentionné (le texte actuel parle d'un abonnement « mensuel » seulement alors que l'annuel existe).
2. **Renouvellement automatique** : absent aujourd'hui.
3. **Changement d'offre** : décrit selon le comportement réel (montée immédiate au prorata, descente en fin de période).
4. **Défaut de paiement** : absent aujourd'hui.
5. **Résiliation, remboursement, rétractation** : absents ou incomplets aujourd'hui.
6. **Fin de compte et données** : renvoi à la politique de confidentialité (30 jours après la clôture).
7. **Identité de l'éditeur** : renvoi aux mentions légales.

## Texte proposé

### 1. Objet et acceptation
Vercéa est un service en ligne (SaaS) d'aide à la création et à la gestion de publications LinkedIn : génération de contenus assistée par IA à partir des informations que vous fournissez, contrôles avant publication, programmation, publication via l'API officielle de LinkedIn et statistiques. Il est édité par la société identifiée dans les [mentions légales](/legal#mentions). En créant un compte, vous acceptez les présentes conditions générales d'utilisation et de vente (CGU).

### 2. Qui peut utiliser le service
Le service s'adresse à des **professionnels** (entreprises, indépendants, agences) agissant pour leurs besoins professionnels. Vous déclarez avoir la capacité d'engager la personne pour laquelle vous vous inscrivez. [À VÉRIFIER : traitement des très petites entreprises hors de leur champ d'activité principal, qui bénéficient de certaines règles du droit de la consommation.]

### 3. Compte et essai gratuit
L'inscription est libre. L'essai gratuit dure **14 jours**, sans carte bancaire et sans engagement. À la fin de l'essai, l'accès aux fonctionnalités nécessite un abonnement payant ; vos contenus restent consultables [À DÉCIDER : durée de conservation après la fin de l'essai sans abonnement]. Vous êtes responsable de la confidentialité de vos identifiants et de l'activité de votre compte.

### 4. Offres, prix et TVA
Les offres (Essentiel, Pro, Agence), leur contenu et leurs prix sont indiqués sur la page [Tarifs](/tarifs), en **euros hors taxes**. La TVA applicable est ajoutée au prix à la facturation. L'éditeur peut modifier ses prix ; la modification ne s'applique qu'à la période de facturation suivante, après information préalable [À DÉCIDER : délai de préavis, par exemple 30 jours].

### 5. Abonnement, paiement et renouvellement
L'abonnement est **mensuel** ou **annuel** au choix. Le paiement est dû **d'avance** pour chaque période, par carte bancaire via notre prestataire de paiement Stripe ; nous ne conservons pas vos coordonnées bancaires. L'abonnement se **renouvelle automatiquement** à chaque échéance, pour une durée identique, jusqu'à résiliation. La facturation annuelle correspond à neuf mois du prix mensuel [À VÉRIFIER : à reformuler si les prix de la page Tarifs changent]. Une facture est mise à disposition pour chaque paiement.

### 6. Changement d'offre
Le passage à une offre supérieure, ou du mensuel à l'annuel, prend effet **immédiatement** ; la différence est facturée au prorata du temps restant de la période. Le passage à une offre inférieure, ou de l'annuel au mensuel, prend effet **à la fin de la période déjà payée**.

### 7. Résiliation
Vous pouvez résilier à tout moment depuis votre espace (portail de facturation). La résiliation prend effet **à la fin de la période déjà payée** : vous gardez l'accès jusque-là, et aucun nouveau paiement n'est prélevé. L'éditeur peut suspendre ou résilier un compte en cas de manquement grave aux présentes CGU, après information, sauf urgence.

### 8. Remboursement et rétractation
[À DÉCIDER] Option A, la plus simple : **les sommes versées pour une période entamée ne sont pas remboursées**, sauf obligation légale ou geste commercial de l'éditeur ; l'essai gratuit permet de tester le service avant de payer. Option B : remboursement intégral sur demande dans les 14 jours suivant le premier paiement.
Le service étant destiné à des professionnels, le droit de rétractation du consommateur ne s'applique pas [À VÉRIFIER : exception éventuelle pour les très petites entreprises, voir article 2].

### 9. Défaut de paiement
Si un paiement échoue, nous vous en informons et retentons le prélèvement. Pendant la période de régularisation, l'accès est maintenu [À DÉCIDER : durée]. À défaut de régularisation, l'abonnement est interrompu et l'accès aux fonctionnalités payantes suspendu.

### 10. Vos contenus et les contenus générés
Vous restez titulaire des informations, documents et textes que vous nous fournissez, et vous nous autorisez à les traiter pour fournir le service, comme le décrit la [politique de confidentialité](/legal#confidentialite). Les textes générés sont des **propositions** : vous restez seul responsable de ce que vous publiez sur LinkedIn, de son exactitude et de sa conformité au droit applicable et aux conditions de LinkedIn. Le contrôle des chiffres est **indicatif** : il signale les chiffres absents de vos informations, il ne prouve pas qu'un chiffre est exact. [À VÉRIFIER : titularité des droits sur les contenus générés par IA.]

### 11. Usage raisonnable
Les offres décrites comme « illimitées » s'entendent pour un usage individuel raisonnable. Des limites techniques peuvent s'appliquer pour préserver la qualité du service. Tout usage abusif, automatisé hors des fonctionnalités prévues, ou contraire aux conditions de LinkedIn peut entraîner la suspension du compte.

### 12. Disponibilité et responsabilité
Le service est fourni avec une cible de disponibilité élevée, sans garantie de continuité absolue, notamment en cas de maintenance ou d'indisponibilité de services tiers (LinkedIn, fournisseurs d'IA). Sauf faute lourde ou dol, et dans les limites permises par la loi, la responsabilité de l'éditeur est limitée aux sommes versées au cours des douze derniers mois [À VÉRIFIER : clause à faire valider, certaines limitations sont sans effet entre professionnels si elles vident l'obligation essentielle de son sens].

### 13. Données personnelles et fin du compte
Le traitement des données personnelles est décrit dans la [politique de confidentialité](/legal#confidentialite). Les données du compte sont supprimées dans un délai de 30 jours après la clôture du compte, sauf conservation imposée par la loi (par exemple les factures).

### 14. Modification des CGU
Nous pouvons modifier les présentes CGU. Pour les abonnés, toute modification substantielle est notifiée [À DÉCIDER : délai, par exemple 30 jours] avant son application ; la poursuite de l'utilisation vaut acceptation, et vous pouvez résilier si elle ne vous convient pas.

### 15. Droit applicable et litiges
Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée en priorité ; à défaut, les tribunaux compétents de **Paris** seront seuls compétents, entre professionnels.

## Décisions attendues de l'éditeur
1. Remboursement : option A (aucun remboursement d'une période entamée) ou B (14 jours) ?
2. Durée de maintien de l'accès pendant un défaut de paiement.
3. Préavis de changement de prix et de modification des CGU.
4. Conservation des contenus après la fin de l'essai sans abonnement.

## Points à faire valider par un juriste
- Règles applicables aux très petites entreprises (articles 2 et 8).
- Clause de limitation de responsabilité (article 12).
- Titularité des contenus générés (article 10).
- Mention des CGV dans l'espace de paiement Stripe (case ou lien vers les CGU avant le paiement) : à brancher dans le parcours d'achat si le juriste le demande.
