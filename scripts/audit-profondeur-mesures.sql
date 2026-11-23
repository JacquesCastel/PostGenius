-- Audit de la profondeur des mesures de performance — STRICTEMENT EN LECTURE SEULE.
--
-- Question : combien de comptes disposent d'au moins 8 posts publiés ET mesurés, et à quelle maturité (J+1 ou J+7) ?
-- Sert à décider si l'intelligence de performance éditoriale peut être évaluée en conditions réelles.
--
-- Lancer (n'importe quel client Postgres, par exemple sur le serveur) :
--     psql "$DATABASE_URL" -f scripts/audit-profondeur-mesures.sql
--
-- Garanties :
--   * la transaction est ouverte en LECTURE SEULE (BEGIN READ ONLY) : la base refuse toute écriture, même par erreur ;
--   * aucune adresse e-mail, aucun identifiant de compte, aucun texte de post n'est affiché : uniquement des comptages ;
--   * tout comptage de 1 ou 2 est affiché « <3 » pour ne pas désigner un client ;
--   * l'unité est le POST publié, jamais la ligne de mesure : un post mesuré à J+1 et à J+7 compte pour un seul ;
--   * l'âge d'une mesure est l'âge RÉEL (capturedAt − publishedAt), pas l'étiquette 24/168 ;
--   * fenêtres de tolérance : J+1 = de 20 h à 72 h ; J+7 = de 144 h à 240 h (mêmes valeurs que le plan).
-- Comptes suspendus exclus. Les posts publiés hors de LinkeePost ne sont pas en base : ils ne peuvent pas être comptés.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH
users AS (
  SELECT id, role FROM "User" WHERE NOT disabled
),
posts AS (
  SELECT d.id, d."userId", u.role,
         CASE WHEN d.target = 'person' THEN 'profil'
              WHEN d.target LIKE 'urn:li:organization:%' THEN 'page'
              ELSE 'autre' END AS dest,
         d."pillarId", d."campaignPostId", d."campaignId", d.mood,
         EXISTS (SELECT 1 FROM "EditorialRecommendation" r WHERE r."draftId" = d.id) AS from_reco
  FROM "Draft" d
  JOIN users u ON u.id = d."userId"
  WHERE d.status = 'publié' AND d."postId" IS NOT NULL AND d."publishedAt" IS NOT NULL
),
-- une ligne par POST, avec ce que ses mesures permettent (plusieurs mesures d'un même post = un seul post)
flags AS (
  SELECT p.*,
         COALESCE(a.j7, false) AS j7,
         COALESCE(a.j1, false) AS j1,
         COALESCE(a.n_meas, 0) > 0 AS any_m,
         COALESCE(a.j7_close, false) AS j7_close,
         COALESCE(a.j1_close, false) AS j1_close
  FROM posts p
  LEFT JOIN LATERAL (
    SELECT count(*) AS n_meas,
           bool_or(x.age BETWEEN 144 AND 240) AS j7,
           bool_or(x.age BETWEEN 20 AND 72) AS j1,
           bool_or(x.age BETWEEN 156 AND 180) AS j7_close,   -- à ±12 h de 168 h
           bool_or(x.age BETWEEN 20 AND 28) AS j1_close      -- à ±4 h de 24 h
    FROM (SELECT EXTRACT(EPOCH FROM (pp."capturedAt" - d2."publishedAt")) / 3600.0 AS age
          FROM "PostPerformance" pp
          JOIN "Draft" d2 ON d2.id = pp."draftId"
          WHERE pp."draftId" = p.id) x
  ) a ON true
),
scoped AS (
  SELECT f.*, f.dest AS scope FROM flags f WHERE f.dest IN ('profil', 'page')
  UNION ALL
  SELECT f.*, 'tous' AS scope FROM flags f
),
acc AS (
  SELECT "userId", role, scope,
         count(*) AS published,
         count(*) FILTER (WHERE j7) AS c7,
         count(*) FILTER (WHERE j1) AS c1,
         count(*) FILTER (WHERE j1 AND NOT j7) AS c1only,
         count(*) FILTER (WHERE any_m AND NOT j1 AND NOT j7) AS c_out
  FROM scoped
  GROUP BY "userId", role, scope
),
regime AS (
  SELECT *,
         CASE WHEN c7 >= 8 THEN '1 analysable à J+7 (8 posts ou plus)'
              WHEN c1 >= 8 THEN '2 analysable à J+1 seulement (8 posts ou plus)'
              WHEN greatest(c7, c1) BETWEEN 5 AND 7 THEN '3 proche du seuil (5 à 7 posts)'
              ELSE '4 sous le seuil (moins de 5 posts comparables)' END AS regime,
         CASE WHEN c7 = 0 THEN '0' WHEN c7 <= 3 THEN '1-3' WHEN c7 <= 7 THEN '4-7'
              WHEN c7 <= 14 THEN '8-14' ELSE '15+' END AS tranche7
  FROM acc
),
measured AS (SELECT * FROM flags WHERE j7 OR j1),
out AS (
  -- 1. comptes par régime et par périmètre
  SELECT 10 AS ord, 'Comptes par régime' AS section, scope || ' · ' || regime AS label, count(*)::bigint AS n, NULL::bigint AS total
  FROM regime GROUP BY scope, regime
  UNION ALL
  -- 2. répartition des comptes selon le nombre de posts mesurés à J+7
  SELECT 20, 'Comptes par tranche de posts mesurés à J+7', scope || ' · ' || tranche7, count(*), NULL
  FROM regime GROUP BY scope, tranche7
  UNION ALL
  -- 3. comptes analysables à J+7, dont comptes administrateurs (internes)
  SELECT 30, 'Comptes analysables à J+7 (périmètre « tous »)', CASE WHEN role = 'admin' THEN 'dont comptes administrateurs' ELSE 'comptes utilisateurs' END, count(*), NULL
  FROM regime WHERE scope = 'tous' AND c7 >= 8 GROUP BY role
  UNION ALL
  -- 4. posts : de la publication à la mesure exploitable
  SELECT 40, 'Posts publiés (comptes non suspendus)', 'publiés par LinkeePost', count(*), NULL FROM flags
  UNION ALL SELECT 41, 'Posts publiés (comptes non suspendus)', 'avec au moins une mesure', count(*), NULL FROM flags WHERE any_m
  UNION ALL SELECT 42, 'Posts publiés (comptes non suspendus)', 'comparables à J+7', count(*), NULL FROM flags WHERE j7
  UNION ALL SELECT 43, 'Posts publiés (comptes non suspendus)', 'comparables à J+1 seulement', count(*), NULL FROM flags WHERE j1 AND NOT j7
  UNION ALL SELECT 44, 'Posts publiés (comptes non suspendus)', 'mesure hors fenêtre (étiquette J+1/J+7 ≠ âge réel)', count(*), NULL FROM flags WHERE any_m AND NOT j1 AND NOT j7
  -- 5. biais de fenêtre : part des mesures proches de 24 h / 168 h parmi les posts comparables
  UNION ALL SELECT 50, 'Proximité de la cible (posts comparables)', 'J+7 : mesure à ±12 h de 168 h', count(*) FILTER (WHERE j7_close), count(*) FROM flags WHERE j7
  UNION ALL SELECT 51, 'Proximité de la cible (posts comparables)', 'J+1 : mesure à ±4 h de 24 h', count(*) FILTER (WHERE j1_close), count(*) FROM flags WHERE j1
  -- 6. couverture de la qualification sur les posts mesurés
  UNION ALL SELECT 60, 'Qualification des posts mesurés', 'avec un pilier', count(*) FILTER (WHERE "pillarId" IS NOT NULL), count(*) FROM measured
  UNION ALL SELECT 61, 'Qualification des posts mesurés', 'issus d''une recommandation « Que publier ? »', count(*) FILTER (WHERE from_reco), count(*) FROM measured
  UNION ALL SELECT 62, 'Qualification des posts mesurés', 'issus d''une campagne', count(*) FILTER (WHERE "campaignPostId" IS NOT NULL OR "campaignId" IS NOT NULL), count(*) FROM measured
  UNION ALL SELECT 63, 'Qualification des posts mesurés', 'avec une humeur', count(*) FILTER (WHERE mood IS NOT NULL), count(*) FROM measured
  UNION ALL SELECT 64, 'Qualification des posts mesurés', 'avec pilier, recommandation ou campagne', count(*) FILTER (WHERE "pillarId" IS NOT NULL OR from_reco OR "campaignPostId" IS NOT NULL OR "campaignId" IS NOT NULL), count(*) FROM measured
  -- 7. canaux de mesure connectés
  UNION ALL SELECT 70, 'Canaux de mesure connectés (comptes non suspendus)', 'statistiques de profil (application « Stats »)', count(*), NULL
    FROM "LinkedInAccount" l JOIN users u ON u.id = l."userId" WHERE l."statsToken" IS NOT NULL
  UNION ALL SELECT 71, 'Canaux de mesure connectés (comptes non suspendus)', 'page entreprise', count(*), NULL
    FROM "LinkedInAccount" l JOIN users u ON u.id = l."userId" WHERE l."orgToken" IS NOT NULL
)
SELECT section, label,
       CASE WHEN n BETWEEN 1 AND 2 THEN '<3' ELSE n::text END AS valeur,
       CASE WHEN total IS NULL THEN ''
            WHEN total < 3 THEN 'sur <3'
            ELSE 'sur ' || total || ' (' || round(100.0 * n / total) || ' %)' END AS part
FROM out
ORDER BY ord, label;

ROLLBACK;
