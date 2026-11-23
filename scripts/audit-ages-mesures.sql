-- Audit n° 2 : âges réels des mesures, posts sans mesure, traçabilité de « Que publier ? », origine campagne — STRICTEMENT EN LECTURE SEULE.
--
-- Complète scripts/audit-profondeur-mesures.sql. Sert à :
--   1. régler les fenêtres de comparaison J+1 / J+7 d'après les âges RÉELS des mesures (plutôt qu'à l'estime) ;
--   2. expliquer les posts publiés qui n'ont aucune mesure ;
--   3. distinguer un défaut de traçabilité technique d'un comportement d'usage pour « Que publier ? » ;
--   4. mesurer ce que les campagnes peuvent apporter comme qualification.
--
-- Lancer :  scripts/audit-profondeur.sh        (lance les deux audits, garde le résultat daté dans data/audits/)
--       ou  psql "$DATABASE_URL" -f scripts/audit-ages-mesures.sql
--
-- Mêmes garanties que le premier audit : transaction en LECTURE SEULE ; uniquement des comptages (jamais d'adresse, d'identifiant ni de texte) ;
-- un comptage de 1 ou 2 est affiché « <3 » ; l'unité est le POST (jamais la ligne de mesure, sauf la répartition par âge, où chaque
-- (post, palier) est unique) ; comptes suspendus exclus ; âge réel = capturedAt − publishedAt.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH
users AS (SELECT id FROM "User" WHERE NOT disabled),
posts AS (
  SELECT d.id, d."userId", d."createdAt", d."publishedAt", d.theme, d."pillarId", d."campaignId", d."campaignPostId",
         CASE WHEN d.target = 'person' THEN 'profil'
              WHEN d.target LIKE 'urn:li:organization:%' THEN 'page' ELSE 'autre' END AS dest
  FROM "Draft" d JOIN users u ON u.id = d."userId"
  WHERE d.status = 'publié' AND d."postId" IS NOT NULL AND d."publishedAt" IS NOT NULL
),
meas AS (
  SELECT p.id AS draft_id, p."userId", p.dest, pp."offsetHours" AS label,
         EXTRACT(EPOCH FROM (pp."capturedAt" - p."publishedAt")) / 3600.0 AS age
  FROM posts p JOIN "PostPerformance" pp ON pp."draftId" = p.id
),
-- 1. répartition de l'âge réel, par étiquette de palier
age_bins AS (
  SELECT label, dest,
    CASE WHEN age < 20 THEN '01 moins de 20 h' WHEN age < 24 THEN '02 20 à 24 h' WHEN age < 30 THEN '03 24 à 30 h'
         WHEN age < 48 THEN '04 30 à 48 h' WHEN age < 72 THEN '05 48 à 72 h' WHEN age < 144 THEN '06 72 à 144 h'
         WHEN age < 156 THEN '07 144 à 156 h' WHEN age < 168 THEN '08 156 à 168 h' WHEN age < 180 THEN '09 168 à 180 h'
         WHEN age < 192 THEN '10 180 à 192 h' WHEN age < 240 THEN '11 192 à 240 h' ELSE '12 plus de 240 h' END AS bin
  FROM meas WHERE label IN (24, 168)
),
-- 2. fenêtres candidates : combien de posts et de comptes (8 posts ou plus) selon la largeur de la fenêtre
variants(v, lo, hi) AS (VALUES
  ('J+7 actuelle (144-240 h)', 144, 240), ('J+7 serrée (156-192 h)', 156, 192), ('J+7 très serrée (160-180 h)', 160, 180),
  ('J+1 actuelle (20-72 h)', 20, 72), ('J+1 serrée (24-48 h)', 24, 48), ('J+1 très serrée (24-30 h)', 24, 30)
),
post_variant AS (
  SELECT v.v, p."userId", p.dest, p.id
  FROM variants v
  JOIN posts p ON p.dest IN ('profil', 'page')
  WHERE EXISTS (SELECT 1 FROM meas m WHERE m.draft_id = p.id AND m.age BETWEEN v.lo AND v.hi)
),
acc_variant AS (SELECT v, dest, "userId", count(DISTINCT id) AS n FROM post_variant GROUP BY v, dest, "userId"),
-- 3. posts publiés sans AUCUNE mesure : trop récents, ou non mesurés, et canal de mesure connecté ou non
unmeasured AS (
  SELECT p.dest,
    CASE WHEN EXTRACT(EPOCH FROM (now() - p."publishedAt")) / 3600.0 < 20 THEN '1 trop récent (moins de 20 h)'
         WHEN EXTRACT(EPOCH FROM (now() - p."publishedAt")) / 3600.0 <= 240 THEN '2 âge normal (20 h à 10 jours), non mesuré'
         ELSE '3 ancien (plus de 10 jours), non mesuré' END AS age_class,
    CASE WHEN p.dest = 'profil' AND EXISTS (SELECT 1 FROM "LinkedInAccount" l WHERE l."userId" = p."userId" AND l."statsToken" IS NOT NULL) THEN 'canal de mesure connecté'
         WHEN p.dest = 'page' AND EXISTS (SELECT 1 FROM "LinkedInAccount" l WHERE l."userId" = p."userId" AND l."orgToken" IS NOT NULL) THEN 'canal de mesure connecté'
         ELSE 'canal de mesure NON connecté' END AS channel,
    -- avant la première lecture du canal pour ce compte, le post n'était pas mesurable ; après, une mesure manque vraiment
    CASE WHEN fr.first_read IS NULL THEN 'aucune lecture du canal pour ce compte'
         WHEN p."publishedAt" < fr.first_read - interval '1 day' THEN 'publié avant la première lecture du canal (non mesurable)'
         ELSE 'publié après la première lecture du canal (mesure manquante)' END AS phase
  FROM posts p
  LEFT JOIN LATERAL (
    SELECT CASE WHEN p.dest = 'profil'
                THEN (SELECT min(sn."createdAt") FROM "StatSnapshot" sn WHERE sn."userId" = p."userId")
                ELSE (SELECT min(pp2."capturedAt") FROM "PostPerformance" pp2 JOIN "Draft" d3 ON d3.id = pp2."draftId"
                      WHERE d3."userId" = p."userId" AND d3.target LIKE 'urn:li:organization:%') END AS first_read
  ) fr ON true
  WHERE p.dest IN ('profil', 'page') AND NOT EXISTS (SELECT 1 FROM "PostPerformance" pp WHERE pp."draftId" = p.id)
),
-- 4. « Que publier ? » : propositions, brouillons liés, provenance probable par le thème
-- (en cliquant « Générer », l'application écrit le thème « sujet — angle » : on le retrouve dans les brouillons de la même personne)
recos AS (SELECT r.id, r."userId", r.status, r.topic, r."draftId", r."createdAt" FROM "EditorialRecommendation" r JOIN users u ON u.id = r."userId"),
probable AS (
  SELECT DISTINCT d.id AS draft_id, d.status, d."pillarId", d."publishedAt",
         EXISTS (SELECT 1 FROM "EditorialRecommendation" r2 WHERE r2."draftId" = d.id) AS linked,
         EXISTS (SELECT 1 FROM "PostPerformance" pp WHERE pp."draftId" = d.id) AS measured
  FROM "Draft" d
  JOIN users u ON u.id = d."userId"
  JOIN recos r ON r."userId" = d."userId"
    AND left(d.theme, length(r.topic) + 3) = r.topic || ' — '
    AND d."createdAt" >= r."createdAt"
),
-- 5. campagnes : posts mesurés selon leur rattachement
measured_posts AS (SELECT p.* FROM posts p WHERE EXISTS (SELECT 1 FROM "PostPerformance" pp WHERE pp."draftId" = p.id)),
out AS (
  SELECT 100 AS ord, 'Âge réel des mesures étiquetées J+1 (24)' AS section, dest || ' · ' || bin AS label, count(*)::bigint AS n, NULL::bigint AS total
    FROM age_bins WHERE label = 24 GROUP BY dest, bin
  UNION ALL
  SELECT 110, 'Âge réel des mesures étiquetées J+7 (168)', dest || ' · ' || bin, count(*), NULL FROM age_bins WHERE label = 168 GROUP BY dest, bin
  UNION ALL
  SELECT 200, 'Fenêtres candidates : posts comparables', dest || ' · ' || v, count(DISTINCT id), NULL FROM post_variant WHERE dest IN ('profil','page') GROUP BY dest, v
  UNION ALL
  SELECT 210, 'Fenêtres candidates : comptes à 8 posts ou plus', dest || ' · ' || v, count(*) FILTER (WHERE n >= 8), count(*) FROM acc_variant GROUP BY dest, v
  UNION ALL
  SELECT 300, 'Posts publiés sans aucune mesure', dest || ' · ' || age_class || ' · ' || channel, count(*), NULL FROM unmeasured GROUP BY dest, age_class, channel
  UNION ALL
  SELECT 310, 'Posts publiés sans aucune mesure : avant ou après la première lecture du canal', dest || ' · ' || phase, count(*), NULL FROM unmeasured GROUP BY dest, phase
  UNION ALL
  SELECT 400, '« Que publier ? » : propositions', 'propositions créées (comptes non suspendus)', count(*), NULL FROM recos
  UNION ALL SELECT 401, '« Que publier ? » : propositions', 'passées au statut « générée » (clic sur Générer)', count(*), NULL FROM recos WHERE status = 'générée'
  UNION ALL SELECT 402, '« Que publier ? » : propositions', 'passées au statut « planifiée » (pilote automatique)', count(*), NULL FROM recos WHERE status = 'planifiée'
  UNION ALL SELECT 403, '« Que publier ? » : propositions', 'ignorées ou rejetées', count(*), NULL FROM recos WHERE status IN ('ignorée', 'rejetée')
  UNION ALL SELECT 404, '« Que publier ? » : propositions', 'avec un brouillon relié (recommendation.draftId renseigné)', count(*), NULL FROM recos WHERE "draftId" IS NOT NULL
  UNION ALL SELECT 410, 'Brouillons avec pilier', 'tous statuts (pillarId renseigné)', count(*), NULL
    FROM "Draft" d JOIN users u ON u.id = d."userId" WHERE d."pillarId" IS NOT NULL
  UNION ALL SELECT 411, 'Brouillons avec pilier', 'publiés', count(*), NULL FROM posts WHERE "pillarId" IS NOT NULL
  UNION ALL SELECT 420, 'Provenance probable « Que publier ? » (thème « sujet — angle »)', 'brouillons dont le thème reprend une proposition', count(*), NULL FROM probable
  UNION ALL SELECT 421, 'Provenance probable « Que publier ? » (thème « sujet — angle »)', 'dont reliés à la proposition (draftId)', count(*), count(*) FROM probable WHERE linked
  UNION ALL SELECT 422, 'Provenance probable « Que publier ? » (thème « sujet — angle »)', 'dont avec un pilier', count(*), NULL FROM probable WHERE "pillarId" IS NOT NULL
  UNION ALL SELECT 423, 'Provenance probable « Que publier ? » (thème « sujet — angle »)', 'dont publiés', count(*), NULL FROM probable WHERE status = 'publié'
  UNION ALL SELECT 424, 'Provenance probable « Que publier ? » (thème « sujet — angle »)', 'dont mesurés', count(*), NULL FROM probable WHERE measured
  UNION ALL SELECT 500, 'Posts mesurés selon leur rattachement', 'plan de campagne (campaignPostId)', count(*), (SELECT count(*) FROM measured_posts) FROM measured_posts WHERE "campaignPostId" IS NOT NULL
  UNION ALL SELECT 501, 'Posts mesurés selon leur rattachement', 'campagne automatique (campaignId, sans plan)', count(*), NULL FROM measured_posts WHERE "campaignId" IS NOT NULL AND "campaignPostId" IS NULL
  UNION ALL SELECT 502, 'Posts mesurés selon leur rattachement', 'ni campagne ni proposition probable', count(*), NULL
    FROM measured_posts m WHERE m."campaignId" IS NULL AND m."campaignPostId" IS NULL AND NOT EXISTS (SELECT 1 FROM probable pr WHERE pr.draft_id = m.id)
  UNION ALL SELECT 510, 'Posts mesurés d''un plan de campagne : qualification disponible', 'avec objectif renseigné', count(*), (SELECT count(*) FROM measured_posts WHERE "campaignPostId" IS NOT NULL)
    FROM measured_posts m JOIN "CampaignPost" cp ON cp.id = m."campaignPostId" WHERE cp.objective <> ''
  UNION ALL SELECT 511, 'Posts mesurés d''un plan de campagne : qualification disponible', 'avec angle renseigné', count(*), NULL
    FROM measured_posts m JOIN "CampaignPost" cp ON cp.id = m."campaignPostId" WHERE cp.angle <> ''
  UNION ALL SELECT 512, 'Posts mesurés d''un plan de campagne : qualification disponible', 'avec format renseigné', count(*), NULL
    FROM measured_posts m JOIN "CampaignPost" cp ON cp.id = m."campaignPostId" WHERE cp.format <> ''
  UNION ALL SELECT 513, 'Posts mesurés d''un plan de campagne : qualification disponible', 'avec appel à l''action renseigné', count(*), NULL
    FROM measured_posts m JOIN "CampaignPost" cp ON cp.id = m."campaignPostId" WHERE cp.cta <> ''
  UNION ALL SELECT 520, 'Campagnes', 'campagnes avec au moins 2 posts mesurés', count(*), NULL
    FROM (SELECT "campaignId" FROM measured_posts WHERE "campaignId" IS NOT NULL GROUP BY "campaignId" HAVING count(*) >= 2) c
)
SELECT section, label,
       CASE WHEN n BETWEEN 1 AND 2 THEN '<3' ELSE n::text END AS valeur,
       CASE WHEN total IS NULL THEN ''
            WHEN total < 3 THEN 'sur <3'
            ELSE 'sur ' || total || ' (' || round(100.0 * n / total) || ' %)' END AS part
FROM out
ORDER BY ord, label;

ROLLBACK;
