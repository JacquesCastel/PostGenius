// Navigation du nouveau style : un lien n'existe que si sa page est ouverte. PUR (aucune lecture de base ni de fichier serveur).
import { aProposOuvert, legalOuvert } from "./siteInstitutionnel.js";
import { champsManquants, A_PROPOS } from "./aPropos.js";

// État d'ouverture de chaque page. legalTextes : textes des trois pages légales (lus par l'appelant, seulement si SITE_LEGAL=1).
export function pagesOuvertes({ env = process.env, legalTextes = [], aPropos = A_PROPOS } = {}) {
  return {
    produit: env?.SITE_PRODUIT === "1",
    preuves: env?.SITE_PREUVES === "1",
    apropos: aProposOuvert(env, champsManquants(aPropos)),
    legal: legalOuvert(env, legalTextes),
  };
}

// En-tête. « Produit » remplace « Fonctionnalités » (la page qu'il doit remplacer) dès qu'il est ouvert.
export function navEntete(o) {
  return [
    o.produit ? ["/produit", "Produit"] : ["/fonctionnalites", "Fonctionnalités"],
    ...(o.preuves ? [["/preuves", "Preuves"]] : []),
    ["/tarifs", "Tarifs"],
    ["/blog", "Blog"],
    ...(o.apropos ? [["/a-propos", "À propos"]] : []),
    ["/contact", "Contact"],
  ];
}

// Pied de page : colonnes de liens
export function colonnesPied(o) {
  return {
    produit: [
      ...(o.produit
        ? [["/produit", "Produit"], ["/produit/methode", "Comment l'outil fonctionne"], ["/produit/verification", "Chiffres à vérifier"]]
        : [["/fonctionnalites", "Fonctionnalités"], ["/comment-ca-marche", "Comment ça marche"]]),
      ["/scoring", "Contrôle de forme"],
      ["/tarifs", "Tarifs"],
    ],
    ressources: [...(o.preuves ? [["/preuves", "Preuves"], ["/preuves/test-e4", "Test E4"]] : []), ["/blog", "Blog"], ["/contact", "Contact"]],
    societe: o.apropos ? [["/a-propos", "À propos"]] : [],
    legal: [
      ...(o.legal
        ? [["/legal", "Informations légales"]]
        : [["/mentions-legales", "Mentions légales"], ["/cgu", "CGU"], ["/confidentialite", "Confidentialité"]]),
      ["/securite", "Sécurité"],
      ["/privacy-policy", "Privacy Policy"],
    ],
  };
}

// Pages ajoutées au plan du site : seulement celles qui sont ouvertes
export function pagesPlanDuSite(o) {
  return [
    ...(o.produit ? [["/produit", 0.9], ["/produit/methode", 0.7], ["/produit/verification", 0.7]] : []),
    ...(o.preuves ? [["/preuves", 0.8], ["/preuves/test-e4", 0.8]] : []),
    ...(o.apropos ? [["/a-propos", 0.5]] : []),
    ...(o.legal ? [["/legal", 0.3]] : []),
  ];
}
