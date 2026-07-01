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

// ── Cache des polices (une seule requête par famille/grammage par process) ──
const fontCache = new Map();

const SUPPORTED_FONTS = ["Inter", "Poppins", "Montserrat", "Raleway"];

async function loadGoogleFont(family, weight = 400) {
  const key = `${family}-${weight}`;
  if (fontCache.has(key)) return fontCache.get(key);

  // L'User-Agent "old browser" force Google Fonts à retourner du TTF (supporté par Satori)
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}`,
    { headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" } }
  ).then((r) => r.text());

  const match = css.match(/src: url\((.+?)\) format\('truetype'\)/)
    ?? css.match(/src: url\((.+?)\)/);
  if (!match) throw new Error(`Impossible de charger la police : ${family}`);

  const data = await fetch(match[1]).then((r) => r.arrayBuffer());
  fontCache.set(key, data);
  return data;
}

async function getFonts(family) {
  const safeFamily = SUPPORTED_FONTS.includes(family) ? family : "Inter";
  const [regular, bold] = await Promise.all([
    loadGoogleFont(safeFamily, 400),
    loadGoogleFont(safeFamily, 700),
  ]);
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

export async function renderPostTemplate({ text, brandKit: kit }) {
  const fonts = await getFonts(kit.fontFamily ?? "Inter");
  const fontFamily = kit.fontFamily ?? "Inter";
  const bg = background(kit);
  const fg = onPrimary(kit);
  const accent = kit.accentColor ?? "#ff5a5f";
  const shortText = truncate(text, 280);
  const fontSize = shortText.length < 80 ? 52 : shortText.length < 160 ? 42 : 34;

  const element = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: 1080,
        height: 1080,
        background: bg,
        fontFamily,
        position: "relative",
      },
      children: [
        // Barre d'accent gauche
        {
          type: "div",
          props: {
            style: {
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 8,
              background: accent,
            },
            children: [],
          },
        },
        // Zone texte principale
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: "80px 100px 60px 120px",
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 24,
                  },
                  children: [
                    // Guillemet décoratif
                    {
                      type: "div",
                      props: {
                        style: {
                          fontSize: 96,
                          color: accent,
                          lineHeight: 0.8,
                          fontWeight: 700,
                          opacity: 0.6,
                        },
                        children: ["“"],
                      },
                    },
                    // Texte du post
                    {
                      type: "div",
                      props: {
                        style: {
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
              alignItems: "center",
              justifyContent: "space-between",
              padding: "24px 60px",
              background: "rgba(0,0,0,0.25)",
              borderTop: `3px solid ${accent}`,
            },
            children: [
              // Logo ou placeholder
              kit.logoUrl
                ? {
                    type: "img",
                    props: {
                      src: kit.logoUrl,
                      style: { height: 48, objectFit: "contain", maxWidth: 180 },
                      children: [],
                    },
                  }
                : {
                    type: "div",
                    props: {
                      style: {
                        width: 8,
                        height: 8,
                        background: "transparent",
                      },
                      children: [],
                    },
                  },
              // Tagline
              kit.tagline
                ? {
                    type: "div",
                    props: {
                      style: {
                        fontSize: 20,
                        color: `${fg}99`,
                        fontWeight: 400,
                        textAlign: "right",
                        maxWidth: 400,
                      },
                      children: [kit.tagline],
                    },
                  }
                : { type: "div", props: { style: {}, children: [] } },
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
export async function renderCarouselTemplate({ slides, brandKit: kit }) {
  const fonts = await getFonts(kit.fontFamily ?? "Inter");
  const fontFamily = kit.fontFamily ?? "Inter";
  const accent = kit.accentColor ?? "#ff5a5f";
  const primary = kit.primaryColor ?? "#0a66c2";
  const fg = onPrimary(kit);
  const total = slides.length;

  const pngs = await Promise.all(
    slides.map(async (slide, i) => {
      let element;

      if (slide.type === "title") {
        // ── Slide titre ──
        element = {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              width: 1080,
              height: 1080,
              background: background(kit),
              fontFamily,
              padding: "80px 80px 60px",
              position: "relative",
            },
            children: [
              // Barre d'accent top
              {
                type: "div",
                props: {
                  style: { height: 8, background: accent, width: "100%", marginBottom: 60 },
                  children: [],
                },
              },
              // Numéro de slide
              {
                type: "div",
                props: {
                  style: { fontSize: 18, color: `${fg}66`, fontWeight: 400, marginBottom: 40 },
                  children: [`1 / ${total}`],
                },
              },
              // Titre principal
              {
                type: "div",
                props: {
                  style: {
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: 24,
                  },
                  children: [
                    {
                      type: "div",
                      props: {
                        style: { fontSize: 64, fontWeight: 700, color: fg, lineHeight: 1.2 },
                        children: [truncate(slide.title, 80)],
                      },
                    },
                    slide.subtitle
                      ? {
                          type: "div",
                          props: {
                            style: { fontSize: 30, color: `${fg}bb`, fontWeight: 400, lineHeight: 1.4 },
                            children: [truncate(slide.subtitle, 120)],
                          },
                        }
                      : { type: "div", props: { style: {}, children: [] } },
                  ],
                },
              },
              // Logo bas
              kit.logoUrl
                ? {
                    type: "img",
                    props: {
                      src: kit.logoUrl,
                      style: { height: 40, objectFit: "contain", maxWidth: 160, alignSelf: "flex-start" },
                      children: [],
                    },
                  }
                : { type: "div", props: { style: {}, children: [] } },
            ],
          },
        };
      } else if (slide.type === "end") {
        // ── Slide fin ──
        element = {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: 1080,
              height: 1080,
              background: background(kit),
              fontFamily,
              gap: 40,
              padding: 80,
            },
            children: [
              kit.logoUrl
                ? {
                    type: "img",
                    props: {
                      src: kit.logoUrl,
                      style: { height: 72, objectFit: "contain", maxWidth: 220 },
                      children: [],
                    },
                  }
                : { type: "div", props: { style: { height: 8 }, children: [] } },
              {
                type: "div",
                props: {
                  style: {
                    width: 60,
                    height: 4,
                    background: accent,
                    borderRadius: 2,
                  },
                  children: [],
                },
              },
              {
                type: "div",
                props: {
                  style: { fontSize: 42, fontWeight: 700, color: fg, textAlign: "center", lineHeight: 1.3 },
                  children: [slide.cta ?? "Suivez-moi sur LinkedIn"],
                },
              },
              kit.tagline
                ? {
                    type: "div",
                    props: {
                      style: { fontSize: 22, color: `${fg}88`, textAlign: "center" },
                      children: [kit.tagline],
                    },
                  }
                : { type: "div", props: { style: {}, children: [] } },
            ],
          },
        };
      } else {
        // ── Slide contenu ──
        element = {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              width: 1080,
              height: 1080,
              background: "#ffffff",
              fontFamily,
              padding: "60px 80px",
              position: "relative",
            },
            children: [
              // Barre top brand
              {
                type: "div",
                props: {
                  style: { height: 6, background: primary, marginBottom: 48 },
                  children: [],
                },
              },
              // Numéro slide (coin haut droit)
              {
                type: "div",
                props: {
                  style: {
                    position: "absolute",
                    top: 48,
                    right: 80,
                    fontSize: 18,
                    color: `${primary}66`,
                    fontWeight: 600,
                  },
                  children: [`${i + 1} / ${total}`],
                },
              },
              // Titre de la slide
              {
                type: "div",
                props: {
                  style: {
                    fontSize: 46,
                    fontWeight: 700,
                    color: primary,
                    lineHeight: 1.25,
                    marginBottom: 32,
                    paddingRight: 120,
                  },
                  children: [truncate(slide.title, 60)],
                },
              },
              // Séparateur accent
              {
                type: "div",
                props: {
                  style: { width: 60, height: 4, background: accent, borderRadius: 2, marginBottom: 32 },
                  children: [],
                },
              },
              // Corps du texte
              {
                type: "div",
                props: {
                  style: {
                    flex: 1,
                    fontSize: 30,
                    color: "#374151",
                    lineHeight: 1.6,
                    overflow: "hidden",
                  },
                  children: [truncate(slide.body ?? "", 320)],
                },
              },
              // Pied de slide
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    paddingTop: 24,
                    borderTop: `2px solid ${primary}22`,
                  },
                  children: [
                    kit.logoUrl
                      ? {
                          type: "img",
                          props: {
                            src: kit.logoUrl,
                            style: { height: 32, objectFit: "contain", maxWidth: 120, opacity: 0.7 },
                            children: [],
                          },
                        }
                      : { type: "div", props: { style: {}, children: [] } },
                  ],
                },
              },
            ],
          },
        };
      }

      const svg = await satori(element, { width: 1080, height: 1080, fonts });
      return svgToPng(svg);
    })
  );

  return pngs;
}
