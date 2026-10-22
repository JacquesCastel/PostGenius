// Rendu Markdown minimal → HTML. Contenu rédigé par l'admin (source de confiance).
// Couvre : titres, gras, italique, liens (externes et internes « /page »), listes, citations, code inline, paragraphes.

import { parseYouTubeId, youtubeEmbedUrl } from "./youtube";

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" class="text-[#ff5a5f] underline" rel="noopener" target="_blank">$1</a>')
    .replace(/\[([^\]]+)\]\((\/[^\s)]*)\)/g, '<a href="$2" class="text-[#ff5a5f] underline">$1</a>') // lien interne (page du site), dans le même onglet
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, '<code class="bg-gray-100 rounded px-1 text-sm">$1</code>');
}

export function markdownToHtml(md = "") {
  const lines = String(md).replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let list = null; // "ul" | "ol" | null
  const closeList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    let m;
    // Lien YouTube seul sur sa ligne -> lecteur intégré (youtube-nocookie : pas de
    // cookie de suivi avant la lecture), au format 16/9.
    const ytId = /^\S+$/.test(line.trim()) ? parseYouTubeId(line.trim().replace(/^<|>$/g, "")) : null;
    if (ytId) {
      closeList();
      out.push(
        `<div class="my-6 aspect-video w-full overflow-hidden rounded-xl bg-black"><iframe src="${youtubeEmbedUrl(ytId)}" title="Vidéo YouTube" class="h-full w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`
      );
    } else if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
      closeList();
      const lvl = m[1].length;
      const cls = lvl === 1 ? "text-3xl font-bold mt-8 mb-3" : lvl === 2 ? "text-2xl font-bold mt-7 mb-3" : "text-xl font-semibold mt-6 mb-2";
      out.push(`<h${lvl} class="${cls}">${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        out.push('<ul class="list-disc pl-6 space-y-1 my-3">');
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        out.push('<ol class="list-decimal pl-6 space-y-1 my-3">');
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      closeList();
      out.push(`<blockquote class="border-l-4 border-indigo-200 pl-4 italic text-gray-600 my-3">${inline(m[1])}</blockquote>`);
    } else if (line.trim() === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p class="my-3 leading-relaxed text-gray-700">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}

export function slugify(s = "") {
  const base = String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents combinés
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // 80 caractères au plus, coupés à la limite d'un mot (jamais au milieu)
  if (base.length <= 80) return base;
  const cut = base.slice(0, 80);
  return (cut.lastIndexOf("-") > 40 ? cut.slice(0, cut.lastIndexOf("-")) : cut).replace(/-+$/, "");
}
