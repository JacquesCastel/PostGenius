"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, FileText, Link2, Check, BookOpen, Pause, Play, Volume2, VolumeX, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import LpMark from "./LpMark";
import { pick } from "@/lib/access";

// Motion design de 39 secondes pour la page d'accueil : dictée → post → programmation → funnel (commentaires → leads).
// Toute l'animation est une fonction pure du temps t (secondes) : lecture, pause, boucle, et rendu image par image (/motion?record=1).
// Charte : corail #ff5a5f, marine #1b2a4a, gris bleuté #5a6b85, bleu LinkedIn #0a66c2, fond rosé/pêche/ciel, cartes blanches arrondies.

// Montage : chaque scène garde son rythme d'origine, mais s'immobilise 1 s avant la transition (pour laisser lire),
// et l'écran final reste 3 s. Les scènes se chevauchent toujours de 0,3 s pour le fondu.
const HOLD = 1;
const FINAL_HOLD = 3;
const SCENE_SPANS = [[0, 4.1], [3.8, 9.6], [9.3, 14.6], [14.3, 18.7], [18.4, 25.3], [25.0, 28.0], [27.7, 30]]; // début, fin d'origine (accroche, voix, post, calendrier, entonnoir, confiance, appel)
const TL = SCENE_SPANS.map(([f, e], i) => ({ from: f + i * HOLD, len: e - f, to: e + i * HOLD + (i < SCENE_SPANS.length - 1 ? HOLD : FINAL_HOLD) }));
export const DURATION = TL[TL.length - 1].to; // 39 s
const W = 1920;
const H = 1080;
const C = { coral: "#ff5a5f", coralDark: "#f63d44", navy: "#1b2a4a", muted: "#5a6b85", rose: "#fff1f1", blue: "#0a66c2", sky: "#e8f1fb", green: "#16a34a", amber: "#f59e0b" };
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, d) => clamp01((t - a) / d);
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const typed = (s, p) => s.slice(0, Math.floor(s.length * clamp01(p)));

// Une scène vit entre `from` et `to` ; fondu de 0,45 s en entrée et en sortie (sauf la première, sans entrée).
function Scene({ t, span, first = false, freeze = true, children }) {
  const { from, to, len } = span;
  if (t < from || t > to) return null;
  const fin = first ? 1 : seg(t, from, 0.45);
  const fout = 1 - seg(t, to - 0.45, 0.45);
  const lt = t - from;
  return <div style={{ position: "absolute", inset: 0, opacity: Math.min(fin, fout) }}>{children(freeze ? Math.min(lt, len) : lt)}</div>; // au-delà de sa durée, la scène reste figée
}

const Step = ({ lt, n }) => {
  const p = easeOut(seg(lt, 0.05, 0.5));
  return (
    <div style={{ opacity: p, transform: `translateY(${(1 - p) * 20}px)`, display: "inline-flex", alignItems: "center", gap: 12, background: C.rose, color: C.coral, fontWeight: 700, fontSize: 28, padding: "10px 24px", borderRadius: 999 }}>
      Étape {n}
    </div>
  );
};

function Headline({ lt, lines, sub, size = 92 }) {
  return (
    <div>
      {lines.map((l, i) => {
        const p = easeOut(seg(lt, 0.25 + 0.22 * i, 0.6));
        return (
          <div key={i} style={{ fontSize: size, fontWeight: 800, lineHeight: 1.06, color: l.accent ? C.coral : C.navy, opacity: p, transform: `translateY(${(1 - p) * 44}px)` }}>
            {l.text}
          </div>
        );
      })}
      {sub && (
        <div style={{ marginTop: 30, fontSize: 38, lineHeight: 1.35, color: C.muted, maxWidth: 780, opacity: easeOut(seg(lt, 0.25 + 0.22 * lines.length, 0.6)) }}>{sub}</div>
      )}
    </div>
  );
}

