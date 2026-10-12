// Bibliothèque de contenus réutilisables (voir Snippet) : types et nettoyage des entrées.
export const SNIPPET_KINDS = ["post", "accroche", "conclusion", "bloc"];
export const MAX_SNIPPETS = 200;
export const MAX_SNIPPET_TEXT = 3000;
export const MAX_SNIPPET_TITLE = 80;

export function cleanSnippet(body) {
  const kind = SNIPPET_KINDS.includes(body?.kind) ? body.kind : "bloc";
  const text = String(body?.text ?? "").replace(/\r\n/g, "\n").trim().slice(0, MAX_SNIPPET_TEXT);
  const title = String(body?.title ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET_TITLE) || null;
  return { kind, text, title };
}

// Insère un contenu dans un texte : une accroche va en tête, une conclusion en fin de post,
// le reste à la position donnée (ou en fin de texte). Toujours séparé du reste par une ligne vide.
export function insertSnippet(text, snippet, pos = null) {
  const t = String(text ?? "");
  const add = String(snippet?.text ?? "").trim();
  if (!add) return t;
  if (!t.trim()) return add;
  if (snippet.kind === "accroche") return `${add}\n\n${t.replace(/^\s+/, "")}`;
  const at = snippet.kind === "conclusion" || !Number.isInteger(pos) || pos < 0 || pos > t.length ? t.length : pos;
  const before = t.slice(0, at).replace(/\s+$/, "");
  const after = t.slice(at).replace(/^\s+/, "");
  return `${before}\n\n${add}${after ? `\n\n${after}` : ""}`;
}
