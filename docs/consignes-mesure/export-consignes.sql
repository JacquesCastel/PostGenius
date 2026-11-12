-- Export en lecture seule des consignes, SANS identifiant ni e-mail : uniquement le champ et le texte.
-- À lancer par Jacques sur la base de production (aucun secret à coller). Restreindre aux comptes de test ou à des comptes consentants :
-- remplacer les « TRUE » des clauses « AND TRUE » par « AND "id" IN ('…', '…') » (ou « AND "userId" IN (…) » pour les deux dernières requêtes).
-- Résultat : coller le tableau (champ ; texte) dans un fichier, puis : node scripts/consignes-mesure.mjs --export fichier.csv

SELECT 'styleNotes' AS champ, "styleNotes" AS texte FROM "User" WHERE length(trim(coalesce("styleNotes", ''))) > 0 AND TRUE
UNION ALL
SELECT 'editorialLine', "editorialLine" FROM "User" WHERE length(trim(coalesce("editorialLine", ''))) > 0 AND TRUE
UNION ALL
SELECT 'brandVoice', "brandVoice" FROM "User" WHERE length(trim(coalesce("brandVoice", ''))) > 0 AND TRUE
UNION ALL
SELECT 'remarque', "text" FROM "PostRemark" WHERE TRUE
UNION ALL
SELECT 'a-eviter', "text" FROM "LanguageElement" WHERE "kind" = 'avoid' AND TRUE;
