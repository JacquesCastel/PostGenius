/**
 * lib/templates.js — Moteur de gabarits visuels (Satori JSX → PNG)
 *
 * Deux gabarits :
 *  - "post"      : visuel 1080×1080 pour un post LinkedIn (citation / accroche)
 *  - "carousel"  : slide 1080×1080 pour un carrousel (title slide + slides contenu + end slide)
 *
 * Utilise satori (JSX → SVG) + @resvg/resvg-js (SVG → PNG).
 * Les polices sont chargées depuis Google Fonts (TTF via User-Agent ancien) et mises en cache.
 */

import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

// ── Cache des polices (lecture disque une seule fois par process) ──
const fontCache = new Map();

const SUPPORTED_FONTS = ["Inter", "Poppins", "Montserrat", "Raleway"];

/**
 * Charge un fichier .woff depuis @fontsource (dans node_modules).
 * Satori supporte .ttf, .otf et .woff — PAS .woff2.
 * Les packages @fontsource fournissent les deux formats, on utilise .woff.
 */
function loadLocalFont(family, weight = 400) {
  const key = `${family}-${weight}`;
  if (fontCache.has(key)) return fontCache.get(key);

  const pkg = family.toLowerCase();
  const fileName = `${pkg}-latin-${weight}-normal.woff`;
  const filePath = path.join(
    process.cwd(),
    "node_modules",
    `@fontsource/${pkg}`,
    "files",
    fileName
  );

  const buf = fs.readFileSync(filePath);
  fontCache.set(key, buf);
  return buf;
}

function getFonts(family) {
  const safeFamily = SUPPORTED_FONTS.includes(family) ? family : "Inter";
  const regular = loadLocalFont(safeFamily, 400);
  const bold    = loadLocalFont(safeFamily, 700);
  return [
    { name: safeFamily, data: regular, weight: 400, style: "normal" },
    { name: safeFamily, data: bold,    weight: 700, style: "normal" },
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex, amount = 30) {
  const { r, g, b } = hexToRgb(hex);
  return `rgb(${Math.max(0, r - amount)},${Math.max(0, g - amount)},${Math.max(0, b - amount)})`;
}

function isLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function background(kit) {
  if (kit.bgStyle === "gradient") {
    return `linear-gradient(135deg, ${kit.primaryColor} 0%, ${darken(kit.primaryColor, 50)} 100%)`;
  }
  return kit.primaryColor;
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Image de fond personnalisée ───────────────────────────────────────────────

const BG_DIR = process.env.IMAGE_DIR
  ? path.join(path.dirname(process.env.IMAGE_DIR), "backgrounds")
  : path.join(process.cwd(), "data", "backgrounds");

/**
 * Retourne l'image de fond de la charte en data URL (lue depuis le disque),
 * ou null si pas d'image. Une URL externe (http…) est renvoyée telle quelle.
 */
function backgroundImageData(kit) {
  if (!kit.backgroundUrl) return null;
  try {
    const m = kit.backgroundUrl.match(/\/api\/images\/backgrounds\/([^/?]+)$/);
    if (!m) return kit.backgroundUrl.startsWith("http") ? kit.backgroundUrl : null;
    const file = m[1];
    const buf = fs.readFileSync(path.join(BG_DIR, file));
    const ext = file.split(".").pop()?.toLowerCase();
    const mime = ext === "webp" ? "image/webp" : ext === "png" ? "image/png" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null; // fichier manquant → fond couleur classique
  }
}

// Props de style pour poser l'image de fond sur un élément racine 1080×1080
function bgImageStyle(bgImage) {
  return bgImage
    ? { backgroundImage: `url(${bgImage})`, backgroundSize: "1080px 1080px" }
    : {};
}

/**
 * Racine de slide 1080×1080 : image de fond éventuelle sur la racine,
 * calque intérieur (voile semi-transparent si image, sinon fond classique).
 * Satori dessine le backgroundImage du parent SOUS le background rgba de l'enfant.
 */
function slideRoot({ bgImage, fallbackBg, voile, innerStyle, children }) {
  return {
    type: "div",
    props: {
      style: { display: "flex", width: 1080, height: 1080, ...bgImageStyle(bgImage) },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flex: 1,
              background: bgImage ? voile : fallbackBg,
              ...innerStyle,
            },
            children,
          },
        },
      ],
    },
  };
}

function textColor(kit) {
  // Texte blanc si fond sombre, sinon couleur primaire sur fond blanc
  return isLight(kit.primaryColor) ? kit.primaryColor : "#ffffff";
}

