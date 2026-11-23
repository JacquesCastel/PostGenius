-- Audit n° 3 : pilote automatique éditorial — que peut-on établir sur les propositions « planifiées » sans brouillon relié ? STRICTEMENT EN LECTURE SEULE.
--
-- Le code ne pose le statut « planifiée » que dans lib/editorial/autopilot.js, avec le brouillon relié dans le même appel. Un lien vide aujourd'hui
-- signifie donc : brouillon supprimé (le lien passe à « null »), ou statut posé par un appel direct à l'API sans brouillon. Ce script ne dit PAS
-- qui a supprimé ni pourquoi : il compte ce que la base permet de distinguer, et rien d'autre.
--
-- Lancer : scripts/audit-profondeur.sh   (ou  psql "$DATABASE_URL" -f scripts/audit-pilote-auto.sql)
-- Mêmes garanties que les autres audits : lecture seule, comptages seulement (jamais d'adresse, d'identifiant ni de texte), « <3 » pour 1 ou 2.

BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH
users AS (SELECT id, "autoPublishThreshold", "agencyId", expertise, "publishDays" FROM "User" WHERE NOT disabled),
planned AS (
  SELECT r.id, r."userId", r.topic, r."draftId", r."createdAt", r."respondedAt",
         EXTRACT(EPOCH FROM (r."respondedAt" - r."createdAt")) / 60.0 AS delay_min
  FROM "EditorialRecommendation" r JOIN users u ON u.id = r."userId"
  WHERE r.status = 'planifiée'
),
per_account AS (SELECT "userId", count(*) AS n FROM planned GROUP BY "userId"),
-- brouillons « pilote automatique » : l'application les crée avec auto = true, statut programmé, thème = sujet de la proposition
auto_like AS (
  SELECT d.id, d.status, d."pillarId", d."publishedAt", p.id AS reco_id
  FROM "Draft" d
  JOIN planned p ON p."userId" = d."userId" AND d.theme = left(p.topic, 200)
  WHERE d.auto = true
),
events AS (SELECT id, "createdAt", meta FROM "ActivityEvent" WHERE kind = 'reco_draft_deleted'),
-- risque de doublons : signature d'un échec après la création du brouillon (la proposition reste « proposée » alors qu'un brouillon automatique porte déjà son sujet)
stuck AS (
  SELECT DISTINCT r.id
  FROM "EditorialRecommendation" r JOIN users u ON u.id = r."userId"
  JOIN "Draft" d ON d."userId" = r."userId" AND d.auto = true AND d."campaignId" IS NULL AND d.theme = left(r.topic, 200)
  WHERE r.status = 'proposée' AND r."draftId" IS NULL
),
dups AS (
  SELECT d."userId", d.theme, count(*) AS c
  FROM "Draft" d JOIN users u ON u.id = d."userId"
  WHERE d.auto = true AND d."campaignId" IS NULL
  GROUP BY d."userId", d.theme HAVING count(*) >= 2
),
out AS (
  SELECT 10 AS ord, 'Comptes avec la publication autonome activée' AS section, 'seuil de confiance renseigné (comptes non suspendus)' AS label, count(*)::bigint AS n, NULL::bigint AS total
    FROM users WHERE "autoPublishThreshold" IS NOT NULL
  UNION ALL SELECT 11, 'Comptes avec la publication autonome activée', 'dont éligibles (hors agence, expertise et jours de publication renseignés)', count(*), NULL
    FROM users WHERE "autoPublishThreshold" IS NOT NULL AND "agencyId" IS NULL AND expertise IS NOT NULL AND "publishDays" IS NOT NULL
  UNION ALL SELECT 20, 'Propositions « planifiées »', 'au total (comptes non suspendus)', count(*), NULL FROM planned
  UNION ALL SELECT 21, 'Propositions « planifiées »', 'avec un brouillon encore relié', count(*), count(*) FROM planned WHERE "draftId" IS NOT NULL
  UNION ALL SELECT 22, 'Propositions « planifiées »', 'sans brouillon relié', count(*), NULL FROM planned WHERE "draftId" IS NULL
  UNION ALL SELECT 23, 'Propositions « planifiées »', 'comptes concernés', count(*), NULL FROM per_account
  UNION ALL SELECT 24, 'Propositions « planifiées » par compte', bucket, count(*), NULL FROM (SELECT CASE WHEN n <= 3 THEN '1 à 3' WHEN n <= 10 THEN '4 à 10' ELSE '11 ou plus' END AS bucket FROM per_account) b GROUP BY bucket
  UNION ALL SELECT 30, 'Propositions « planifiées » par mois de réponse', m, count(*), NULL FROM (SELECT coalesce(to_char("respondedAt", 'YYYY-MM'), 'sans date') AS m FROM planned) x GROUP BY m
  -- le pilote automatique génère puis répond dans la même exécution ; un clic humain intervient plus tard (indice, pas une preuve)
  UNION ALL SELECT 40, 'Délai entre création et réponse (indice d''origine)', b, count(*), NULL FROM (SELECT CASE WHEN delay_min IS NULL THEN 'sans date de réponse' WHEN delay_min < 10 THEN 'moins de 10 minutes' WHEN delay_min < 120 THEN '10 minutes à 2 heures' ELSE 'plus de 2 heures' END AS b FROM planned) x GROUP BY b
  -- test des deux explications : si des brouillons au thème d'une proposition planifiée existent encore, le lien est perdu sans suppression ; sinon ils ont disparu
  UNION ALL SELECT 50, 'Brouillons « pilote automatique » retrouvés par leur thème', 'brouillons existants (auto, thème = sujet d''une proposition planifiée)', count(DISTINCT id), NULL FROM auto_like
  UNION ALL SELECT 51, 'Brouillons « pilote automatique » retrouvés par leur thème', 'dont publiés', count(DISTINCT id), NULL FROM auto_like WHERE status = 'publié'
  UNION ALL SELECT 52, 'Brouillons « pilote automatique » retrouvés par leur thème', 'dont en erreur', count(DISTINCT id), NULL FROM auto_like WHERE status = 'erreur'
  UNION ALL SELECT 53, 'Brouillons « pilote automatique » retrouvés par leur thème', 'dont programmés ou à valider', count(DISTINCT id), NULL FROM auto_like WHERE status IN ('programmé', 'à valider')
  UNION ALL SELECT 54, 'Brouillons « pilote automatique » retrouvés par leur thème', 'dont avec pilier', count(DISTINCT id), NULL FROM auto_like WHERE "pillarId" IS NOT NULL
  UNION ALL SELECT 55, 'Doublons éventuels du pilote automatique', 'propositions encore « proposées » alors qu''un brouillon automatique porte déjà leur sujet (échec après création)', count(*), NULL FROM stuck
  UNION ALL SELECT 56, 'Doublons éventuels du pilote automatique', 'sujets portés par 2 brouillons automatiques ou plus (même compte)', count(*), NULL FROM dups
  UNION ALL SELECT 57, 'Doublons éventuels du pilote automatique', 'brouillons automatiques concernés', coalesce(sum(c), 0)::bigint, NULL FROM dups
  UNION ALL SELECT 60, 'Brouillons créés par automatisme (auto = true) encore en base', 'hors campagne', count(*), NULL
    FROM "Draft" d JOIN users u ON u.id = d."userId" WHERE d.auto = true AND d."campaignId" IS NULL
  -- traces de suppression d'un brouillon relié (enregistrées depuis la correction de traçabilité ; vides tant qu'elle n'est pas déployée)
  UNION ALL SELECT 70, 'Suppressions tracées d''un brouillon relié à une proposition', 'au total', count(*), NULL FROM events
  UNION ALL SELECT 71, 'Suppressions tracées d''un brouillon relié à une proposition', 'dont brouillons créés par le pilote automatique', count(*), NULL FROM events WHERE meta ->> 'auto' = 'true'
  UNION ALL SELECT 72, 'Suppressions tracées d''un brouillon relié à une proposition', 'dont déjà publiés', count(*), NULL FROM events WHERE meta ->> 'published' = 'true'
)
SELECT section, label,
       CASE WHEN n BETWEEN 1 AND 2 THEN '<3' ELSE n::text END AS valeur,
       CASE WHEN total IS NULL THEN '' WHEN total < 3 THEN 'sur <3' ELSE 'sur ' || total END AS part
FROM out
ORDER BY ord, label;

ROLLBACK;
