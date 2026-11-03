// Fonctions pures de l'évaluation éditoriale (voir docs/eval-editorial/README.md).
//
// Claude utilisé directement (version D) entoure souvent le post d'éléments de présentation : phrase d'introduction, séparateurs « --- »,
// compteur de caractères, note finale, gras markdown. Ce nettoyage écarte UNIQUEMENT ces éléments extérieurs au post.
// Règle de prudence : tout bloc qui n'est pas explicitement reconnu comme présentation est CONSERVÉ, même placé entre deux séparateurs
// (un séparateur peut séparer deux paragraphes authentiques du post). Chaque suppression est consignée, pour pouvoir être relue.

const SEP = /^[ \t]*-{3,}[ \t]*$/;
const plainOf = (b) => b.replace(/^[*_#>\s]+|[*_\s]+$/g, "");
const isIntro = (p) => p.length < 140 && /^(voici|bien sûr|proposition|ci-dessous|post linkedin)/i.test(p) && (/:$/.test(p) || /^post linkedin/i.test(p));
const isCounter = (p) => p.length < 140 && /caract/i.test(p) && /\d/.test(p);
const isNote = (p) => /^(note|astuce|n\.b\.|nb)\b/i.test(p);

// → { text, removed: [{ kind, text }] } ; kind : introduction | compteur | commentaire | séparateur | mise en forme
export function cleanDirectDetailed(raw) {
  const removed = [];
  const lines = String(raw).replace(/\r/g, "").trim().split("\n");
  const blocks = [];
  let cur = [];
  for (const l of lines) {
    if (SEP.test(l)) { blocks.push(cur.join("\n").trim()); cur = []; removed.push({ kind: "séparateur", text: l.trim() }); } else cur.push(l);
  }
  blocks.push(cur.join("\n").trim());

  const kept = [];
  blocks.forEach((b0, i) => {
    let b = b0;
    if (!b) return;
    // Analyse préalable (version D+, à qui l'on demande de classer les faits avant d'écrire) : un titre « Post LinkedIn » isolé
    // marque le début du post. Ce qui précède est une analyse de Claude, retirée du post mais consignée comme commentaire.
    if (i > 0) {
      const lines = b.split("\n");
      if (/^post linkedin\s*(:|–|-)?\s*$/i.test(plainOf(lines[0]))) {
        for (const k of kept.splice(0)) removed.push({ kind: "commentaire", text: k });
        b = lines.slice(1).join("\n").trim();
        if (!b) return;
      }
    }
    const p = plainOf(b);
    if (i === 0 && isIntro(p)) removed.push({ kind: "introduction", text: b });
    else if (/FAITS DOCUMENTÉS/i.test(p) && /INFORMATIONS MANQUANTES/i.test(p)) removed.push({ kind: "commentaire", text: b }); // analyse préalable (D+)
    else if (isCounter(p)) removed.push({ kind: "compteur", text: b });
    else if (isNote(p)) removed.push({ kind: "commentaire", text: b });
    else kept.push(b);
  });

  // Présentation non séparée : introduction collée au premier paragraphe, compteur collé au dernier
  if (kept.length) {
    const paras = kept[0].split(/\n\s*\n/);
    if (paras.length > 1 && /^(voici|bien sûr)[^\n]{0,120}:\s*$/i.test(paras[0].trim())) { removed.push({ kind: "introduction", text: paras[0].trim() }); kept[0] = paras.slice(1).join("\n\n"); }
    const last = kept[kept.length - 1].split(/\n\s*\n/);
    if (last.length > 1 && isCounter(plainOf(last[last.length - 1]))) { removed.push({ kind: "compteur", text: last[last.length - 1].trim() }); kept[kept.length - 1] = last.slice(0, -1).join("\n\n"); }
  }

  let text = kept.join("\n\n");
  const counterTail = text.match(/\s*\(\s*\d[\d  ]*\s*caract[^)]*\)\s*$/i);
  if (counterTail) { removed.push({ kind: "compteur", text: counterTail[0].trim() }); text = text.slice(0, counterTail.index); }
  const bold = (text.match(/\*\*/g) ?? []).length;
  if (bold) { text = text.replace(/\*\*/g, ""); removed.push({ kind: "mise en forme", text: `gras markdown (${bold / 2 | 0} passage(s))` }); }
  let italics = 0;
  text = text.split("\n").map((l) => { const m = l.match(/^(\s*)\*([^*].*[^*]|[^*])\*\s*$/); if (m) { italics++; return m[1] + m[2]; } return l; }).join("\n");
  if (italics) removed.push({ kind: "mise en forme", text: `italique markdown (${italics} ligne(s))` });
  return { text: text.trim(), removed };
}

export const cleanDirect = (raw) => cleanDirectDetailed(raw).text;