function onPrimary(kit) {
  return isLight(kit.primaryColor) ? "#1b2a4a" : "#ffffff";
}

// Tronque le texte à N caractères en coupant proprement au mot
function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text ?? "";
  return text.slice(0, maxLen).replace(/\s\S*$/, "") + "…";
}

async function svgToPng(svg) {
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: 1080 } });
  return resvg.render().asPng();
}

// ── Gabarit Post (citation / accroche) ───────────────────────────────────────

export async function renderPostTemplate({ text, brandKit: kit, customTemplate }) {
  const fontFamily = kit.fontFamily ?? "Inter";
  const shortText = truncate(text, 280);

  // Modèle personnalisé (éditeur visuel, Charte graphique) : remplace entièrement
  // la mise en page fixe ci-dessous, même rendu que les slides de carrousel.
  if (customTemplate?.elements?.length) {
    return renderCustomSlide({ elements: customTemplate.elements, slide: { type: "post", quote: shortText }, kit, fontFamily, index: 0, total: 1 });
  }

  const fonts = getFonts(fontFamily);
  // Image de fond personnalisée : posée sur la racine, la colonne devient un
  // voile semi-transparent couleur primaire pour garder le texte lisible.
  const bgImage = backgroundImageData(kit);
  const bg = bgImage ? rgba(kit.primaryColor ?? "#0a66c2", 0.78) : background(kit);
  const fg = onPrimary(kit);
  const accent = kit.accentColor ?? "#ff5a5f";
  const fontSize = shortText.length < 80 ? 52 : shortText.length < 160 ? 42 : 34;

  // Règle Satori : tout <div> avec 2+ enfants doit avoir display flex/contents/none.
  // On utilise un layout row (accent bar | contenu) pour éviter position:absolute.
  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: 1080,
        height: 1080,
        fontFamily,
        ...bgImageStyle(bgImage),
      },
      children: [
        // ── Barre d'accent verticale ──
        {
          type: "div",
          props: {
            style: { width: 10, background: accent, flexShrink: 0 },
            children: null,
          },
        },
        // ── Colonne principale ──
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              flex: 1,
              background: bg,
            },
            children: [
              // Zone texte (flex 1 = occupe tout l'espace restant)
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "80px 80px 60px 80px",
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: {
                          display: "flex",
                          flexDirection: "column",
                        },
                        children: [
                          // Guillemet décoratif
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                fontSize: 96,
                                color: accent,
                                lineHeight: 1,
                                fontWeight: 700,
                                marginBottom: 16,
                              },
                              children: ["“"],
                            },
                          },
                          // Texte du post
                          {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                fontSize,
                                fontWeight: 700,
                                color: fg,
                                lineHeight: 1.4,
                              },
                              children: [shortText],
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              },
              // Pied de page
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "20px 60px",
                    background: "rgba(0,0,0,0.25)",
                    borderTop: `3px solid ${accent}`,
                  },
                  children: [
                    // Logo ou espace vide
                    kit.logoUrl
                      ? {
                          type: "img",
                          props: {
                            src: kit.logoUrl,
                            style: { height: 48, objectFit: "contain", maxWidth: 180 },
                          },
                        }
                      : { type: "div", props: { style: { width: 1, height: 1 }, children: null } },
                    // Tagline ou espace vide
                    kit.tagline
                      ? {
                          type: "div",
                          props: {
                            style: {
                              display: "flex",
                              fontSize: 20,
                              color: `${fg}99`,
                              fontWeight: 400,
                            },
                            children: [kit.tagline],
                          },
                        }
                      : { type: "div", props: { style: { width: 1, height: 1 }, children: null } },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  };

  const svg = await satori(element, { width: 1080, height: 1080, fonts });
  return svgToPng(svg);
}

// ── Gabarit Carrousel ─────────────────────────────────────────────────────────

/**
 * slides = [
 *   { type: "title", title: "...", subtitle: "..." },
 *   { type: "content", title: "...", body: "..." },
 *   ...
 *   { type: "end", cta: "Suivez-moi sur LinkedIn" }
 * ]
 * Retourne un tableau de PNG buffers (un par slide).
 */

