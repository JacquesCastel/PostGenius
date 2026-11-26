// Données de la page /preuves/test-e4. Chaque valeur est reprise de docs/e4-chiffres/compte-rendu/compte-rendu-E4.md ;
// scripts/preuves-e4.test.mjs vérifie qu'elles y figurent toujours (aucun chiffre n'est écrit ici sans y être).
// Le produit s'appelait LinkeePost au moment du test : les pages de preuve gardent ce nom, avec la mention du nouveau.
export const NOM_DU_TEST = "LinkeePost";
export const E4 = {
  date: "10 novembre 2026",
  gel: "9 novembre 2026, 15:14 UTC",
  empreinte: "c763dc3cf72b26e1fbdea21af551652bc7f6941910c3d2b9c15aa1c7b36149a1",
  nbTextes: 70,
  // Éléments inventés ou déformés par post (moyenne), et nombre de textes (sur 10) qui en contiennent au moins un
  conditions: [
    { code: "A", label: "Modèle généraliste, sans les faits", moyenne: "6,5", valeur: 6.5, textes: 10 },
    { code: "B", label: "Même modèle, avec les faits", moyenne: "2,8", valeur: 2.8, textes: 8 },
    { code: "D", label: "Second modèle, avec les faits", moyenne: "2,4", valeur: 2.4, textes: 9 },
    { code: "C", label: "Vercéa (alors LinkeePost), avec les faits", moyenne: "0,3", valeur: 0.3, textes: 2, notre: true },
  ],
  sansExemples: ["5,9", "1,6", "1,9", "0,1"], // A, B, D, C
  types: [
    ["Chiffres, pourcentages, montants", 175, 109],
    ["Dates et durées", 30, 16],
    ["Noms propres", 77, 1],
    ["Citations", 4, 0],
    ["Études et sources citées", 1, 0],
  ],
  total: [287, 126],
  gists: {
    gel: "https://gist.github.com/JacquesCastel/6daaff4e0f2b2189ddaed9f773e28f40",
    conditionC: "https://gist.github.com/JacquesCastel/368160e1e6526ee24aa7859a24e73fcd",
    cle: "https://gist.github.com/JacquesCastel/41c20e687a80a696a8e8d4b6a74fed3f",
    decision: "https://gist.github.com/JacquesCastel/126f38001743a04ecc3561e2b529af49",
  },
  depot: "https://github.com/JacquesCastel/PostGenius/blob/main/docs/e4-chiffres",
};