// Carte blanche de droite : arrive en glissant
function Card({ lt, children, top = 120, height = 850 }) {
  const p = back(seg(lt, 0.1, 0.8));
  return (
    <div style={{ position: "absolute", left: 1000, top, width: 800, height, background: "#fff", borderRadius: 56, boxShadow: "0 50px 100px -30px rgba(255,90,95,.35)", border: "2px solid #fff", padding: 48, opacity: clamp01(p * 1.4), transform: `translateX(${(1 - p) * 140}px) scale(${0.96 + 0.04 * p})`, overflow: "hidden" }}>
      {children}
    </div>
  );
}

const Chip = ({ children, bg, color, border, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: bg, color, border: border ? `2px solid ${border}` : "none", fontSize: 28, fontWeight: 600, padding: "12px 26px", borderRadius: 999, whiteSpace: "nowrap", ...style }}>{children}</div>
);

const Left = ({ children }) => <div style={{ position: "absolute", left: 120, top: 270, width: 800 }}>{children}</div>;

// ───────────── Scènes ─────────────

function SceneHook({ lt }) {
  const mark = back(seg(lt, 0.1, 0.8));
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ width: 150, height: 150, borderRadius: 40, background: C.coral, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 30px 60px -15px rgba(255,90,95,.55)", transform: `scale(${mark})`, marginBottom: 56 }}>
        <LpMark size={96} />
      </div>
      <Headline lt={lt - 0.3} size={112} lines={[{ text: "Votre expertise. Vos mots." }, { text: "Vos posts LinkedIn.", accent: true }]} />
      <div style={{ marginTop: 40, fontSize: 40, color: C.muted, opacity: easeOut(seg(lt, 2.0, 0.6)) }}>Une thématique, une humeur : LinkeePost rédige, programme et mesure.</div>
    </div>
  );
}