// Contenu réel derrière chaque "rôle" d'élément d'un modèle personnalisé. Les rôles
// text liés au contenu (title/subtitle/body/cta/pageNumber) suivent la slide en cours ;
// "custom" est un texte fixe saisi dans l'éditeur, pareil sur toutes les slides de ce type.
function resolveElementText(el, { slide, index, total }) {
  switch (el.role) {
    case "title": return slide.title ?? "";
    case "subtitle": return slide.subtitle ?? "";
    case "body": return slide.body ?? "";
    case "quote": return slide.quote ?? "";
    case "cta": return slide.cta ?? "Suivez-moi sur LinkedIn";
    case "pageNumber": return `${index + 1} / ${total}`;
    default: return el.text ?? "";
  }
}

const TEXT_ALIGN_JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" };

// Rendu d'une slide à partir d'un modèle personnalisé (éditeur visuel, Charte
// graphique) : éléments texte/image positionnés librement en position absolute
// (Satori le supporte — cf. README, propriété "position"), plutôt que la mise en page
// fixe en flex de renderCarouselTemplate. "elements" est la forme stockée dans
// SlideTemplate.data ; chaque élément : { id, type: "text"|"image", role, x, y, width,
// height, fontSize?, fontWeight?, color?, textAlign?, text?, src?, objectFit? }.
async function renderCustomSlide({ elements, slide, kit, fontFamily, index, total }) {
  const bgImage = backgroundImageData(kit);
  const children = elements.map((el) => {
    const pos = {
      display: "flex",
      position: "absolute",
      left: el.x ?? 0,
      top: el.y ?? 0,
      width: el.width ?? 200,
      height: el.height ?? 60,
    };
    if (el.type === "image") {
      const src = el.role === "logo" ? kit.logoUrl : el.src;
      if (!src) return { type: "div", props: { style: pos, children: null } };
      return { type: "img", props: { src, style: { ...pos, objectFit: el.objectFit ?? "contain" } } };
    }
    const text = truncate(resolveElementText(el, { slide, index, total }), 400);
    return {
      type: "div",
      props: {
        style: {
          ...pos,
          fontFamily,
          fontSize: el.fontSize ?? 32,
          fontWeight: el.fontWeight ?? 400,
          color: el.color ?? "#111111",
          lineHeight: el.lineHeight ?? 1.3,
          justifyContent: TEXT_ALIGN_JUSTIFY[el.textAlign] ?? "flex-start",
          textAlign: el.textAlign ?? "left",
        },
        children: text ? [text] : null,
      },
    };
  });

  // Même convention que la mise en page fixe : fond clair (blanc) pour une slide de
  // contenu (texte sombre par défaut), fond aux couleurs de la marque pour titre/fin
  // (texte clair par défaut) — cohérent avec les couleurs choisies dans defaultSlideElements.
  const solidBg = slide.type === "content" ? "#ffffff" : background(kit);

  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        position: "relative",
        width: 1080,
        height: 1080,
        background: bgImage ? "#ffffff" : solidBg,
        ...bgImageStyle(bgImage),
      },
      children,
    },
  };
  const svg = await satori(element, { width: 1080, height: 1080, fonts: getFonts(fontFamily) });
  return svgToPng(svg);
}

