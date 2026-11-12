# Feuille de route : fiche de vérification par post (décision du 11 novembre 2026)

**Statut : inscrite à la feuille de route, non lancée.** Elle touche le cœur du produit et passe après la publication de la série.

## Calendrier validé
1. Article 2, puis article E4, puis article 1.
2. Démonstration éditoriale (génération, mesure, publication de `/preuves/demo`).
3. Second jeu non vu pour la mesure de « Chiffres à vérifier » (textes de la démonstration, classés avec la grille E4, idéalement par une autre personne). La mesure actuelle (`docs/e4-chiffres/mesure-figurecheck/`) reste **exploratoire**.
4. Fiche de vérification, dans cet ordre :
   1. **Fiche lisible**, sans hash : chiffres retrouvés, signalés, décision de l'auteur (gardé, corrigé, retiré), version du contrôle, date.
   2. **Hash et signature** : JSON canonique (UTF-8), SHA-256, signature Ed25519 par une clé du serveur, chaînage au hash précédent.
   3. **Horodatage externe** (RFC 3161 auprès d'une autorité tierce, ou publication régulière de la tête de chaîne sur `/preuves`) : sans lui, le hash ne prouve rien.
   4. **Outil de vérification ouvert** : on colle le texte et la fiche, on recalcule, on compare.

## Décisions à prendre avant l'étape 4.2
- Où vit la clé de signature, qui la renouvelle, ce qui se passe si elle est compromise.
- Confidentialité : empreintes des sources avec sel, jamais le contenu ; option activée par l'utilisateur, jamais par défaut ; durée de conservation compatible avec `/securite` et `/privacy-policy`.
- Formulation : une fiche prouve que **ce texte** a été validé **à cette date** après **ce contrôle**. Elle ne prouve pas que les chiffres sont exacts. Jamais « certifié », jamais « garanti ».

## Ce qui reste interdit
Aucune affirmation « différent du marché » sans relevé de marché daté et sourcé, et pas de relevé prévu. La seule formule bornée envisageable, **après le second jeu non vu** : « nos contrôles ont des performances mesurées et publiées ».