function SceneVoice({ lt }) {
  const rec = lt > 0.6 && lt < 3.0;
  const timer = Math.round(24 * easeInOut(seg(lt, 0.6, 2.4)));
  const text = "Chez nous, le lundi matin, chaque manager ouvre la semaine par un rituel de dix minutes.";
  const docs = [["Guide RH.pdf", FileText], ["Offre 2026.docx", FileText], ["article-rh.fr", Link2]];
  const count = 14 + docs.filter((_, i) => lt > 3.6 + 0.4 * i + 0.4).length + (lt > 3.3 ? 1 : 0);
  return (
    <>
      <Left>
        <Step lt={lt} n={1} />
        <div style={{ height: 36 }} />
        <Headline lt={lt} lines={[{ text: "Vous parlez." }, { text: "Vous déposez.", accent: true }]} sub="Une idée dictée, des documents, des liens : une base par thématique." />
      </Left>
      <Card lt={lt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontSize: 34, fontWeight: 800, color: C.navy, display: "flex", alignItems: "center", gap: 14 }}>Base éditoriale <Chip bg={C.rose} color={C.coral} style={{ fontSize: 22, padding: "6px 16px" }}>Management</Chip></div>
          <div style={{ fontSize: 26, color: "#9aa5b8" }}>{count}/30 sources</div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "nowrap" }}>
          <Chip bg={C.blue} color="#fff" style={{ fontWeight: 700, fontSize: 23, padding: "10px 20px", gap: 8 }}><Mic size={22} /> Dicter à la voix</Chip>
          <Chip bg="#fff" color={C.muted} border="#e5e9f0" style={{ fontSize: 23, padding: "10px 20px" }}>Coller un texte</Chip>
          <Chip bg="#fff" color={C.muted} border="#e5e9f0" style={{ fontSize: 23, padding: "10px 20px" }}>Un lien</Chip>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 28 }}>
          <div style={{ position: "relative", width: 112, height: 112, flexShrink: 0 }}>
            {rec && [0, 1].map((k) => {
              const p = ((lt * 0.9 + k * 0.5) % 1);
              return <div key={k} style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `4px solid ${C.blue}`, opacity: (1 - p) * 0.5, transform: `scale(${1 + p * 0.7})` }} />;
            })}
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: rec ? C.coral : C.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 40px -10px rgba(10,102,194,.5)" }}>
              <Mic size={50} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, height: 100, flex: 1 }}>
            {Array.from({ length: 24 }).map((_, i) => {
              const amp = rec ? 0.25 + 0.75 * Math.pow(Math.abs(Math.sin(lt * 6.5 + i * 0.7)), 1.3) * (0.5 + 0.5 * Math.sin(i * 0.4 + lt * 2.2) ** 2) : 0.12;
              return <div key={i} style={{ width: 11, height: 12 + 84 * amp, borderRadius: 8, background: rec ? C.coral : "#d9dfe9" }} />;
            })}
          </div>
          <div style={{ fontSize: 34, fontWeight: 700, color: rec ? C.coral : "#9aa5b8", fontVariantNumeric: "tabular-nums", width: 90, textAlign: "right" }}>0:{String(timer).padStart(2, "0")}</div>
        </div>
        <div style={{ marginTop: 24, minHeight: 124, background: "#f7f9fc", borderRadius: 28, padding: "22px 28px", fontSize: 30, lineHeight: 1.38, color: C.navy }}>
          {typed(text, seg(lt, 1.2, 1.8))}
          {lt > 1.2 && lt < 3.1 && <span style={{ opacity: Math.floor(lt * 3) % 2 ? 0 : 1, color: C.coral }}>▍</span>}
        </div>
        <div style={{ marginTop: 14, height: 52 }}>
          {lt > 3.2 && (
            <Chip bg="#e8f7ee" color={C.green} style={{ opacity: easeOut(seg(lt, 3.2, 0.4)), transform: `translateY(${(1 - easeOut(seg(lt, 3.2, 0.4))) * 16}px)` }}><Check size={26} /> Relu et ajouté à la base</Chip>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          {docs.map(([label, Icon], i) => {
            const p = back(seg(lt, 3.6 + 0.4 * i, 0.5));
            return (
              <div key={label} style={{ display: "inline-flex", alignItems: "center", gap: 10, background: C.sky, color: C.blue, fontSize: 20, fontWeight: 600, padding: "8px 14px", borderRadius: 16, whiteSpace: "nowrap", opacity: clamp01(p), transform: `translateY(${(1 - p) * 40}px)` }}>
                <Icon size={20} /> {label}
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function ScenePost({ lt }) {
  const lines = [
    { t: "Le lundi matin décide de la semaine.", bold: true, a: 0.8, d: 0.9 },
    { t: "Chez nous, chaque manager ouvre la semaine par un rituel de dix minutes avec son équipe.", a: 1.7, d: 1.4 },
    { t: "Pas une réunion de plus. Dix minutes pour aligner tout le monde.", a: 3.0, d: 1.0 },
  ];
  const chips = [[BookOpen, "Sources utilisées : 2 sur ce post", C.sky, C.blue, 3.7], [Check, "Votre voix respectée", "#e8f7ee", C.green, 4.1], [ShieldCheck, "Aucun chiffre inventé", C.rose, C.coral, 4.5]];
  return (
    <>
      <Left>
        <Step lt={lt} n={2} />
        <div style={{ height: 36 }} />
        <Headline lt={lt} lines={[{ text: "Un post écrit" }, { text: "dans votre voix.", accent: true }]} sub="Choisissez la thématique et l'humeur : le post garde votre voix et cite ses sources." />
      </Left>
      <Card lt={lt}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div style={{ width: 84, height: 84, borderRadius: "50%", background: `linear-gradient(135deg, #fb923c, ${C.coral}, #ec4899)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}><LpMark size={48} /></div>
          <div>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.navy }}>Votre profil</div>
            <div style={{ fontSize: 24, color: "#9aa5b8" }}>Brouillon · à valider</div>
          </div>
          <Chip bg={C.rose} color={C.coral} style={{ marginLeft: "auto", fontSize: 24 }}><Sparkles size={22} /> Votre voix</Chip>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 22, opacity: easeOut(seg(lt, 0.3, 0.5)) }}>
          <Chip bg={C.sky} color={C.blue} style={{ fontSize: 23, padding: "8px 20px" }}>Thématique · Management</Chip>
          <Chip bg="#e8f7ee" color={C.green} style={{ fontSize: 23, padding: "8px 20px" }}>Humeur · Fierté</Chip>
        </div>
        <div style={{ marginTop: 28, fontSize: 34, lineHeight: 1.42, color: C.navy, minHeight: 235 }}>
          {lines.map((l, i) => {
            const s = typed(l.t, seg(lt, l.a, l.d));
            return s ? <p key={i} style={{ margin: "0 0 18px", fontWeight: l.bold ? 800 : 400 }}>{s}{lt - l.a < l.d && <span style={{ color: C.coral }}>▍</span>}</p> : null;
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
          {chips.map(([Icon, label, bg, color, at]) => {
            const p = easeOut(seg(lt, at, 0.4));
            return <Chip key={label} bg={bg} color={color} style={{ fontSize: 25, padding: "10px 22px", opacity: p, transform: `translateX(${(1 - p) * -40}px)` }}><Icon size={26} /> {label}</Chip>;
          })}
        </div>
      </Card>
    </>
  );
}

function SceneCalendar({ lt }) {
  const days = ["Lun", "Mar", "Mer", "Jeu", "Ven"];
  const posts = [
    ["Rituel du lundi", "09:00", false],
    ["Cas client", "09:00", false],
    ["Nouveauté de la page", "10:30", true],
    ["Coulisses", "09:00", false],
    ["Question à votre réseau", "09:00", false],
  ];
  return (
    <>
      <Left>
        <Step lt={lt} n={3} />
        <div style={{ height: 36 }} />
        <Headline lt={lt} lines={[{ text: "Programmé." }, { text: "Publié.", accent: true }]} sub="Votre tableau de bord du jour : la semaine, et les idées du copilote." />
      </Left>
      <Card lt={lt}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: C.navy }}>Aujourd&apos;hui</div>
          <Chip bg={C.sky} color={C.blue} style={{ fontSize: 24 }}><span style={{ fontWeight: 800 }}>in</span> API officielle</Chip>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 22, opacity: easeOut(seg(lt, 0.3, 0.5)) }}>
          {[["Programmés", "5"], ["Publiés", "2"], ["Idées", "6"]].map(([k, v]) => (
            <div key={k} style={{ flex: 1, background: "#f7f9fc", borderRadius: 22, padding: "10px 18px" }}>
              <div style={{ fontSize: 34, fontWeight: 800, color: C.coral, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: 21, color: C.muted }}>{k}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
          {days.map((d, i) => {
            const [label, hour, org] = posts[i];
            const p = back(seg(lt, 0.7 + 0.35 * i, 0.55));
            const published = lt > 2.2 + 0.3 * i && i < 2;
            return (
              <div key={d} style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 70, fontSize: 26, fontWeight: 700, color: "#9aa5b8" }}>{d}</div>
                <div style={{ flex: 1, height: 92, borderRadius: 28, background: "#f7f9fc", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 8, background: org ? C.blue : C.coral, color: "#fff", borderRadius: 22, padding: "0 26px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, opacity: clamp01(p), transform: `translateX(${(1 - p) * 220}px)`, boxShadow: "0 14px 26px -12px rgba(27,42,74,.35)" }}>
                    <div>
                      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.15 }}>{label}</div>
                      <div style={{ fontSize: 21, opacity: 0.85 }}>{hour}{org ? " · page entreprise" : " · profil"}</div>
                    </div>
                    {published && (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.96)", color: C.green, fontSize: 21, fontWeight: 700, padding: "8px 16px", borderRadius: 999, transform: `scale(${back(seg(lt, 2.2 + 0.3 * i, 0.4))})` }}>
                        <Check size={20} /> Publié
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function SceneFunnel({ lt }) {
  const stages = [
    ["Impressions", 12400, "12 400", C.coral, 760],
    ["Commentaires", 86, "86", "#f4727a", 610],
    ["Leads notés par l'IA", 31, "31", "#e04a8a", 460],
    ["Conversations", 9, "9", C.blue, 320],
  ];
  const leads = [
    ["C", "Camille R.", "DRH · ETI industrielle", "« On vit ça chez nous. »", "Excellent", C.green, "#e8f7ee", 1.2, 3.0],
    ["M", "Marc D.", "Dirigeant · PME de services", "« Très utile, merci du partage. »", "Bon", C.coral, C.rose, 1.8, 3.5],
    ["S", "Sonia L.", "Étudiante", "« Intéressant ! »", "Moyen", C.amber, "#fef3e0", 2.4, 4.0],
  ];
  return (
    <>
      <div style={{ position: "absolute", left: 120, top: 190, width: 800 }}>
        <Step lt={lt} n={4} />
        <div style={{ height: 28 }} />
        <Headline lt={lt} size={84} lines={[{ text: "Du post" }, { text: "au client.", accent: true }]} />
      </div>
      {/* Funnel */}
      <div style={{ position: "absolute", left: 120, top: 560, width: 780 }}>
        {stages.map(([label, n, shown, color, w], i) => {
          const p = easeOut(seg(lt, 0.5 + 0.5 * i, 0.7));
          const count = i === 0 ? Math.round(n * p) : Math.round(n * p);
          const text = i === 0 ? count.toLocaleString("fr-FR") : String(count);
          return (
            <div key={label} style={{ position: "relative", height: 96, marginBottom: 16, width: 780, display: "flex", justifyContent: "center" }}>
              <div style={{ width: w * p, height: 96, background: color, clipPath: "polygon(0 0, 100% 0, 95% 100%, 5% 100%)", display: "flex", alignItems: "center", justifyContent: "center", gap: 18, color: "#fff", whiteSpace: "nowrap", overflow: "hidden" }}>
                {p > 0.55 && <><span style={{ fontSize: 34, fontWeight: 800 }}>{text}</span><span style={{ fontSize: 26, fontWeight: 600, opacity: 0.95 }}>{label}</span></>}
              </div>
            </div>
          );
        })}
        {/* particules qui descendent dans l'entonnoir */}
        {lt > 0.8 && Array.from({ length: 9 }).map((_, i) => {
          const q = (lt * 0.55 + i / 9) % 1;
          const x = 390 + Math.sin(i * 2.3 + lt) * (180 * (1 - q) + 20);
          return <div key={i} style={{ position: "absolute", left: x, top: q * 440, width: 14, height: 14, borderRadius: "50%", background: "#fff", opacity: Math.sin(q * Math.PI) * 0.9, boxShadow: "0 0 12px rgba(255,255,255,.9)" }} />;
        })}
      </div>
      {/* Commentaires → leads notés */}
      <div style={{ position: "absolute", left: 1000, top: 190, width: 800 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: C.navy, marginBottom: 6, whiteSpace: "nowrap", opacity: easeOut(seg(lt, 0.8, 0.5)) }}>Vos commentaires, comparés à votre cible</div>
        <div style={{ fontSize: 26, color: C.muted, marginBottom: 28, opacity: easeOut(seg(lt, 0.9, 0.5)) }}>Cible décrite : dirigeants et DRH de PME / ETI</div>
        {leads.map(([ini, name, role, quote, level, color, bg, at, scoreAt], i) => {
          const p = back(seg(lt, at, 0.6));
          const sp = back(seg(lt, scoreAt, 0.45));
          return (
            <div key={name} style={{ background: "#fff", borderRadius: 36, boxShadow: "0 30px 60px -25px rgba(255,90,95,.35)", padding: "20px 28px", marginBottom: 16, display: "flex", alignItems: "center", gap: 24, opacity: clamp01(p), transform: `translateX(${(1 - p) * 120}px)` }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.sky, color: C.blue, fontSize: 34, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{ini}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 30, fontWeight: 800, color: C.navy }}>{name}</div>
                <div style={{ fontSize: 23, color: "#9aa5b8" }}>{role}</div>
                <div style={{ fontSize: 25, color: C.muted, marginTop: 6 }}>{quote}</div>
              </div>
              <div style={{ background: bg, color, fontSize: 26, fontWeight: 800, padding: "10px 22px", borderRadius: 999, opacity: clamp01(sp), transform: `scale(${0.6 + 0.4 * sp})`, minWidth: 150, textAlign: "center" }}>{level}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 24, color: C.muted, marginTop: 8, whiteSpace: "nowrap", opacity: easeOut(seg(lt, 3.8, 0.5)) }}>Vous décidez qui contacter : aucun message n&apos;est envoyé à votre place.</div>
      </div>
      <div style={{ position: "absolute", right: 70, bottom: 38, fontSize: 20, color: "#9aa5b8" }}>Données d&apos;exemple</div>
    </>
  );
}

function SceneTrust({ lt }) {
  const items = [["Sources citées dans chaque post", BookOpen], ["API officielle LinkedIn", ShieldCheck], ["Données LinkedIn effacées sous 48 h", Check]];
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <Headline lt={lt} size={104} lines={[{ text: "Vous gardez" }, { text: "la main.", accent: true }]} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, marginTop: 56 }}>
        {items.map(([label, Icon], i) => {
          const p = back(seg(lt, 0.9 + 0.3 * i, 0.5));
          return (
            <div key={label} style={{ background: "#fff", borderRadius: 40, padding: "22px 40px", boxShadow: "0 30px 60px -25px rgba(255,90,95,.35)", display: "flex", alignItems: "center", gap: 20, fontSize: 32, whiteSpace: "nowrap", fontWeight: 700, color: C.navy, opacity: clamp01(p), transform: `translateY(${(1 - p) * 60}px)` }}>
              <span style={{ width: 56, height: 56, borderRadius: 18, background: C.rose, color: C.coral, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon size={30} /></span>
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SceneCta({ lt }) {
  const pulse = 1 + 0.035 * Math.sin(lt * 6);
  const mark = back(seg(lt, 0.05, 0.6));
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ width: 110, height: 110, borderRadius: 30, background: C.coral, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 24px 50px -15px rgba(255,90,95,.55)", transform: `scale(${mark})`, marginBottom: 40 }}><LpMark size={70} /></div>
      <Headline lt={lt} size={104} lines={pick([{ text: "Rejoignez" }, { text: "la bêta fermée.", accent: true }], [{ text: "Essayez 14 jours," }, { text: "gratuitement.", accent: true }])} />
      <div style={{ fontSize: 38, color: C.muted, marginTop: 28, opacity: easeOut(seg(lt, 0.9, 0.5)) }}>{pick("Sur invitation, sans carte bancaire.", "Sans carte bancaire.")}</div>
      <div style={{ marginTop: 48, display: "inline-flex", alignItems: "center", gap: 14, background: C.coral, color: "#fff", fontSize: 40, fontWeight: 700, padding: "26px 60px", borderRadius: 999, boxShadow: "0 28px 60px -18px rgba(255,90,95,.7)", opacity: easeOut(seg(lt, 1.1, 0.5)), transform: `scale(${pulse})` }}>
        {pick("Rejoindre la bêta", "Démarrer gratuitement")} <ChevronRight size={40} />
      </div>
      <div style={{ marginTop: 30, fontSize: 30, color: C.muted, opacity: easeOut(seg(lt, 1.3, 0.5)) }}>postgenius.network</div>
    </div>
  );
}

// ───────────── Scène complète à l'instant t ─────────────
export function Stage({ t }) {
  const end = 1 - seg(t, DURATION - 0.35, 0.35); // fondu final pour boucler proprement
  const start = seg(t, 0, 0.25);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, fontFamily: FONT, overflow: "hidden", background: "linear-gradient(180deg, #fff1f2 0%, #fff7ed 45%, #f0f9ff 100%)", opacity: Math.min(end, start) }}>
      <div style={{ position: "absolute", left: -260, top: -280, width: 760, height: 760, borderRadius: "50%", background: "rgba(254,205,211,.55)", filter: "blur(110px)" }} />
      <div style={{ position: "absolute", right: -220, top: 160, width: 680, height: 680, borderRadius: "50%", background: "rgba(186,230,253,.55)", filter: "blur(110px)" }} />
      <div style={{ position: "absolute", left: 300, bottom: -360, width: 760, height: 760, borderRadius: "50%", background: "rgba(254,215,170,.45)", filter: "blur(110px)" }} />

      {/* Logo permanent (hors accroche et appel final, qui ont le leur) */}
      {t > TL[1].from && t < TL[6].from && (
        <div style={{ position: "absolute", left: 120, top: 70, display: "flex", alignItems: "center", gap: 18, opacity: seg(t, TL[1].from, 0.4) * (1 - seg(t, TL[6].from - 0.6, 0.4)) }}>
          <div style={{ width: 62, height: 62, borderRadius: 18, background: C.coral, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><LpMark size={40} /></div>
          <span style={{ fontSize: 40, fontWeight: 800, color: C.navy }}>LinkeePost</span>
        </div>
      )}

      <Scene t={t} span={TL[0]} first>{(lt) => <SceneHook lt={lt} />}</Scene>
      <Scene t={t} span={TL[1]}>{(lt) => <SceneVoice lt={lt} />}</Scene>
      <Scene t={t} span={TL[2]}>{(lt) => <ScenePost lt={lt} />}</Scene>
      <Scene t={t} span={TL[3]}>{(lt) => <SceneCalendar lt={lt} />}</Scene>
      <Scene t={t} span={TL[4]}>{(lt) => <SceneFunnel lt={lt} />}</Scene>
      <Scene t={t} span={TL[5]}>{(lt) => <SceneTrust lt={lt} />}</Scene>
      <Scene t={t} span={TL[6]} freeze={false}>{(lt) => <SceneCta lt={lt} />}</Scene>

      {/* Progression */}
      <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 8, background: "rgba(255,90,95,.12)" }}>
        <div style={{ width: `${(t / DURATION) * 100}%`, height: 8, background: C.coral }} />
      </div>
    </div>
  );
}

const SOUND_URL = "/motion/linkeepost-bande-son.mp3"; // bande son originale (musique et effets), 30 s, calée sur la même horloge
const POSTER_T = TL[4].from + 3.1; // image fixe (entonnoir) : avant le chargement, sans JavaScript et si l'utilisateur préfère moins d'animations

export default function BrandMotion({ record = false, className = "" }) {
  const wrap = useRef(null);
  const [scale, setScale] = useState(0);
  const [t, setT] = useState(POSTER_T);
  const [playing, setPlaying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const clock = useRef({ last: 0, t: 0, raf: 0 });
  const audio = useRef(null);
  const [sound, setSound] = useState(false); // coupé par défaut : le navigateur n'autorise le son qu'après un clic

  // Échelle : la scène fait 1920×1080 et s'adapte à la largeur disponible
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Préférence « moins d'animations » ; visibilité à l'écran
  useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(mq.matches && !record);
    } catch { setReduced(false); }
    if (record) return;
    const el = wrap.current;
    if (!el || !("IntersectionObserver" in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [record]);

  // Mode enregistrement : le temps est piloté de l'extérieur (rendu image par image)
  useEffect(() => {
    if (!record) return;
    window.__motionSet = (v) => setT(v);
    window.__motionReady = true;
    setT(0);
  }, [record]);

  // Lecture automatique quand la scène est visible
  useEffect(() => {
    if (record || reduced) return;
    setPlaying(visible);
  }, [visible, reduced, record]);

  const tick = useCallback((now) => {
    const c = clock.current;
    const dt = c.last ? (now - c.last) / 1000 : 0;
    c.last = now;
    c.t = (c.t + dt) % DURATION;
    setT(c.t);
    const a = audio.current;
    if (a && !a.paused && Math.abs(a.currentTime - c.t) > 0.3) { try { a.currentTime = c.t; } catch {} } // recale le son sur l'image (boucle, onglet ralenti)
    c.raf = requestAnimationFrame(tick);
  }, []);
  useEffect(() => {
    const c = clock.current;
    if (!playing || record) return;
    c.last = 0;
    c.t = t >= DURATION - 0.05 || t === POSTER_T ? 0 : t;
    c.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(c.raf);
  }, [playing, record, tick]);

  // Le son suit la lecture : actif seulement si l'utilisateur l'a demandé et que l'animation tourne
  useEffect(() => {
    const a = audio.current;
    if (!sound || !playing) { a?.pause(); return; }
    const el = a ?? new Audio(SOUND_URL);
    audio.current = el;
    el.loop = true;
    try { el.currentTime = clock.current.t; } catch {}
    el.play().catch(() => setSound(false));
  }, [sound, playing]);
  useEffect(() => () => { audio.current?.pause(); audio.current = null; }, []);

  const toggle = () => { if (reduced) { setReduced(false); setPlaying(true); } else setPlaying((p) => !p); };

  return (
    <div
      ref={wrap}
      className={`relative w-full overflow-hidden ${className}`}
      style={{ aspectRatio: "16 / 9", background: "linear-gradient(180deg, #fff1f2, #fff7ed 45%, #f0f9ff)" }}
      role="group"
      aria-label="Animation d'environ 40 secondes : vous dictez ou déposez vos sources par thématique, vous choisissez une humeur, LinkeePost rédige un post dans votre voix, le programme et le publie depuis votre tableau de bord, puis transforme les commentaires en leads notés par rapport à votre cible."
      data-testid="brand-motion"
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left", visibility: scale ? "visible" : "hidden" }} aria-hidden="true">
        <Stage t={t} />
      </div>
      {!record && (
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Mettre l'animation en pause" : "Lancer l'animation"}
          className="absolute right-3 bottom-4 sm:right-5 sm:bottom-6 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-[#1b2a4a] shadow-lg flex items-center justify-center"
          data-testid="motion-toggle"
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
      )}
      {!record && (
        <button
          type="button"
          onClick={() => { if (reduced) { setReduced(false); setPlaying(true); } setSound((v) => !v); }}
          aria-label={sound ? "Couper le son" : "Activer le son"}
          aria-pressed={sound}
          className="absolute right-16 bottom-4 sm:right-20 sm:bottom-6 h-10 rounded-full bg-white/90 hover:bg-white text-[#1b2a4a] shadow-lg flex items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          data-testid="motion-sound"
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          <span className="hidden sm:inline">{sound ? "Son activé" : "Activer le son"}</span>
        </button>
      )}
      <p className="sr-only">
        Étape 1 : vous parlez ou vous déposez vos documents et liens dans la base d'une thématique. Étape 2 : vous choisissez une humeur et LinkeePost rédige un post dans votre voix, avec les sources utilisées. Étape 3 : le post est programmé et publié depuis votre tableau de bord « Aujourd'hui », avec les idées du copilote. Étape 4 : les commentaires deviennent des contacts notés par l&apos;IA selon votre cible, et vous décidez qui contacter.
        {pick(" Bêta fermée : accès sur invitation, sans carte bancaire.", " 14 jours d'essai gratuit, sans carte bancaire.")}
      </p>
    </div>
  );
}