export async function renderCarouselTemplate({ slides, brandKit: kit, customTemplates = {} }) {
  const fonts = getFonts(kit.fontFamily ?? "Inter");
  const fontFamily = kit.fontFamily ?? "Inter";
  const accent = kit.accentColor ?? "#ff5a5f";
  const primary = kit.primaryColor ?? "#0a66c2";
  const fg = onPrimary(kit);
  const total = slides.length;

  // Image de fond personnalisée + voiles de lisibilité
  const bgImage = backgroundImageData(kit);
  const voileDark = rgba(primary, 0.78);       // slides titre/fin (texte clair)
  const voileLight = rgba("#ffffff", 0.9);     // slides contenu (texte sombre)

  const pngs = await Promise.all(
    slides.map(async (slide, i) => {
      // Modèle personnalisé (éditeur visuel, Charte graphique) pour ce type de slide :
      // remplace entièrement la mise en page fixe ci-dessous.
      const custom = customTemplates[slide.type];
      if (custom?.elements?.length) {
        return renderCustomSlide({ elements: custom.elements, slide, kit, fontFamily, index: i, total });
      }

      let element;

      // Règle Satori : display:flex requis sur tout div avec 2+ enfants.
      // Aucun position:absolute — on utilise des layouts flex purs (mise en page fixe
      // ci-dessous ; renderCustomSlide, lui, positionne librement en absolute).

      if (slide.type === "title") {
        // ── Slide titre ──
        element = slideRoot({
          bgImage,
          fallbackBg: background(kit),
          voile: voileDark,
          innerStyle: {
            flexDirection: "column",
            fontFamily,
            padding: "80px 80px 60px",
          },
          children: [
              // Barre d'accent top
              { type: "div", props: { style: { height: 8, background: accent, marginBottom: 48 }, children: null } },
              // Numéro de slide
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 18, color: `${fg}66`, fontWeight: 400, marginBottom: 32 },
                  children: [`1 / ${total}`],
                },
              },
              // Titre principal (flex 1 = espace restant)
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", fontSize: 64, fontWeight: 700, color: fg, lineHeight: 1.2, marginBottom: 24 },
                        children: [truncate(slide.title, 80)],
                      },
                    },
                    slide.subtitle
                      ? {
                          type: "div",
                          props: {
                            style: { display: "flex", fontSize: 30, color: `${fg}bb`, fontWeight: 400, lineHeight: 1.4 },
                            children: [truncate(slide.subtitle, 120)],
                          },
                        }
                      : { type: "div", props: { style: { height: 1 }, children: null } },
                  ],
                },
              },
              // Logo bas
              kit.logoUrl
                ? { type: "img", props: { src: kit.logoUrl, style: { height: 40, objectFit: "contain", maxWidth: 160 } } }
                : { type: "div", props: { style: { height: 40 }, children: null } },
          ],
        });
      } else if (slide.type === "end") {
        // ── Slide fin ──
        element = slideRoot({
          bgImage,
          fallbackBg: background(kit),
          voile: voileDark,
          innerStyle: {
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily,
            padding: "80px",
          },
          children: [
              kit.logoUrl
                ? { type: "img", props: { src: kit.logoUrl, style: { height: 72, objectFit: "contain", maxWidth: 220, marginBottom: 40 } } }
                : { type: "div", props: { style: { height: 40 }, children: null } },
              // Divider
              { type: "div", props: { style: { width: 60, height: 4, background: accent, borderRadius: 2, marginBottom: 40 }, children: null } },
              // CTA
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 42, fontWeight: 700, color: fg, textAlign: "center", lineHeight: 1.3, marginBottom: 24 },
                  children: [slide.cta ?? "Suivez-moi sur LinkedIn"],
                },
              },
              kit.tagline
                ? {
                    type: "div",
                    props: {
                      style: { display: "flex", fontSize: 22, color: `${fg}88`, textAlign: "center" },
                      children: [kit.tagline],
                    },
                  }
                : { type: "div", props: { style: { height: 1 }, children: null } },
          ],
        });
      } else {
        // ── Slide contenu ──
        element = slideRoot({
          bgImage,
          fallbackBg: "#ffffff",
          voile: voileLight,
          innerStyle: {
            flexDirection: "column",
            fontFamily,
            padding: "0 80px 60px",
          },
          children: [
              // En-tête : barre brand + numéro (row)
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 48,
                  },
                  children: [
                    { type: "div", props: { style: { height: 6, background: primary, flex: 1 }, children: null } },
                    {
                      type: "div",
                      props: {
                        style: { display: "flex", fontSize: 18, color: `${primary}66`, fontWeight: 600, marginLeft: 24 },
                        children: [`${i + 1} / ${total}`],
                      },
                    },
                  ],
                },
              },
              // Titre
              {
                type: "div",
                props: {
                  style: { display: "flex", fontSize: 46, fontWeight: 700, color: primary, lineHeight: 1.25, marginBottom: 24 },
                  children: [truncate(slide.title, 60)],
                },
              },
              // Séparateur
              { type: "div", props: { style: { width: 60, height: 4, background: accent, borderRadius: 2, marginBottom: 28 }, children: null } },
              // Corps
              {
                type: "div",
                props: {
                  style: { display: "flex", flex: 1, fontSize: 30, color: "#374151", lineHeight: 1.6 },
                  children: [truncate(slide.body ?? "", 320)],
                },
              },
              // Pied
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingTop: 20,
                    borderTop: `2px solid ${primary}22`,
                  },
                  children: [
                    kit.logoUrl
                      ? { type: "img", props: { src: kit.logoUrl, style: { height: 32, objectFit: "contain", maxWidth: 120 } } }
                      : { type: "div", props: { style: { height: 1 }, children: null } },
                  ],
                },
              },
          ],
        });
      }

      const svg = await satori(element, { width: 1080, height: 1080, fonts });
      return svgToPng(svg);
    })
  );

  return pngs;
}
