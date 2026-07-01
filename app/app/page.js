"use client";

import { useState, useEffect } from "react";
import {
  Sparkles, FileText, Layers, Video, Copy, Check, Trash2, Send,
  Clock, PenLine, History, RefreshCw, Linkedin, ChevronRight, ChevronLeft, X, LogOut,
  AlertCircle, UserPlus, LogIn, UserRound, Save, LayoutDashboard, CalendarDays, List, ExternalLink,
  BarChart3, Eye, MousePointerClick, ThumbsUp, MessageSquare, Share2, Undo2, Layers as LayersIcon,
  Megaphone, ChevronDown, Image as ImageIcon, ShieldCheck, Lock, ArrowUpCircle, MapPin, Bell, Camera,
  CreditCard, Gauge, Users, Smartphone, Monitor
} from "lucide-react";
import { PLANS, PLAN_IDS, planLabel, planAllows, planOf, trialDaysLeft, accessState } from "@/lib/plans";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import LpMark from "@/components/LpMark";
import { scorePost } from "@/lib/score";

// Format compact des tokens : 12 500 → "12,5k", 3 200 000 → "3,2M"
function fmtTokens(n) {
  if (n == null) return "—";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(".", ",") + "k";
  return String(n);
}

const POST_TYPES = [
  { id: "simple", label: "Post simple", icon: FileText, desc: "Texte seul, format classique" },
  { id: "carrousel", label: "Carrousel", icon: Layers, desc: "Post + plan de slides" },
  { id: "video", label: "Vidéo", icon: Video, desc: "Post + script vidéo" },
];

const TONES = ["Professionnel", "Inspirant", "Pédagogique", "Direct", "Storytelling"];

const EXPERTISE_SUGGESTIONS = [
  "consultant en marketing digital",
  "développeur freelance",
  "coach en reconversion professionnelle",
  "expert-comptable",
  "recruteur tech",
];

const STATUS_STYLES = {
  brouillon: "bg-gray-100 text-gray-600",
  "à valider": "bg-purple-100 text-purple-700",
  programmé: "bg-amber-100 text-amber-700",
  publié: "bg-green-100 text-green-700",
  erreur: "bg-red-100 text-red-700",
};

const COMM_GOALS = ["Notoriété", "Génération de leads", "Recrutement", "Personal branding", "Vente"];
const WEEK_DAYS = [
  { n: 1, label: "Lun" },
  { n: 2, label: "Mar" },
  { n: 3, label: "Mer" },
  { n: 4, label: "Jeu" },
  { n: 5, label: "Ven" },
  { n: 6, label: "Sam" },
  { n: 7, label: "Dim" },
];

// Prochains créneaux selon le rythme de publication du profil
function nextPreferredSlots(profile, count = 1, from = new Date()) {
  const days = (profile?.publishDays ?? "").split(",").map(Number).filter(Boolean);
  if (!days.length) return null;
  const [h, m] = (profile?.publishTime ?? "09:00").split(":").map(Number);
  const slots = [];
  const cursor = new Date(from);
  for (let i = 0; slots.length < count && i < 400; i++) {
    const isoDay = ((cursor.getDay() + 6) % 7) + 1; // 1 = lundi
    const candidate = new Date(cursor);
    candidate.setHours(h || 9, m || 0, 0, 0);
    if (days.includes(isoDay) && candidate > from) slots.push(candidate);
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

function toDatetimeLocal(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// "dans 2 j 4 h", "dans 35 min", "imminent"
function relativeTime(date) {
  const diff = new Date(date) - Date.now();
  if (diff <= 0) return "imminent";
  const min = Math.round(diff / 60000);
  if (min < 60) return `dans ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `dans ${h} h ${min % 60 ? `${min % 60} min` : ""}`.trim();
  const d = Math.floor(h / 24);
  return `dans ${d} j${h % 24 ? ` ${h % 24} h` : ""}`;
}

function fmtDateTime(date) {
  return new Date(date).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Parse la réponse en JSON, avec un message lisible si le serveur a planté
// (réponse vide ou page d'erreur HTML au lieu de JSON)
async function readJson(res) {
  const raw = await res.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `Erreur serveur (${res.status}). Consultez le terminal de "npm run dev" — base initialisée ? (npx prisma db push)`
    );
  }
}

// ----------------------------------------------------------------
// Écran de connexion / inscription
// ----------------------------------------------------------------
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("register"); // register | login | forgot
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null); // offre choisie depuis la landing (?plan=)

  // Si on arrive depuis un bouton d'offre (?plan=pro), pré-sélectionner l'inscription
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("plan");
    if (p && PLAN_IDS.includes(p)) {
      setPlan(p);
      setMode("register");
    } else if (params.get("mode") === "login") {
      setMode("login");
    }
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: fields.email }),
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error || "Erreur");
        setInfo(data.message);
        return;
      }
      const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "register" ? { ...fields, plan } : fields),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const planInfo = plan ? PLANS[plan] : null;
  const planBullets = planInfo
    ? [
        planInfo.postsPerMonth == null ? "Posts illimités" : `${planInfo.postsPerMonth} posts par mois`,
        planInfo.imagesPerMonth == null
          ? "Images IA illimitées"
          : planInfo.imagesPerMonth === 0
          ? null
          : `${planInfo.imagesPerMonth} images IA / mois`,
        planInfo.campaigns ? "Campagnes guidées par l'IA" : null,
        planInfo.veille ? "Veille connectée" : null,
        planInfo.orgPublish ? "Publication page entreprise" : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-rose-50 via-orange-50/40 to-sky-50 text-[#1b2a4a]">
      <SiteHeader />
      <main className="flex-1 flex items-center">
        <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center px-6 py-12">
          {/* Gauche — communication centrée + visuel */}
          <div className="flex flex-col items-center text-center">
            <h1 className="text-4xl md:text-5xl font-extrabold leading-tight max-w-lg">
              Créez vos posts et <span className="text-[#ff5a5f]">campagnes LinkedIn</span> avec l'IA
            </h1>
            <p className="text-[#5a6b85] mt-4 leading-relaxed max-w-md">
              LinkeePost rédige des posts à votre image, programme vos publications et suit vos
              statistiques — en pilote automatique.
            </p>

            {/* Visuel illustratif */}
            <div className="relative mt-12 mb-4 w-full max-w-sm">
              <div className="pointer-events-none absolute -top-8 -left-8 w-32 h-32 bg-rose-200/50 rounded-full blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -right-8 w-32 h-32 bg-sky-200/50 rounded-full blur-2xl" />

              <div className="relative bg-white rounded-3xl shadow-2xl shadow-rose-200/40 border border-white p-5 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff5a5f] to-pink-500" />
                  <div>
                    <div className="h-2.5 w-24 bg-gray-200 rounded-full" />
                    <div className="h-2 w-16 bg-gray-100 rounded-full mt-1.5" />
                  </div>
                  <span className="ml-auto text-[10px] font-semibold text-[#ff5a5f] bg-[#fff1f1] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Sparkles size={10} /> IA
                  </span>
                </div>
                <div className="space-y-2 mt-4">
                  <div className="h-2 w-full bg-gray-100 rounded-full" />
                  <div className="h-2 w-11/12 bg-gray-100 rounded-full" />
                  <div className="h-2 w-3/4 bg-gray-100 rounded-full" />
                </div>
                <div className="h-24 rounded-2xl mt-4 bg-gradient-to-br from-orange-300 via-[#ff5a5f] to-pink-400" />
                <div className="flex items-center gap-4 mt-4 text-gray-300">
                  <ThumbsUp size={16} />
                  <MessageSquare size={16} />
                  <Share2 size={16} />
                </div>
              </div>

              <div className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl shadow-rose-200/40 px-3 py-2 flex items-center gap-2">
                <CalendarDays size={16} className="text-[#ff5a5f]" />
                <div className="text-left">
                  <p className="text-[9px] text-gray-400 leading-none">Programmé</p>
                  <p className="text-xs font-bold leading-tight">jeu. 09:00</p>
                </div>
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl shadow-xl shadow-sky-200/40 px-3 py-2 flex items-center gap-2">
                <BarChart3 size={16} className="text-sky-500" />
                <div className="text-left">
                  <p className="text-[9px] text-gray-400 leading-none">Engagement</p>
                  <p className="text-xs font-bold leading-tight">+38 %</p>
                </div>
              </div>
            </div>

            {planInfo ? (
              <div className="mt-10 rounded-2xl border border-[#ffd5d6] bg-white/70 backdrop-blur p-4 max-w-sm w-full text-left">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#ff5a5f] flex items-center gap-1">
                      <Sparkles size={12} /> Votre offre
                    </p>
                    <p className="font-extrabold text-lg leading-tight">{planLabel(plan)}</p>
                  </div>
                  <p className="text-right leading-none">
                    <span className="text-2xl font-extrabold">{planInfo.price} €</span>
                    <span className="text-[11px] text-gray-400 block mt-0.5">/mois HT</span>
                  </p>
                </div>
                <p className="text-xs text-[#5a6b85] mt-1.5">14 jours d'essai gratuit, sans carte bancaire.</p>
              </div>
            ) : (
              <p className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#ff5a5f] bg-[#fff1f1] px-3 py-1.5 rounded-full">
                <Sparkles size={13} /> 14 jours d'essai gratuit — sans carte bancaire
              </p>
            )}
          </div>

          {/* Droite — formulaire */}
          <div className="bg-white rounded-3xl border border-white shadow-xl shadow-rose-100/40 p-7 w-full max-w-md lg:justify-self-end">
            <h2 className="text-xl font-extrabold">
              {mode === "login" ? "Connexion" : mode === "forgot" ? "Mot de passe oublié" : "Créer votre compte"}
            </h2>
            <p className="text-sm text-[#5a6b85] mt-1 mb-5">
              {mode === "login"
                ? "Content de vous revoir."
                : mode === "forgot"
                ? "Indiquez votre email, on vous envoie un lien."
                : "Gratuit pendant 14 jours, sans carte bancaire."}
            </p>

          <form onSubmit={submit} className="space-y-3">
            {mode === "register" && (
              <input
                type="text"
                placeholder="Votre nom"
                value={fields.name}
                onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
            )}
            <input
              type="email"
              required
              placeholder="Email"
              value={fields.email}
              onChange={(e) => setFields((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
            />
            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={8}
                placeholder={mode === "register" ? "Mot de passe (8 caractères min.)" : "Mot de passe"}
                value={fields.password}
                onChange={(e) => setFields((f) => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
            )}
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1.5">
                <AlertCircle size={14} /> {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 flex items-center gap-1.5">
                <Check size={14} /> {info}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-semibold py-3 rounded-full flex items-center justify-center gap-2 shadow-lg shadow-rose-300/40 transition-colors"
            >
              {loading && <RefreshCw size={16} className="animate-spin" />}
              {mode === "login"
                ? "Se connecter"
                : mode === "register"
                ? plan
                  ? "Démarrer mon essai gratuit"
                  : "Créer mon compte"
                : "Envoyer le lien"}
            </button>
          </form>

          {mode === "login" && (
            <button
              onClick={() => {
                setMode("forgot");
                setError(null);
              }}
              className="text-xs text-gray-500 hover:text-[#ff5a5f] mt-3 block mx-auto"
            >
              Mot de passe oublié ?
            </button>
          )}
          {mode === "forgot" && (
            <button
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
              className="text-xs text-gray-500 hover:text-[#ff5a5f] mt-3 block mx-auto"
            >
              ← Retour à la connexion
            </button>
          )}
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}

// ----------------------------------------------------------------
// Modal de programmation : date/heure + compte de publication
// ----------------------------------------------------------------
function ScheduleModal({ draft, linkedin, orgs, profile, onClose, onScheduled, showToast, statusAfter = "programmé" }) {
  // Par défaut : prochain créneau du rythme de publication, sinon demain 9 h
  const preferredSlot = nextPreferredSlots(profile, 1)?.[0] ?? null;
  const defaultWhen = () => {
    if (preferredSlot) return toDatetimeLocal(preferredSlot);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toDatetimeLocal(d);
  };
  const [when, setWhen] = useState(defaultWhen());
  const [tgt, setTgt] = useState(draft.target ?? "person");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const date = new Date(when);
    if (isNaN(date) || date <= new Date()) {
      showToast("Choisissez une date dans le futur");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/drafts/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusAfter, scheduledAt: date.toISOString(), target: tgt }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      onScheduled({ status: statusAfter, scheduledAt: date.toISOString(), target: tgt });
      showToast(
        statusAfter === "à valider"
          ? `Post planifié pour le ${fmtDateTime(date)} — en attente de validation`
          : `Post programmé pour le ${fmtDateTime(date)} ✓`
      );
      onClose();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Clock size={18} className="text-[#ff5a5f]" /> Programmer la publication
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-4 line-clamp-3 whitespace-pre-wrap">
          {draft.text.slice(0, 180)}
          {draft.text.length > 180 ? "…" : ""}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Date et heure</label>
            <input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
            />
            {preferredSlot && when === toDatetimeLocal(preferredSlot) && (
              <p className="text-xs text-[#ff5a5f] mt-1">
                ✓ Prochain créneau selon votre rythme de publication
              </p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Publier en tant que</label>
            <select
              value={tgt}
              onChange={(e) => setTgt(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
            >
              <option value="person">Profil personnel{linkedin.name ? ` (${linkedin.name})` : ""}</option>
              {linkedin.orgConnected &&
                orgs.map((o) => (
                  <option key={o.urn} value={o.urn}>
                    Page : {o.name}
                  </option>
                ))}
            </select>
          </div>
          {!linkedin.connected && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2.5 flex items-start gap-1.5">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              LinkedIn n'est pas connecté : la publication échouera à l'échéance si le compte n'est pas
              connecté d'ici là.
            </p>
          )}
          <button
            onClick={submit}
            disabled={saving}
            className="w-full bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Clock size={16} />}
            Programmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Calendrier mensuel des publications
// ----------------------------------------------------------------
function CalendarMonth({ drafts }) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const events = drafts
    .filter(
      (d) => (d.status === "programmé" || d.status === "erreur" || d.status === "à valider") && d.scheduledAt
    )
    .map((d) => ({ date: new Date(d.scheduledAt), draft: d }))
    .concat(
      drafts
        .filter((d) => d.status === "publié" && (d.publishedAt || d.createdAt))
        .map((d) => ({ date: new Date(d.publishedAt ?? d.createdAt), draft: d }))
    );

  // Grille : semaines commençant le lundi
  const firstDay = new Date(month);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(firstDay);
  start.setDate(1 - offset);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = new Date();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const DOT = {
    programmé: "bg-amber-400",
    "à valider": "bg-purple-500",
    erreur: "bg-red-500",
    publié: "bg-green-500",
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold capitalize">
          {month.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
        </p>
        <button
          onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {["lun", "mar", "mer", "jeu", "ven", "sam", "dim"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-lg overflow-hidden">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month.getMonth();
          const dayEvents = events.filter((e) => sameDay(e.date, d));
          return (
            <div
              key={i}
              className={`min-h-16 p-1.5 text-xs ${inMonth ? "bg-white" : "bg-gray-50 text-gray-300"} ${
                sameDay(d, today) ? "ring-2 ring-inset ring-[#ff5a5f]" : ""
              }`}
            >
              <span className={sameDay(d, today) ? "font-bold text-[#ff5a5f]" : ""}>{d.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {dayEvents.slice(0, 2).map((e, j) => (
                  <div
                    key={j}
                    title={`${e.draft.theme} — ${e.draft.status}`}
                    className="flex items-center gap-1 truncate"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[e.draft.status]}`} />
                    <span className="truncate text-gray-600">{e.draft.theme || "Post"}</span>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <p className="text-gray-400">+{dayEvents.length - 2}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Programmé</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Publié</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Erreur</span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Wizard de création de campagne LinkedIn
// Thème → questions IA de cadrage → post d'exemple à valider → planification
// ----------------------------------------------------------------
function CampaignWizard({ profile, linkedin, orgs, onClose, onLaunched, showToast, initial, inline = false }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? "");
  const [theme, setTheme] = useState(initial?.theme ?? "");
  const [objective, setObjective] = useState("");
  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [sample, setSample] = useState(null);
  const [sampleApproved, setSampleApproved] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [periodDays, setPeriodDays] = useState(7);
  const [target, setTarget] = useState("person");
  const [busy, setBusy] = useState(false);
  // Article de veille servant de point de départ (pré-rempli via `initial` ou choisi à l'étape 1)
  const [seedContext, setSeedContext] = useState(initial?.context ?? "");
  const [pickedLink, setPickedLink] = useState(null);
  const [veille, setVeille] = useState(null);

  useEffect(() => {
    fetch("/api/veille")
      .then((r) => r.json())
      .then((d) => setVeille(d.items ?? []))
      .catch(() => setVeille([]));
  }, []);

  const pickArticle = (it) => {
    if (pickedLink === (it.link ?? it.title)) {
      // Désélection
      setPickedLink(null);
      setSeedContext("");
      return;
    }
    setTheme(it.title);
    setName(it.title.slice(0, 60));
    setPickedLink(it.link ?? it.title);
    setSeedContext(
      `Campagne initiée depuis cet article de veille :\n- Titre : ${it.title}${
        it.excerpt ? `\n- Extrait : ${it.excerpt}` : ""
      }${it.link ? `\n- URL : ${it.link}` : ""}\nLes posts de la campagne doivent partir de ce sujet d'actualité et le décliner sous différents angles pour la cible.`
    );
  };

  const STEPS = ["Thème", "Cadrage", "Exemple", "Lancement"];

  // Brief de campagne assemblé à partir des réponses + exemple validé
  const buildContext = () => {
    let ctx = seedContext ? `${seedContext}\n\n` : "";
    (questions ?? []).forEach((q, i) => {
      if (answers[i]?.trim()) ctx += `Q : ${q}\nR : ${answers[i].trim()}\n\n`;
    });
    if (sampleApproved && sample) {
      ctx += `Exemple de post validé par le client — s'en inspirer pour le style, le niveau et l'angle :\n"""${sample}"""`;
    }
    return ctx.trim();
  };

  const loadQuestions = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/campaign/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, objective }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      setQuestions(data.questions);
      setAnswers(data.questions.map(() => ""));
    } catch (e) {
      showToast(e.message);
      setQuestions([]); // permet de continuer sans questions
    } finally {
      setBusy(false);
    }
  };

  const loadSample = async (withFeedback) => {
    setBusy(true);
    try {
      const res = await fetch("/api/campaign/sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme,
          objective,
          context: buildContext(),
          ...(withFeedback ? { feedback, previous: sample } : {}),
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      setSample(data.text);
      setSampleApproved(false);
      setFeedback("");
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    setBusy(true);
    try {
      // 1. Créer la campagne avec son brief
      const cRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, theme, objective, context: buildContext() }),
      });
      const cData = await readJson(cRes);
      if (!cRes.ok) throw new Error(cData.error);
      // 2. Générer et planifier les posts
      const pRes = await fetch("/api/campaign/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: cData.campaign.id, periodDays, target }),
      });
      const pData = await readJson(pRes);
      if (!pRes.ok) throw new Error(pData.error);
      showToast(
        pData.status === "à valider"
          ? `Campagne lancée : ${pData.created} posts à valider ✓`
          : `Campagne lancée : ${pData.created} posts programmés ✓`
      );
      onLaunched();
      onClose();
    } catch (e) {
      showToast(e.message);
    } finally {
      setBusy(false);
    }
  };

  const slotsCount = nextPreferredSlots(profile, 100)?.filter(
    (s) => s <= new Date(Date.now() + periodDays * 86400000)
  )?.length;

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

  return (
    <div
      className={inline ? "" : "fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto"}
      onClick={inline ? undefined : onClose}
    >
      <div
        className={
          inline
            ? "bg-white rounded-2xl border border-gray-100 shadow-sm w-full max-w-2xl p-6"
            : "bg-white rounded-xl shadow-xl w-full max-w-xl p-6 my-8"
        }
        onClick={inline ? undefined : (e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Sparkles size={18} className="text-[#ff5a5f]" /> Nouvelle campagne LinkedIn
          </h3>
          {!inline && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Progression */}
        <div className="flex items-center gap-2 mb-5">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-[#ff5a5f]" : "bg-gray-200"}`} />
              <p className={`text-xs mt-1 ${i === step ? "text-[#ff5a5f] font-medium" : "text-gray-400"}`}>{s}</p>
            </div>
          ))}
        </div>

        {/* Étape 0 — Thème */}
        {step === 0 && (
          <div className="space-y-3">
            {seedContext && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start justify-between gap-2">
                <span>
                  💡 Campagne initiée depuis un article de votre veille — il servira de point de départ
                  aux posts.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSeedContext("");
                    setPickedLink(null);
                  }}
                  className="text-amber-500 hover:text-amber-800 shrink-0"
                  title="Retirer l'article"
                >
                  <X size={13} />
                </button>
              </p>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Thème de la campagne *
              </label>
              <input
                type="text"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="ex : L'accessibilité numérique, un avantage concurrentiel"
                className={inputCls}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Nom de la campagne <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex : Campagne SEEPH 2026"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Objectif principal</label>
              <div className="flex flex-wrap gap-1.5">
                {COMM_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setObjective(objective === g ? "" : g)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      objective === g
                        ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            {/* Module d'inspiration : partir d'un article de la veille */}
            {veille?.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5 flex items-center gap-1.5">
                  <Eye size={14} className="text-[#ff5a5f]" /> Ou partez d'un article de votre veille
                </label>
                <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                  {veille.slice(0, 8).map((it, i) => {
                    const active = pickedLink === (it.link ?? it.title);
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => pickArticle(it)}
                        className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                          active
                            ? "border-[#ff5a5f] bg-[#fff1f1] ring-1 ring-[#ffb3b5]"
                            : "border-gray-200 hover:border-[#ffb3b5]"
                        }`}
                      >
                        <p className="text-xs font-medium truncate">{it.title}</p>
                        <p className="text-[11px] text-gray-400">
                          {it.source}
                          {it.date && ` · ${new Date(it.date).toLocaleDateString("fr-FR")}`}
                          {active && <span className="text-[#ff5a5f] font-medium"> · sélectionné ✓</span>}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setStep(1);
                  loadQuestions();
                }}
                disabled={!theme.trim()}
                className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
              >
                Continuer <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Étape 1 — Questions de cadrage */}
        {step === 1 && (
          <div className="space-y-3">
            {busy && !questions ? (
              <div className="text-center py-8 text-gray-400">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
                <p className="text-sm">L'IA analyse votre thème et prépare ses questions…</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-600">
                  Quelques précisions pour des posts vraiment justes — répondez à ce que vous voulez,
                  ou laissez l'IA décider.
                </p>
                {(questions ?? []).map((q, i) => (
                  <div key={i}>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">{q}</label>
                    <textarea
                      rows={2}
                      value={answers[i] ?? ""}
                      onChange={(e) =>
                        setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      className={inputCls}
                    />
                  </div>
                ))}
                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => {
                      setAnswers((questions ?? []).map(() => ""));
                      setStep(2);
                      loadSample();
                    }}
                    className="text-sm text-gray-500 hover:text-[#ff5a5f] px-3 py-2"
                  >
                    Laisser l'IA décider →
                  </button>
                  <button
                    onClick={() => {
                      setStep(2);
                      loadSample();
                    }}
                    className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    Continuer <ChevronRight size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Étape 2 — Post d'exemple */}
        {step === 2 && (
          <div className="space-y-3">
            {busy && !sample ? (
              <div className="text-center py-8 text-gray-400">
                <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
                <p className="text-sm">L'IA rédige un post d'exemple…</p>
              </div>
            ) : sample ? (
              <>
                <p className="text-sm text-gray-600">
                  Voici un exemple de post de cette campagne. Validez-le ou demandez un ajustement —
                  il servira de référence pour tous les posts générés.
                </p>
                <div
                  className={`rounded-xl border p-4 max-h-64 overflow-y-auto ${
                    sampleApproved ? "border-green-400 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{sample}</pre>
                </div>
                {sampleApproved ? (
                  <p className="text-sm text-green-700 flex items-center gap-1.5">
                    <Check size={15} /> Exemple validé — il guidera le style de la campagne
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Ajustement : « plus direct », « cite un chiffre », …"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                    />
                    <button
                      onClick={() => loadSample(true)}
                      disabled={busy || !feedback.trim()}
                      className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-xs px-3 py-2 rounded-lg flex items-center gap-1"
                    >
                      {busy ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                      Ajuster
                    </button>
                  </div>
                )}
                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => {
                      setSampleApproved(false);
                      setStep(3);
                    }}
                    className="text-sm text-gray-500 hover:text-[#ff5a5f] px-3 py-2"
                  >
                    Passer →
                  </button>
                  <div className="flex gap-2">
                    {!sampleApproved && (
                      <button
                        onClick={() => setSampleApproved(true)}
                        className="border border-green-500 text-green-700 hover:bg-green-50 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                      >
                        <Check size={15} /> C'est le bon ton
                      </button>
                    )}
                    <button
                      onClick={() => setStep(3)}
                      className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
                    >
                      Continuer <ChevronRight size={15} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <button onClick={() => loadSample()} className="text-sm text-[#ff5a5f] underline">
                  Réessayer la génération de l'exemple
                </button>
              </div>
            )}
          </div>
        )}

        {/* Étape 3 — Lancement */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Période</label>
                <select
                  value={periodDays}
                  onChange={(e) => setPeriodDays(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                >
                  <option value={7}>Semaine à venir</option>
                  <option value={14}>2 semaines</option>
                  <option value={30}>Mois à venir</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Publier en tant que</label>
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                >
                  <option value="person">Profil personnel</option>
                  {linkedin?.orgConnected &&
                    orgs?.map((o) => (
                      <option key={o.urn} value={o.urn}>
                        Page : {o.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="bg-[#fff1f1] rounded-lg p-3 text-sm text-[#1b2a4a]">
              <p className="font-medium mb-1">Récapitulatif</p>
              <p className="text-xs leading-relaxed">
                {slotsCount ?? 0} post{(slotsCount ?? 0) > 1 ? "s" : ""} seront générés sur le thème «{" "}
                {theme} », posés sur vos créneaux ({profile?.publishTime ?? "09:00"}),
                {profile?.requireValidation
                  ? " puis soumis à votre validation avant publication."
                  : " puis publiés automatiquement."}
                {sampleApproved && " L'exemple validé servira de référence de style."}
              </p>
            </div>
            <div className="flex justify-between pt-1">
              <button onClick={() => setStep(2)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                ← Retour
              </button>
              <button
                onClick={launch}
                disabled={busy || !slotsCount}
                className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
              >
                {busy ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                {busy ? "Génération en cours…" : "Lancer la campagne"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Vue « Mes campagnes » : gestion complète des campagnes
// ----------------------------------------------------------------
function CampaignsView({ profile, linkedin, orgs, showToast, onPlanned, openWizard, onWizardConsumed }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showWizard, setShowWizard] = useState(false);

  // Ouverture demandée depuis la sidebar (« Créer une campagne »)
  useEffect(() => {
    if (openWizard) {
      setShowWizard(true);
      onWizardConsumed?.();
    }
  }, [openWizard, onWizardConsumed]);
  const [periodDays, setPeriodDays] = useState(7);
  const [planTarget, setPlanTarget] = useState("person");
  const [planningId, setPlanningId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const loadCampaigns = () =>
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {})
      .finally(() => setLoaded(true));

  useEffect(() => {
    loadCampaigns();
  }, []);

  const slotsPreview = nextPreferredSlots(profile, 100)?.filter(
    (s) => s <= new Date(Date.now() + periodDays * 86400000)
  );

  const planForCampaign = async (c) => {
    setPlanningId(c.id);
    try {
      const res = await fetch("/api/campaign/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id, periodDays, target: planTarget }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      showToast(
        data.created === 0
          ? "Tous les créneaux de la période sont déjà occupés"
          : `${data.created} posts générés pour « ${c.name} » ✓`
      );
      onPlanned();
      loadCampaigns();
    } catch (e) {
      showToast(e.message);
    } finally {
      setPlanningId(null);
    }
  };

  const archiveCampaign = async (c) => {
    try {
      await fetch(`/api/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archivée" }),
      });
      setCampaigns((list) => list.filter((x) => x.id !== c.id));
      showToast(`Campagne « ${c.name} » archivée`);
    } catch {
      showToast("Erreur d'archivage");
    }
  };

  // Création : wizard intégré à la page (pas de popin)
  if (showWizard) {
    return (
      <main className="max-w-4xl mx-auto p-6 space-y-4">
        <button
          onClick={() => setShowWizard(false)}
          className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
        >
          <ChevronLeft size={15} /> Retour aux campagnes
        </button>
        <CampaignWizard
          inline
          profile={profile}
          linkedin={linkedin}
          orgs={orgs}
          showToast={showToast}
          onClose={() => setShowWizard(false)}
          onLaunched={() => {
            onPlanned();
            loadCampaigns();
            setShowWizard(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-500">
          Une campagne = un thème + un brief. Les posts générés se suivent et progressent.
        </p>
        <button
          onClick={() => setShowWizard(true)}
          className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2"
        >
          <Sparkles size={15} /> Nouvelle campagne
        </button>
      </div>

      {campaigns.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-gray-500 text-xs">Génération :</span>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
          >
            <option value={7}>Semaine à venir</option>
            <option value={14}>2 semaines</option>
            <option value={30}>Mois à venir</option>
          </select>
          <select
            value={planTarget}
            onChange={(e) => setPlanTarget(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
          >
            <option value="person">Profil personnel</option>
            {linkedin?.orgConnected &&
              orgs?.map((o) => (
                <option key={o.urn} value={o.urn}>
                  Page : {o.name}
                </option>
              ))}
          </select>
        </div>
      )}

      {loaded && campaigns.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
          <Megaphone size={32} className="mx-auto mb-3" />
          <p className="text-sm mb-2">Aucune campagne pour l'instant.</p>
          <button onClick={() => setShowWizard(true)} className="text-sm text-[#ff5a5f] hover:underline">
            Créer ma première campagne →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const progress = c.postCount > 0 ? Math.round((c.published / c.postCount) * 100) : 0;
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base truncate">{c.name}</h3>
                      {c.objective && (
                        <span className="text-xs bg-[#fff1f1] text-[#f63d44] px-2 py-0.5 rounded-full">
                          {c.objective}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{c.theme}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => planForCampaign(c)}
                      disabled={planningId !== null || !slotsPreview?.length}
                      className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      {planningId === c.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Sparkles size={12} />
                      )}
                      {planningId === c.id ? "Génération…" : "Générer la suite"}
                    </button>
                    <button
                      onClick={() => archiveCampaign(c)}
                      className="text-gray-400 hover:text-red-600 p-1.5"
                      title="Archiver"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Progression */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>
                      {c.published}/{c.postCount} publié{c.published > 1 ? "s" : ""}
                      {c.toValidate > 0 && ` · ${c.toValidate} à valider`}
                      {c.scheduled > 0 && ` · ${c.scheduled} programmé${c.scheduled > 1 ? "s" : ""}`}
                      {c.errors > 0 && ` · ${c.errors} en erreur`}
                    </span>
                    {c.nextScheduledAt && <span>Prochain : {fmtDateTime(c.nextScheduledAt)}</span>}
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Brief */}
                {c.context && (
                  <div className="mt-3">
                    <button
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                      className="text-xs text-gray-500 hover:text-[#ff5a5f] flex items-center gap-1"
                    >
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${expandedId === c.id ? "rotate-180" : ""}`}
                      />
                      Brief de campagne
                    </button>
                    {expandedId === c.id && (
                      <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-2 max-h-48 overflow-y-auto font-sans">
                        {c.context}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ----------------------------------------------------------------
// Bloc Inspirations & veille : articles des sources en affinité
// avec le profil, transformables en posts
// ----------------------------------------------------------------
function VeilleBlock({ showToast, onInspire, onCampaign }) {
  const [sources, setSources] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [showAll, setShowAll] = useState(false);

  const loadSources = () =>
    fetch("/api/sources")
      .then((r) => r.json())
      .then((d) => setSources(d.sources ?? []))
      .catch(() => {});

  const loadItems = (force) => {
    setLoading(true);
    fetch(`/api/veille${force ? "?refresh=1" : ""}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadSources();
    loadItems();
  }, []);

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/sources/suggest", { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      showToast(`${data.added.length} source${data.added.length > 1 ? "s" : ""} en affinité ajoutée${data.added.length > 1 ? "s" : ""} ✓`);
      await loadSources();
      loadItems(true);
    } catch (e) {
      showToast(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const addSource = async (e) => {
    e.preventDefault();
    if (!addUrl.trim()) return;
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      setAddUrl("");
      showToast(`Source « ${data.source.title} » ajoutée ✓`);
      await loadSources();
      loadItems(true);
    } catch (e) {
      showToast(e.message);
    }
  };

  const removeSource = async (s) => {
    await fetch(`/api/sources?id=${s.id}`, { method: "DELETE" });
    setSources((list) => list.filter((x) => x.id !== s.id));
    setItems((list) => list.filter((x) => x.sourceId !== s.id));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Eye size={17} className="text-[#ff5a5f]" /> Inspirations & veille
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={suggest}
            disabled={suggesting}
            className="border border-[#ffb3b5] text-[#f63d44] hover:bg-[#fff1f1] disabled:opacity-50 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
          >
            {suggesting ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {suggesting ? "Recherche de sources…" : "Suggérer des sources (IA)"}
          </button>
          {sources.length > 0 && (
            <button
              onClick={() => loadItems(true)}
              disabled={loading}
              className="text-gray-400 hover:text-[#ff5a5f] p-1.5 rounded hover:bg-gray-100"
              title="Actualiser la veille"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Des sources en affinité avec votre profil pour guider vos choix de posts — chaque article
        peut devenir un post.
      </p>

      {/* Sources */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {sources.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
            {s.title}
            <button onClick={() => removeSource(s)} className="text-gray-400 hover:text-red-600" title="Retirer">
              <X size={11} />
            </button>
          </span>
        ))}
        <form onSubmit={addSource} className="inline-flex items-center gap-1">
          <input
            type="url"
            value={addUrl}
            onChange={(e) => setAddUrl(e.target.value)}
            placeholder="Ajouter un site ou flux RSS…"
            className="border border-gray-300 rounded-full px-3 py-1 text-xs w-52 focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
          />
          <button type="submit" className="text-xs text-[#ff5a5f] hover:underline px-1">
            Ajouter
          </button>
        </form>
      </div>

      {/* Articles */}
      {sources.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Aucune source pour l'instant — cliquez sur « Suggérer des sources (IA) » pour démarrer.
        </p>
      ) : loading && items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4 flex items-center justify-center gap-2">
          <RefreshCw size={14} className="animate-spin" /> Lecture des sources…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Aucun article récupéré pour l'instant.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {(showAll ? items : items.slice(0, 6)).map((it, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {it.link ? (
                      <a href={it.link} target="_blank" rel="noreferrer" className="hover:text-[#f63d44]">
                        {it.title}
                      </a>
                    ) : (
                      it.title
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
                    {it.source}
                    {it.date && ` · ${new Date(it.date).toLocaleDateString("fr-FR")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => onInspire(it)}
                    className="border border-[#ffb3b5] text-[#f63d44] hover:bg-[#fff1f1] text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Sparkles size={12} /> Post
                  </button>
                  <button
                    onClick={() => onCampaign(it)}
                    title="Créer une campagne complète à partir de cet article"
                    className="border border-orange-300 text-orange-700 hover:bg-orange-50 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Megaphone size={12} /> Campagne
                  </button>
                </div>
              </div>
            ))}
          </div>
          {items.length > 6 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-gray-500 hover:text-[#ff5a5f] mt-2"
            >
              {showAll ? "Réduire" : `Voir les ${items.length - 6} autres articles`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Administration (super admin) : comptes + consommation IA
// ----------------------------------------------------------------
function AdminView({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/overview")
      .then(readJson)
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => showToast(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setDisabled = async (u, disabled) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabled }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(disabled ? `Compte ${u.email} suspendu` : `Compte ${u.email} réactivé`);
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const setPlan = async (u, plan) => {
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(`${u.email} → offre ${planLabel(plan)}`);
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Supprimer définitivement le compte ${u.email} et toutes ses données ?`)) return;
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(`Compte ${u.email} supprimé`);
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const fmtCost = (c) => `${c.toFixed(2).replace(".", ",")} $`;

  if (loading && !data) {
    return (
      <main className="max-w-6xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
          <p className="text-sm">Chargement des données plateforme…</p>
        </div>
      </main>
    );
  }
  if (!data) return null;

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Totaux plateforme */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-[#ff5a5f] to-pink-500 shadow-lg shadow-[#ffd5d6]">
          <p className="text-3xl font-bold">{data.totals.users}</p>
          <p className="text-sm text-white/80 mt-1">Comptes clients</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-3xl font-bold text-green-600">{data.totals.published}</p>
          <p className="text-sm text-gray-500 mt-1">Posts publiés (total)</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-3xl font-bold">
            {fmtTokens(data.totals.inputTokens30 + data.totals.outputTokens30)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Tokens 30 j ({fmtTokens(data.totals.inputTokens30)} in / {fmtTokens(data.totals.outputTokens30)} out)
            {data.totals.images30 > 0 && ` · ${data.totals.images30} images`}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-3xl font-bold text-orange-500">{fmtCost(data.totals.cost30)}</p>
          <p className="text-sm text-gray-500 mt-1">Coût IA estimé (30 j)</p>
        </div>
      </div>

      {/* Comptes */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="p-3 font-medium">Client</th>
              <th className="p-3 font-medium">Inscrit le</th>
              <th className="p-3 font-medium">Offre</th>
              <th className="p-3 font-medium text-right">Posts</th>
              <th className="p-3 font-medium text-right">Campagnes</th>
              <th className="p-3 font-medium text-right">Tokens 30 j</th>
              <th className="p-3 font-medium text-right">Images 30 j</th>
              <th className="p-3 font-medium text-right">Coût 30 j</th>
              <th className="p-3 font-medium text-right">Coût total</th>
              <th className="p-3 font-medium">Statut</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.users.map((u) => (
              <tr key={u.id} className={u.disabled ? "opacity-50" : ""}>
                <td className="p-3">
                  <p className="font-medium flex items-center gap-1.5">
                    {u.name || u.email}
                    {u.isAdmin && (
                      <span className="text-[10px] bg-[#fff1f1] text-[#f63d44] px-1.5 py-0.5 rounded-full font-semibold">
                        ADMIN
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="p-3 text-xs text-gray-500">
                  {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                </td>
                <td className="p-3">
                  <select
                    value={u.plan || "pro"}
                    onChange={(e) => setPlan(u, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-1.5 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                  >
                    {PLAN_IDS.map((p) => (
                      <option key={p} value={p}>
                        {planLabel(p)}
                      </option>
                    ))}
                  </select>
                  {u.trialEndsAt && new Date(u.trialEndsAt) > new Date() && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      essai · {Math.ceil((new Date(u.trialEndsAt) - Date.now()) / 86400000)} j
                    </p>
                  )}
                </td>
                <td className="p-3 text-right">
                  <span className="font-medium">{u.published}</span>
                  <span className="text-gray-400 text-xs"> / {u.posts}</span>
                </td>
                <td className="p-3 text-right">{u.campaigns}</td>
                <td className="p-3 text-right text-xs">
                  {fmtTokens(u.usage30.inputTokens)} <span className="text-gray-400">in</span>
                  <br />
                  {fmtTokens(u.usage30.outputTokens)} <span className="text-gray-400">out</span>
                </td>
                <td className="p-3 text-right">{u.usage30.images || "—"}</td>
                <td className="p-3 text-right font-medium">{fmtCost(u.usage30.cost)}</td>
                <td className="p-3 text-right text-gray-500">{fmtCost(u.usageTotal.cost)}</td>
                <td className="p-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit ${
                        u.disabled ? "bg-red-100 text-red-700" : "bg-green-50 text-green-700"
                      }`}
                    >
                      {u.disabled ? "suspendu" : "actif"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {u.linkedinConnected ? "LinkedIn ✓" : "LinkedIn —"}
                      {u.orgConnected ? " · page ✓" : ""}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  {!u.isAdmin && (
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => setDisabled(u, !u.disabled)}
                        className={`text-[11px] border px-2 py-1 rounded-lg ${
                          u.disabled
                            ? "border-green-300 text-green-700 hover:bg-green-50"
                            : "border-amber-300 text-amber-700 hover:bg-amber-50"
                        }`}
                      >
                        {u.disabled ? "Réactiver" : "Suspendre"}
                      </button>
                      <button
                        onClick={() => deleteUser(u)}
                        className="text-gray-300 hover:text-red-600 p-1"
                        title="Supprimer le compte"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400">
        Coûts estimés sur la base de 3 $/M tokens en entrée, 15 $/M en sortie (Claude) et 0,04 $/image
        (gpt-image-1) — à ajuster dans lib/usage.js si les tarifs évoluent.
      </p>
    </main>
  );
}

// ----------------------------------------------------------------
// Contenu du site (admin) : blog + landing + pages légales
// ----------------------------------------------------------------
function ContentAdminView({ showToast }) {
  const [tab, setTab] = useState("blog"); // blog | landing | legal
  const tabs = [
    { id: "blog", label: "Blog" },
    { id: "landing", label: "Page d'accueil" },
    { id: "legal", label: "Pages légales" },
  ];
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="inline-flex bg-gray-100 p-1 rounded-lg">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium ${tab === t.id ? "bg-white shadow-sm" : "text-gray-500"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "blog" && <BlogAdmin showToast={showToast} />}
      {tab === "landing" && <LandingAdmin showToast={showToast} />}
      {tab === "legal" && <FooterPagesAdmin showToast={showToast} />}
    </main>
  );
}

// ----------------------------------------------------------------
// Pages légales (admin) : CGU, confidentialité, mentions légales
// ----------------------------------------------------------------
const FOOTER_PAGE_OPTIONS = [
  { key: "cgu", label: "CGU" },
  { key: "confidentialite", label: "Confidentialité" },
  { key: "mentions-legales", label: "Mentions légales" },
];

function FooterPagesAdmin({ showToast }) {
  const [selectedKey, setSelectedKey] = useState("cgu");
  const [page, setPage] = useState(null); // { title, sections: [{heading, body}] }
  const [saving, setSaving] = useState(false);

  const load = (key) => {
    setPage(null);
    fetch(`/api/admin/footer-pages/${key}`)
      .then(readJson)
      .then((d) => setPage(d.page))
      .catch((e) => showToast(e.message));
  };

  useEffect(() => { load(selectedKey); }, [selectedKey]); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/footer-pages/${selectedKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Page enregistrée");
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const setSection = (i, field, value) =>
    setPage((p) => ({ ...p, sections: p.sections.map((s, j) => j === i ? { ...s, [field]: value } : s) }));

  const addSection = () =>
    setPage((p) => ({ ...p, sections: [...p.sections, { heading: "", body: "" }] }));

  const removeSection = (i) => {
    if (!window.confirm("Supprimer cette section ?")) return;
    setPage((p) => ({ ...p, sections: p.sections.filter((_, j) => j !== i) }));
  };

  const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

  return (
    <div className="space-y-5">
      {/* Sélecteur de page */}
      <div className="inline-flex bg-gray-100 p-1 rounded-lg">
        {FOOTER_PAGE_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => setSelectedKey(o.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedKey === o.key ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {!page ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Titre de la page */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Titre de la page</label>
            <input
              className={field}
              value={page.title}
              onChange={(e) => setPage((p) => ({ ...p, title: e.target.value }))}
              placeholder="Titre affiché en h1"
            />
          </div>

          {/* Sections */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Sections</h3>
              <button
                onClick={addSection}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                + Ajouter une section
              </button>
            </div>
            {page.sections.map((s, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-4 space-y-2 relative">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-mono w-5 shrink-0">{i + 1}.</span>
                  <input
                    className={field}
                    value={s.heading}
                    onChange={(e) => setSection(i, "heading", e.target.value)}
                    placeholder="Titre de la section (h2)"
                  />
                  <button
                    onClick={() => removeSection(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors shrink-0"
                    title="Supprimer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  className={`${field} ml-7`}
                  rows={4}
                  value={s.body}
                  onChange={(e) => setSection(i, "body", e.target.value)}
                  placeholder="Contenu (un saut de ligne = nouveau paragraphe)"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <a
              href={`/${selectedKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#ff5a5f] hover:underline"
            >
              Voir la page ↗
            </a>
            <button
              onClick={save}
              disabled={saving}
              className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-6 py-2.5 rounded-lg flex items-center gap-2"
            >
              {saving && <RefreshCw size={15} className="animate-spin" />} Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY_ARTICLE = { title: "", slug: "", excerpt: "", coverImage: "", content: "", published: false };

function BlogAdmin({ showToast }) {
  const [articles, setArticles] = useState([]);
  const [editing, setEditing] = useState(null); // article en cours d'édition (ou EMPTY_ARTICLE)
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch("/api/admin/articles")
      .then(readJson)
      .then((d) => setArticles(d.articles ?? []))
      .catch((e) => showToast(e.message));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? "/api/admin/articles" : `/api/admin/articles/${editing.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(isNew ? "Article créé" : "Article enregistré");
      setEditing(null);
      load();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async (a) => {
    try {
      const res = await fetch(`/api/admin/articles/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !a.published }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(a.published ? "Article dépublié" : "Article publié");
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Supprimer l'article « ${a.title} » ?`)) return;
    try {
      const res = await fetch(`/api/admin/articles/${a.id}`, { method: "DELETE" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Article supprimé");
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editing.id ? "Modifier l'article" : "Nouvel article"}</h3>
          <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700 text-sm">
            ← Retour
          </button>
        </div>
        <input
          placeholder="Titre"
          value={editing.title}
          onChange={(e) => set("title", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
        />
        {editing.id && (
          <input
            placeholder="slug-de-l-article"
            value={editing.slug || ""}
            onChange={(e) => set("slug", e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono text-gray-600 focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
          />
        )}
        <input
          placeholder="Résumé (méta description, carte)"
          value={editing.excerpt || ""}
          onChange={(e) => set("excerpt", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
        />
        <input
          placeholder="URL de l'image de couverture (optionnel)"
          value={editing.coverImage || ""}
          onChange={(e) => set("coverImage", e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
        />
        <textarea
          placeholder="Contenu de l'article (Markdown : # titres, **gras**, - listes, [lien](url))"
          value={editing.content}
          onChange={(e) => set("content", e.target.value)}
          rows={16}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={editing.published} onChange={(e) => set("published", e.target.checked)} />
            Publié (visible sur le blog public)
          </label>
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-2"
          >
            {saving && <RefreshCw size={14} className="animate-spin" />} Enregistrer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{articles.length} article(s)</p>
        <button
          onClick={() => setEditing({ ...EMPTY_ARTICLE })}
          className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
        >
          <PenLine size={14} /> Nouvel article
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
        {articles.length === 0 && <p className="p-6 text-sm text-gray-400">Aucun article. Créez le premier.</p>}
        {articles.map((a) => (
          <div key={a.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{a.title}</p>
              <p className="text-xs text-gray-400">
                /blog/{a.slug} ·{" "}
                <span className={a.published ? "text-green-600" : "text-amber-600"}>
                  {a.published ? "publié" : "brouillon"}
                </span>
              </p>
            </div>
            <button onClick={() => togglePublish(a)} className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
              {a.published ? "Dépublier" : "Publier"}
            </button>
            <button onClick={() => setEditing(a)} className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50">
              Modifier
            </button>
            <button onClick={() => remove(a)} className="text-gray-300 hover:text-red-600 p-1" title="Supprimer">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LandingAdmin({ showToast }) {
  const [content, setContent] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/site-content")
      .then(readJson)
      .then((d) => setContent(d.content))
      .catch((e) => showToast(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(content),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Page d'accueil enregistrée");
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!content) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
        <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
      </div>
    );
  }

  const setHero = (k, v) => setContent((c) => ({ ...c, hero: { ...c.hero, [k]: v } }));
  const setPlan = (i, k, v) =>
    setContent((c) => ({ ...c, plans: c.plans.map((p, j) => (j === i ? { ...p, [k]: v } : p)) }));
  const setFaq = (i, k, v) =>
    setContent((c) => ({ ...c, faq: c.faq.map((f, j) => (j === i ? { ...f, [k]: v } : f)) }));

  const field = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-sm">Accroche (hero)</h3>
        <input className={field} value={content.hero.badge} onChange={(e) => setHero("badge", e.target.value)} placeholder="Badge" />
        <div className="grid grid-cols-2 gap-3">
          <input className={field} value={content.hero.title} onChange={(e) => setHero("title", e.target.value)} placeholder="Titre" />
          <input className={field} value={content.hero.titleAccent} onChange={(e) => setHero("titleAccent", e.target.value)} placeholder="Fin du titre (en couleur)" />
        </div>
        <textarea className={field} rows={3} value={content.hero.subtitle} onChange={(e) => setHero("subtitle", e.target.value)} placeholder="Sous-titre" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-sm">Offres</h3>
        {content.plans.map((p, i) => (
          <div key={i} className="border border-gray-100 rounded-xl p-3 space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <input className={field} value={p.name} onChange={(e) => setPlan(i, "name", e.target.value)} placeholder="Nom" />
              <input className={field} value={p.price} onChange={(e) => setPlan(i, "price", e.target.value)} placeholder="Prix (€)" />
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={!!p.highlight} onChange={(e) => setPlan(i, "highlight", e.target.checked)} />
                Mis en avant
              </label>
            </div>
            <input className={field} value={p.desc} onChange={(e) => setPlan(i, "desc", e.target.value)} placeholder="Description" />
            <textarea
              className={field}
              rows={4}
              value={(p.features || []).join("\n")}
              onChange={(e) => setPlan(i, "features", e.target.value.split("\n").filter(Boolean))}
              placeholder="Une caractéristique par ligne"
            />
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h3 className="font-semibold text-sm">FAQ</h3>
        {content.faq.map((f, i) => (
          <div key={i} className="space-y-1.5">
            <input className={field} value={f.q} onChange={(e) => setFaq(i, "q", e.target.value)} placeholder="Question" />
            <textarea className={field} rows={2} value={f.a} onChange={(e) => setFaq(i, "a", e.target.value)} placeholder="Réponse" />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-6 py-2.5 rounded-lg flex items-center gap-2"
        >
          {saving && <RefreshCw size={15} className="animate-spin" />} Enregistrer la page d'accueil
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Messages de contact (admin)
// ----------------------------------------------------------------
function ContactAdminView({ showToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/contact")
      .then(readJson)
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => showToast(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setHandled = async (m, handled) => {
    try {
      const res = await fetch(`/api/admin/contact/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const remove = async (m) => {
    if (!window.confirm(`Supprimer le message de ${m.email} ?`)) return;
    try {
      const res = await fetch(`/api/admin/contact/${m.id}`, { method: "DELETE" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Message supprimé");
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  if (loading && !data) {
    return (
      <main className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
          <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
        </div>
      </main>
    );
  }
  if (!data) return null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-4">
      <p className="text-sm text-gray-500">
        {data.messages.length} message(s){data.unhandled > 0 && ` · ${data.unhandled} non traité(s)`}
      </p>
      {data.messages.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">
          Aucune demande de contact pour l'instant.
        </div>
      )}
      <div className="space-y-3">
        {data.messages.map((m) => (
          <div
            key={m.id}
            className={`bg-white rounded-2xl border shadow-sm p-4 ${m.handled ? "border-gray-100 opacity-70" : "border-[#ffe0e0]"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">
                  {m.name}{" "}
                  <a href={`mailto:${m.email}`} className="text-[#ff5a5f] font-normal">
                    &lt;{m.email}&gt;
                  </a>
                </p>
                {m.subject && <p className="text-xs text-gray-500 mt-0.5">Sujet : {m.subject}</p>}
              </div>
              <span className="text-xs text-gray-400 shrink-0">
                {new Date(m.createdAt).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{m.message}</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setHandled(m, !m.handled)}
                className={`text-[11px] border px-2 py-1 rounded-lg ${
                  m.handled
                    ? "border-gray-200 text-gray-500 hover:bg-gray-50"
                    : "border-green-300 text-green-700 hover:bg-green-50"
                }`}
              >
                {m.handled ? "Marquer non traité" : "Marquer traité"}
              </button>
              <a
                href={`mailto:${m.email}${m.subject ? `?subject=Re: ${encodeURIComponent(m.subject)}` : ""}`}
                className="text-[11px] border border-gray-200 px-2 py-1 rounded-lg hover:bg-gray-50"
              >
                Répondre
              </a>
              <button onClick={() => remove(m)} className="text-gray-300 hover:text-red-600 p-1 ml-auto" title="Supprimer">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------
// Module Événements : salons / forums + génération de posts de présence
// ----------------------------------------------------------------
const EMPTY_EVENT = { name: "", location: "", startDate: "", endDate: "", url: "", imageUrl: "", details: "" };

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function EventsView({ profile, showToast, onGenerated }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ ...EMPTY_EVENT });
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genId, setGenId] = useState(null);
  const [pushState, setPushState] = useState("idle"); // idle | working | enabled | unsupported | denied
  const [photoBusy, setPhotoBusy] = useState(null);

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  // Prise de photo depuis le téléphone → crée un post avec l'image
  const takePhoto = (ev) => {
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "image/*";
    inp.capture = "environment";
    inp.onchange = async () => {
      const file = inp.files?.[0];
      if (!file) return;
      setPhotoBusy(ev.id);
      try {
        // Réduction de la photo (max 1280 px, JPEG) pour un envoi léger et fiable
        const dataUrl = await new Promise((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const max = 1280;
            let { width, height } = img;
            if (width > max || height > max) {
              const r = Math.min(max / width, max / height);
              width = Math.round(width * r);
              height = Math.round(height * r);
            }
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            canvas.getContext("2d").drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL("image/jpeg", 0.85));
          };
          img.onerror = reject;
          img.src = url;
        });
        const res = await fetch(`/api/events/${ev.id}/photo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });
        const d = await readJson(res);
        if (!res.ok) throw new Error(d.error);
        showToast("Post créé avec votre photo — validez-le dans « Mes posts » ✓");
        onGenerated?.();
        load();
      } catch (e) {
        showToast(e.message);
      } finally {
        setPhotoBusy(null);
      }
    };
    inp.click();
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushState("unsupported");
      return;
    }
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.pushManager.getSubscription().then((sub) => {
        if (sub) setPushState("enabled");
      });
    });
  }, []);

  const enablePush = async () => {
    if (!vapidKey) {
      showToast("Notifications non configurées (clé VAPID manquante).");
      return;
    }
    setPushState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setPushState("denied");
        showToast("Notifications refusées par le navigateur.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub }),
      });
      if (!res.ok) throw new Error("Enregistrement de l'abonnement échoué");
      setPushState("enabled");
      showToast("Notifications activées ✓ Vous serez alerté le jour de l'événement.");
    } catch (e) {
      setPushState("idle");
      showToast(e.message || "Activation impossible.");
    }
  };

  const load = () =>
    fetch("/api/events")
      .then(readJson)
      .then((d) => setEvents(d.events ?? []))
      .catch((e) => showToast(e.message));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const analyze = async () => {
    if (!form.url?.trim()) return showToast("Indiquez d'abord le lien de l'événement.");
    setAnalyzing(true);
    try {
      const res = await fetch("/api/events/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.url }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      const f = d.fields || {};
      setForm((prev) => ({
        ...prev,
        name: prev.name || f.name || "",
        imageUrl: f.imageUrl || prev.imageUrl,
        details: f.details || prev.details,
      }));
      showToast("Lien analysé — image et contexte récupérés ✓");
    } catch (e) {
      showToast(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!form.name.trim() || !form.startDate) return showToast("Nom et date de début requis.");
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, endDate: form.endDate || form.startDate }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Événement ajouté ✓");
      setForm({ ...EMPTY_EVENT });
      load();
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const generate = async (ev) => {
    setGenId(ev.id);
    try {
      const res = await fetch(`/api/events/${ev.id}/generate`, { method: "POST" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast(`${d.count} post(s) programmé(s) autour de l'événement ✓`);
      onGenerated?.();
      load();
    } catch (e) {
      showToast(e.message);
    } finally {
      setGenId(null);
    }
  };

  const remove = async (ev) => {
    if (!window.confirm(`Supprimer l'événement « ${ev.name} » ?`)) return;
    try {
      const res = await fetch(`/api/events/${ev.id}`, { method: "DELETE" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      showToast("Événement supprimé");
      load();
    } catch (e) {
      showToast(e.message);
    }
  };

  const fmt = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  const input = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";
  const label = "text-xs font-medium text-gray-500";

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Notifications jour-J */}
      {pushState !== "unsupported" && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#fff1f1] text-[#ff5a5f] p-2.5 rounded-xl">
              <Bell size={18} />
            </div>
            <div>
              <p className="font-semibold text-sm">Rappels le jour de l'événement</p>
              <p className="text-xs text-gray-500">Une notification pour poster et prendre une photo sur place.</p>
            </div>
          </div>
          {pushState === "enabled" ? (
            <span className="text-xs font-semibold text-green-600 flex items-center gap-1 shrink-0">
              <Check size={14} /> Activées
            </span>
          ) : (
            <button
              onClick={enablePush}
              disabled={pushState === "working"}
              className="shrink-0 bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
            >
              {pushState === "working" ? <RefreshCw size={13} className="animate-spin" /> : <Bell size={13} />}
              Activer
            </button>
          )}
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <MapPin size={17} className="text-[#ff5a5f]" /> Ajouter un événement
        </h2>
        <div>
          <label className={label}>Lien de l'événement (salon, forum…)</label>
          <div className="flex gap-2 mt-1">
            <input className={input} value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://www.salon-exemple.com" />
            <button
              type="button"
              onClick={analyze}
              disabled={analyzing}
              className="shrink-0 bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
            >
              {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {analyzing ? "Analyse…" : "Analyser"}
            </button>
          </div>
        </div>
        {form.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.imageUrl} alt="" className="rounded-xl w-full max-h-40 object-cover" />
        )}
        <div>
          <label className={label}>Nom de l'événement</label>
          <input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="ex : Salon Big Data & AI Paris" />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className={label}>Du</label>
            <input type="date" className={input} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div>
            <label className={label}>Au</label>
            <input type="date" className={input} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
          <div>
            <label className={label}>Lieu / stand</label>
            <input className={input} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Paris · Hall 1 · Stand B12" />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#1b2a4a] hover:bg-[#0f1830] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
          >
            {saving && <RefreshCw size={14} className="animate-spin" />} Ajouter l'événement
          </button>
        </div>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {events.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">Aucun événement pour l'instant.</p>
        )}
        {events.map((ev) => {
          const now = new Date();
          const past = new Date(ev.endDate) < now;
          const live = !past && new Date(ev.startDate) <= now;
          return (
            <div key={ev.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-4 ${past ? "opacity-60" : ""}`}>
              {ev.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ev.imageUrl} alt="" className="w-24 h-24 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-[#fff1f1] text-[#ff5a5f] flex items-center justify-center shrink-0">
                  <MapPin size={28} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{ev.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <CalendarDays size={13} /> {fmt(ev.startDate)} → {fmt(ev.endDate)}
                  {ev.location && <span className="flex items-center gap-1"><MapPin size={12} /> {ev.location}</span>}
                </p>
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noopener" className="text-xs text-[#ff5a5f] hover:underline inline-flex items-center gap-1 mt-1">
                    Voir l'événement <ExternalLink size={11} />
                  </a>
                )}
                <p className="text-[11px] text-gray-400 mt-1">
                  {ev.postCount > 0 ? `${ev.postCount} post(s) liés · ${ev.published} publié(s)` : "Aucun post généré"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => generate(ev)}
                    disabled={genId === ev.id}
                    className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    {genId === ev.id ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {genId === ev.id ? "Génération…" : "Générer les posts"}
                  </button>
                  {live && (
                    <button
                      onClick={() => takePhoto(ev)}
                      disabled={photoBusy === ev.id}
                      className="bg-[#1b2a4a] hover:bg-[#0f1830] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                    >
                      {photoBusy === ev.id ? <RefreshCw size={12} className="animate-spin" /> : <Camera size={12} />}
                      Poster une photo
                    </button>
                  )}
                  <button onClick={() => remove(ev)} className="text-gray-300 hover:text-red-600 p-1.5" title="Supprimer">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        Les posts générés sont programmés (à valider si l'option est activée dans votre profil) sur les jours qui
        encadrent l'événement, avec l'image du salon. Retrouvez-les dans « Mes posts ».
      </p>
    </main>
  );
}

// ----------------------------------------------------------------
// Score de potentiel d'engagement (heuristique instantanée + conseils IA)
// ----------------------------------------------------------------
function ScorePanel({ text, type, recomputing }) {
  const heur = scorePost({ text, type });
  const [tips, setTips] = useState(null);
  const [display, setDisplay] = useState(heur.score);

  // Anime la jauge vers le nouveau score quand le texte change (réécriture)
  useEffect(() => {
    const start = display;
    const t0 = performance.now();
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 700);
      setDisplay(Math.round(start + (heur.score - start) * p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heur.score]);

  useEffect(() => {
    let cancel = false;
    setTips(null);
    fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, type }),
    })
      .then(readJson)
      .then((d) => {
        if (!cancel) setTips(d.tips || []);
      })
      .catch(() => {
        if (!cancel) setTips([]);
      });
    return () => {
      cancel = true;
    };
  }, [text, type]);

  const colorFor = (s) => (s >= 80 ? "#16a34a" : s >= 60 ? "#ff5a5f" : s >= 40 ? "#f59e0b" : "#ef4444");
  const color = colorFor(display);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-7">
      {/* En-tête de l'étape */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#ff5a5f] text-white flex items-center justify-center font-extrabold shrink-0">2</div>
        <div>
          <h3 className="font-extrabold text-lg leading-tight">Optimisez le potentiel d'engagement</h3>
          <p className="text-sm text-gray-400 mt-0.5">Des pistes concrètes, élément par élément, pour améliorer votre post avant de le publier.</p>
        </div>
      </div>

      {/* Jauge */}
      <div className="flex items-center gap-6">
        <div className="text-center shrink-0">
          <p className="text-5xl font-extrabold leading-none tabular-nums transition-colors duration-300" style={{ color }}>{display}</p>
          <p className="text-xs text-gray-400 mt-1.5">/ 100</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-sm font-semibold">Potentiel d'engagement</p>
            {recomputing ? (
              <span className="text-sm font-medium text-gray-400 flex items-center gap-1.5">
                <RefreshCw size={13} className="animate-spin" /> Recalcul…
              </span>
            ) : (
              <span className="text-sm font-bold" style={{ color }}>{heur.level}</span>
            )}
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-[width,background-color] duration-300" style={{ width: `${display}%`, background: color }} />
          </div>
          <p className="text-[11px] text-gray-400 mt-2">Estimation indicative basée sur les bonnes pratiques — ce n'est pas une prédiction de performance réelle.</p>
        </div>
      </div>

      {/* Critères, un par un, avec conseil pédagogique */}
      <div className="space-y-3">
        {heur.factors.map((f) => (
          <div
            key={f.label}
            className={`rounded-2xl border p-4 flex items-start gap-3 ${f.ok ? "border-green-100 bg-green-50/40" : "border-[#ffd5d6] bg-[#fff1f1]/60"}`}
          >
            <div className={`mt-0.5 shrink-0 ${f.ok ? "text-green-600" : "text-[#ff5a5f]"}`}>
              {f.ok ? <Check size={18} /> : <PenLine size={18} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold flex items-center gap-2">
                {f.label}
                <span className="text-[11px] font-medium text-gray-400">{f.value}/{f.max}</span>
              </p>
              <p className="text-sm text-[#5a6b85] leading-relaxed mt-1">{f.advice}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conseils personnalisés IA */}
      <div className="rounded-2xl bg-[#1b2a4a] text-white p-5">
        <p className="text-sm font-semibold flex items-center gap-1.5 mb-3">
          <Sparkles size={14} className="text-[#ff8a8d]" /> Conseils personnalisés (IA)
        </p>
        {tips === null ? (
          <p className="text-sm text-white/70 flex items-center gap-1.5">
            <RefreshCw size={13} className="animate-spin" /> Analyse de votre post en cours…
          </p>
        ) : tips.length === 0 ? (
          <p className="text-sm text-white/60">Aucune suggestion supplémentaire — votre post est déjà solide. 👍</p>
        ) : (
          <ul className="space-y-2.5">
            {tips.map((t, i) => (
              <li key={i} className="text-sm text-white/90 flex items-start gap-2 leading-relaxed">
                <ChevronRight size={16} className="text-[#ff8a8d] mt-0.5 shrink-0" /> {t}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Mini-graphiques SVG (donut, barres) — sans dépendance
// ----------------------------------------------------------------
function DonutChart({ data, size = 110, thickness = 16 }) {
  const total = data.reduce((a, d) => a + d.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  if (!total) {
    return (
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} className="-rotate-90">
      {data
        .filter((d) => d.value > 0)
        .map((d, i) => {
          const frac = d.value / total;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={d.color}
              strokeWidth={thickness}
              strokeDasharray={`${Math.max(frac * C - 2, 1)} ${C}`}
              strokeDashoffset={-acc * C}
              strokeLinecap="round"
            />
          );
          acc += frac;
          return el;
        })}
    </svg>
  );
}

function MiniBars({ values, labels }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-2 h-24">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className={`w-full max-w-7 rounded-t-md ${v ? "bg-gradient-to-t from-orange-400 to-orange-300" : "bg-gray-100"}`}
            style={{ height: `${Math.max((v / max) * 80, v ? 14 : 4)}px` }}
            title={`${v} post${v > 1 ? "s" : ""}`}
          />
          <span className="text-[10px] text-gray-400">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Tableau de bord : stats, file d'attente, calendrier
// ----------------------------------------------------------------
// ----------------------------------------------------------------
// Abonnement / facturation (Stripe Checkout + portail)
// ----------------------------------------------------------------
function BillingView({ user, showToast }) {
  const [billingInterval, setBillingInterval] = useState(user?.subscriptionInterval === "year" ? "year" : "month");
  const [busy, setBusy] = useState(null); // id de l'action en cours
  const currentPlan = planOf(user).id;
  const status = user?.subscriptionStatus;
  const active = ["active", "trialing", "past_due"].includes(status || "");
  const trial = trialDaysLeft(user);

  const STATUS_LABEL = {
    active: "Actif",
    trialing: "Essai Stripe en cours",
    past_due: "Paiement en retard",
    canceled: "Annulé",
    unpaid: "Impayé",
    incomplete: "Incomplet",
  };

  const subscribe = async (plan) => {
    setBusy(plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval: billingInterval }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      window.location.href = d.url;
    } catch (e) {
      showToast(e.message);
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      window.location.href = d.url;
    } catch (e) {
      showToast(e.message);
      setBusy(null);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* État actuel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-gray-500">Votre offre actuelle</p>
            <p className="text-2xl font-extrabold mt-0.5">{planLabel(currentPlan)}</p>
            {active ? (
              <p className="text-sm text-gray-500 mt-1">
                {STATUS_LABEL[status] || status}
                {user?.subscriptionInterval ? ` · facturation ${user.subscriptionInterval === "year" ? "annuelle" : "mensuelle"}` : ""}
                {user?.currentPeriodEnd ? ` · prochaine échéance le ${new Date(user.currentPeriodEnd).toLocaleDateString("fr-FR")}` : ""}
              </p>
            ) : trial != null && trial > 0 ? (
              <p className="text-sm text-amber-600 mt-1">
                Essai gratuit — {trial} jour{trial > 1 ? "s" : ""} restant{trial > 1 ? "s" : ""}. Abonnez-vous pour continuer après l'essai.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">Aucun abonnement actif.</p>
            )}
          </div>
          {user?.hasBilling && (
            <button
              onClick={openPortal}
              disabled={busy === "portal"}
              className="border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a] font-semibold px-5 py-2.5 rounded-full flex items-center gap-2"
            >
              {busy === "portal" ? <RefreshCw size={15} className="animate-spin" /> : <CreditCard size={15} />} Gérer mon abonnement
            </button>
          )}
        </div>
      </div>

      {/* Sélecteur mensuel / annuel */}
      <div className="flex items-center justify-center">
        <div className="bg-gray-100 p-1 rounded-full flex">
          <button
            onClick={() => setBillingInterval("month")}
            className={`px-5 py-2 rounded-full text-sm font-semibold ${billingInterval === "month" ? "bg-white shadow-sm text-[#1b2a4a]" : "text-gray-500"}`}
          >
            Mensuel
          </button>
          <button
            onClick={() => setBillingInterval("year")}
            className={`px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 ${billingInterval === "year" ? "bg-white shadow-sm text-[#1b2a4a]" : "text-gray-500"}`}
          >
            Annuel <span className="text-[10px] font-bold text-[#ff5a5f] bg-[#fff1f1] px-1.5 py-0.5 rounded-full">2 mois offerts</span>
          </button>
        </div>
      </div>

      {/* Cartes d'offres */}
      <div className="grid md:grid-cols-3 gap-4 items-start">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const monthly = p.price;
          const yearly = p.price * 10;
          const price = billingInterval === "year" ? yearly : monthly;
          const isCurrent = id === currentPlan && active;
          return (
            <div
              key={id}
              className={`bg-white rounded-2xl p-6 relative ${id === "pro" ? "ring-2 ring-[#ff5a5f] shadow-lg" : "border border-gray-100 shadow-sm"}`}
            >
              {id === "pro" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#ff5a5f] text-white text-xs font-semibold px-3 py-1 rounded-full">
                  Le plus choisi
                </span>
              )}
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="mt-3">
                <span className="text-3xl font-extrabold">{price} €</span>
                <span className="text-gray-400 text-sm"> /{billingInterval === "year" ? "an" : "mois"} HT</span>
              </p>
              {billingInterval === "year" && (
                <p className="text-xs text-[#ff5a5f] font-medium mt-1">soit {(yearly / 12).toFixed(2)} €/mois</p>
              )}
              {isCurrent ? (
                <div className="mt-5 text-center text-sm font-semibold text-[#ff5a5f] border-2 border-[#ffd5d6] rounded-full py-2.5">
                  Offre actuelle
                </div>
              ) : (
                <button
                  onClick={() => subscribe(id)}
                  disabled={busy === id}
                  className={`mt-5 w-full font-semibold px-4 py-2.5 rounded-full flex items-center justify-center gap-2 ${
                    id === "pro" ? "bg-[#ff5a5f] hover:bg-[#f63d44] text-white" : "border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a]"
                  }`}
                >
                  {busy === id ? <RefreshCw size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  {active ? "Choisir cette offre" : "S'abonner"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Paiement sécurisé par Stripe. Sans engagement, résiliable à tout moment depuis « Gérer mon abonnement ».
      </p>
    </main>
  );
}

// Écran de blocage affiché quand l'essai est terminé sans abonnement actif
function PaywallScreen({ user, showToast, onLogout }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="bg-[#ff5a5f] text-white p-2 rounded-xl">
            <LpMark size={18} />
          </div>
          <span className="font-extrabold text-[#1b2a4a]">LinkeePost</span>
        </div>
        <button onClick={onLogout} className="text-sm text-gray-500 hover:text-[#ff5a5f] flex items-center gap-1.5">
          <LogOut size={15} /> Se déconnecter
        </button>
      </header>
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mt-10 mb-2">
          <div className="w-14 h-14 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] flex items-center justify-center mx-auto mb-4">
            <Lock size={26} />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold">Votre essai gratuit est terminé</h1>
          <p className="text-[#5a6b85] mt-2 max-w-xl mx-auto">
            Abonnez-vous pour continuer à utiliser LinkeePost. Vos posts, campagnes et réglages sont conservés —
            tout reprend dès l'abonnement activé.
          </p>
        </div>
        <BillingView user={user} showToast={showToast} />
      </div>
    </div>
  );
}

function DashboardView({ drafts, canVeille = true, canEvents = false, canScore = true, canCampaigns = true, postsLimit = null, onGoCreate, onGoHistory, onGoEvents, onGoProfile, onApprove, profile, linkedin, orgs, onPlanned, onProfileSaved, showToast, onInspire }) {
  const [mode, setMode] = useState("list"); // list | calendar
  const [periodDays, setPeriodDays] = useState(7);
  const [planTarget, setPlanTarget] = useState("person");
  const [planningId, setPlanningId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [wizardInit, setWizardInit] = useState(null); // {} = vierge, {theme,...} = pré-rempli

  const loadCampaigns = () =>
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {});

  useEffect(() => {
    loadCampaigns();
  }, []);

  const slotsPreview = nextPreferredSlots(profile, 100)?.filter(
    (s) => s <= new Date(Date.now() + periodDays * 86400000)
  );

  // Génère la suite d'une campagne existante sur la période choisie
  const planForCampaign = async (c) => {
    setPlanningId(c.id);
    try {
      const res = await fetch("/api/campaign/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: c.id, periodDays, target: planTarget }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      showToast(
        data.created === 0
          ? "Tous les créneaux de la période sont déjà occupés"
          : data.status === "à valider"
          ? `${data.created} posts générés pour « ${c.name} » — à valider ✓`
          : `${data.created} posts programmés pour « ${c.name} » ✓`
      );
      onPlanned();
      loadCampaigns();
    } catch (e) {
      showToast(e.message);
    } finally {
      setPlanningId(null);
    }
  };

  const archiveCampaign = async (c) => {
    try {
      await fetch(`/api/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archivée" }),
      });
      setCampaigns((list) => list.filter((x) => x.id !== c.id));
      showToast(`Campagne « ${c.name} » archivée`);
    } catch {
      showToast("Erreur d'archivage");
    }
  };

  const toggleAutopilot = async (checked) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoGenerate: checked }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      onProfileSaved(data.profile);
      showToast(checked ? "Pilote automatique activé ✓" : "Pilote automatique désactivé");
    } catch (e) {
      showToast(e.message);
    }
  };

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const publishedThisMonth = drafts.filter(
    (d) => d.status === "publié" && new Date(d.publishedAt ?? d.createdAt) >= monthStart
  ).length;
  const postsThisMonth = drafts.filter((d) => new Date(d.createdAt) >= monthStart).length;
  const scheduled = drafts
    .filter((d) => d.status === "programmé" && d.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const pending = drafts.filter((d) => d.status === "brouillon").length;
  const errors = drafts.filter((d) => d.status === "erreur");
  const toValidate = drafts
    .filter((d) => d.status === "à valider")
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const recent = drafts
    .filter((d) => d.status === "publié")
    .sort((a, b) => new Date(b.publishedAt ?? b.createdAt) - new Date(a.publishedAt ?? a.createdAt))
    .slice(0, 5);

  // Répartition des posts par statut (donut)
  const DONUT = [
    { label: "Publiés", value: drafts.filter((d) => d.status === "publié").length, color: "#22c55e" },
    { label: "Programmés", value: scheduled.length, color: "#f59e0b" },
    { label: "À valider", value: toValidate.length, color: "#a855f7" },
    { label: "Brouillons", value: pending, color: "#94a3b8" },
    { label: "Erreurs", value: errors.length, color: "#ef4444" },
  ];

  // Posts prévus sur les 7 prochains jours (barres)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const weekValues = weekDays.map(
    (day) =>
      drafts.filter(
        (d) =>
          (d.status === "programmé" || d.status === "à valider") &&
          d.scheduledAt &&
          sameDay(new Date(d.scheduledAt), day)
      ).length
  );
  const weekLabels = weekDays.map((d) =>
    d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "")
  );

  // Score d'engagement moyen des posts rédigés
  const scoredPosts = drafts.filter((d) => d.text && d.text.trim());
  const scores = scoredPosts.map((d) => scorePost({ text: d.text, type: d.type }).score);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
  const avgColor =
    avgScore == null ? "#94a3b8" : avgScore >= 80 ? "#16a34a" : avgScore >= 60 ? "#ff5a5f" : avgScore >= 40 ? "#f59e0b" : "#ef4444";
  const avgLevel =
    avgScore == null ? "" : avgScore >= 80 ? "Excellent" : avgScore >= 60 ? "Bon" : avgScore >= 40 ? "Moyen" : "À retravailler";
  const scoreBuckets = [
    { label: "Excellent", color: "#16a34a", count: scores.filter((s) => s >= 80).length },
    { label: "Bon", color: "#ff5a5f", count: scores.filter((s) => s >= 60 && s < 80).length },
    { label: "Moyen", color: "#f59e0b", count: scores.filter((s) => s >= 40 && s < 60).length },
    { label: "À retravailler", color: "#ef4444", count: scores.filter((s) => s < 40).length },
  ];

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      {/* KPI + graphiques */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Carte dégradée : activité du mois */}
        <div className="rounded-2xl p-5 text-white bg-gradient-to-br from-orange-400 via-orange-500 to-pink-500 shadow-lg shadow-orange-200 flex flex-col justify-between min-h-44">
          <div>
            <p className="text-sm font-medium text-white/90">Publiés ce mois-ci</p>
            <p className="text-4xl font-bold mt-1">{publishedThisMonth}</p>
            {postsLimit != null && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-white/85 mb-1">
                  <span>Posts générés ce mois</span>
                  <span className="font-semibold">
                    {postsThisMonth}/{postsLimit}
                  </span>
                </div>
                <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full"
                    style={{ width: `${Math.min(100, (postsThisMonth / postsLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-6 pt-3 border-t border-white/25">
            <div>
              <p className="text-xs text-white/80">À venir</p>
              <p className="text-lg font-semibold">{scheduled.length + toValidate.length}</p>
            </div>
            <div>
              <p className="text-xs text-white/80">Brouillons</p>
              <p className="text-lg font-semibold">{pending}</p>
            </div>
            {errors.length > 0 && (
              <div>
                <p className="text-xs text-white/80">Erreurs</p>
                <p className="text-lg font-semibold">{errors.length}</p>
              </div>
            )}
          </div>
        </div>

        {/* Donut : répartition des posts */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold mb-3">Répartition des posts</p>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <DonutChart data={DONUT} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-bold">{drafts.length}</p>
                <p className="text-[10px] text-gray-400">posts</p>
              </div>
            </div>
            <div className="space-y-1.5 min-w-0">
              {DONUT.filter((d) => d.value > 0).map((d) => (
                <div key={d.label} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-gray-500 truncate">{d.label}</span>
                  <span className="font-semibold ml-auto">{d.value}</span>
                </div>
              ))}
              {drafts.length === 0 && <p className="text-xs text-gray-400">Aucun post pour l'instant</p>}
            </div>
          </div>
        </div>

        {/* Barres : 7 prochains jours */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="text-sm font-semibold mb-3">Publications à venir (7 jours)</p>
          <MiniBars values={weekValues} labels={weekLabels} />
        </div>
      </div>

      {/* Score d'engagement moyen — verrouillé pour Essentiel */}
      {!canScore && (
        <a
          href="/tarifs"
          className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-gray-100 text-gray-400 shrink-0"><BarChart3 size={18} /></div>
              <div className="min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  Score d'engagement de vos posts <Lock size={13} className="text-gray-400" />
                </p>
                <p className="text-xs text-gray-500 mt-0.5">Notez et optimisez vos posts — inclus à partir de l'offre Pro.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#ff5a5f] px-4 py-2 rounded-full shrink-0">
              <ArrowUpCircle size={13} /> Faire évoluer
            </span>
          </div>
        </a>
      )}
      {canScore && avgScore != null && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <BarChart3 size={15} className="text-[#ff5a5f]" /> Score d'engagement moyen de vos posts
            </p>
            <span className="text-xs text-gray-400">
              {scores.length} post{scores.length > 1 ? "s" : ""} analysé{scores.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center shrink-0">
              <p className="text-4xl font-extrabold leading-none" style={{ color: avgColor }}>{avgScore}</p>
              <p className="text-[11px] text-gray-400 mt-1">/ 100</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold">Potentiel moyen</span>
                <span className="text-sm font-bold" style={{ color: avgColor }}>{avgLevel}</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${avgScore}%`, background: avgColor }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {scoreBuckets.filter((b) => b.count > 0).map((b) => (
                  <span key={b.label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                    {b.count} {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button onClick={onGoHistory} className="text-xs text-[#ff5a5f] hover:underline mt-4 inline-flex items-center gap-1">
            Optimiser mes posts <ChevronRight size={13} />
          </button>
        </div>
      )}

      {/* Raccourcis vers les fonctionnalités */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={onGoCreate}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <div className="p-2.5 rounded-xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-3"><PenLine size={18} /></div>
          <p className="font-semibold text-sm">Générer un post</p>
          <p className="text-xs text-gray-400 mt-0.5">Avec son score d'engagement</p>
        </button>

        {canScore ? (
          <button
            onClick={onGoHistory}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="p-2.5 rounded-xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-3"><BarChart3 size={18} /></div>
            <p className="font-semibold text-sm">Optimiser mes posts</p>
            <p className="text-xs text-gray-400 mt-0.5">Score, réécriture & historique</p>
          </button>
        ) : (
          <a
            href="/tarifs"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all block"
          >
            <div className="p-2.5 rounded-xl bg-gray-100 text-gray-400 w-fit mb-3"><BarChart3 size={18} /></div>
            <p className="font-semibold text-sm flex items-center gap-1.5">Optimiser mes posts <Lock size={12} className="text-gray-400" /></p>
            <p className="text-xs text-[#ff5a5f] font-medium mt-0.5">Inclus à partir de l'offre Pro</p>
          </a>
        )}

        {canEvents ? (
          <button
            onClick={onGoEvents}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"
          >
            <div className="p-2.5 rounded-xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-3"><MapPin size={18} /></div>
            <p className="font-semibold text-sm">Événements</p>
            <p className="text-xs text-gray-400 mt-0.5">Salons & forums, notif. jour-J</p>
          </button>
        ) : (
          <a
            href="/tarifs"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all block relative"
          >
            <div className="p-2.5 rounded-xl bg-gray-100 text-gray-400 w-fit mb-3"><MapPin size={18} /></div>
            <p className="font-semibold text-sm flex items-center gap-1.5">Événements <Lock size={12} className="text-gray-400" /></p>
            <p className="text-xs text-[#ff5a5f] font-medium mt-0.5">Inclus dans l'offre Agence</p>
          </a>
        )}

        <button
          onClick={onGoProfile}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-left hover:-translate-y-0.5 hover:shadow-md transition-all"
        >
          <div className="p-2.5 rounded-xl bg-[#fff1f1] text-[#ff5a5f] w-fit mb-3"><UserRound size={18} /></div>
          <p className="font-semibold text-sm">Mon profil</p>
          <p className="text-xs text-gray-400 mt-0.5">Votre site web nourrit la rédaction</p>
        </button>
      </div>

      {/* Campagnes LinkedIn */}
      {wizardInit && (
        <CampaignWizard
          profile={profile}
          linkedin={linkedin}
          orgs={orgs}
          showToast={showToast}
          initial={wizardInit}
          onClose={() => setWizardInit(null)}
          onLaunched={() => {
            onPlanned();
            loadCampaigns();
          }}
        />
      )}
      {!canCampaigns ? (
        <div className="bg-gradient-to-r from-[#fff1f1] to-white rounded-xl border border-[#ffd5d6] p-5 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#fff1f1] rounded-xl flex items-center justify-center shrink-0">
              <Megaphone size={20} className="text-[#ff5a5f]" />
            </div>
            <div>
              <p className="font-semibold text-sm">Campagnes LinkedIn</p>
              <p className="text-xs text-gray-500">Planifiez des séries de posts et laissez l'IA générer votre calendrier éditorial — inclus à partir du plan Pro.</p>
            </div>
          </div>
          <a href="/tarifs" className="shrink-0 inline-flex items-center gap-1.5 bg-[#ff5a5f] hover:bg-[#d12d33] text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            <ArrowUpCircle size={14} /> Passer au plan Pro
          </a>
        </div>
      ) : (
      <div className="bg-gradient-to-r from-[#fff1f1] to-white rounded-xl border border-[#ffd5d6] p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Sparkles size={17} className="text-[#ff5a5f]" /> Mes campagnes
          </h2>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={profile?.autoGenerate ?? false}
              onChange={(e) => toggleAutopilot(e.target.checked)}
              className="accent-[#ff5a5f]"
            />
            Pilote automatique{" "}
            <span className="text-gray-400">(alimente chaque semaine la dernière campagne)</span>
          </label>
        </div>
        {!profile?.publishDays ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mt-2">
            Définissez d'abord votre rythme de publication (jours + heure) dans l'onglet Profil pour
            lancer des campagnes.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-3">
              Une campagne = un thème + un brief qui guident la génération. Les posts se posent sur
              vos créneaux (
              {(profile.publishDays ?? "")
                .split(",")
                .map((d) => WEEK_DAYS.find((w) => w.n === Number(d))?.label)
                .filter(Boolean)
                .join(", ")}{" "}
              à {profile.publishTime ?? "09:00"})
              {profile?.requireValidation ? ", soumis à votre validation." : ", publiés automatiquement."}
            </p>

            {campaigns.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 mb-3">
                {campaigns.map((c) => (
                  <div key={c.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {c.theme} · {c.postCount} post{c.postCount > 1 ? "s" : ""}
                        {c.objective ? ` · ${c.objective}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => planForCampaign(c)}
                        disabled={planningId !== null || !slotsPreview?.length}
                        className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      >
                        {planningId === c.id ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Sparkles size={12} />
                        )}
                        {planningId === c.id
                          ? "Génération…"
                          : `Générer ${slotsPreview?.length ?? 0} post${(slotsPreview?.length ?? 0) > 1 ? "s" : ""}`}
                      </button>
                      <button
                        onClick={() => archiveCampaign(c)}
                        className="text-gray-400 hover:text-red-600 p-1.5"
                        title="Archiver la campagne"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setWizardInit({})}
                className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-sm font-medium px-4 py-2.5 rounded-lg flex items-center gap-2"
              >
                <Sparkles size={15} /> Nouvelle campagne
              </button>
              {campaigns.length > 0 && (
                <>
                  <select
                    value={periodDays}
                    onChange={(e) => setPeriodDays(Number(e.target.value))}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                  >
                    <option value={7}>Semaine à venir</option>
                    <option value={14}>2 semaines</option>
                    <option value={30}>Mois à venir</option>
                  </select>
                  <select
                    value={planTarget}
                    onChange={(e) => setPlanTarget(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                  >
                    <option value="person">Profil personnel</option>
                    {linkedin?.orgConnected &&
                      orgs?.map((o) => (
                        <option key={o.urn} value={o.urn}>
                          Page : {o.name}
                        </option>
                      ))}
                  </select>
                </>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* Inspirations & veille */}
      {canVeille ? (
      <VeilleBlock
        showToast={showToast}
        onInspire={onInspire}
        onCampaign={(it) =>
          setWizardInit({
            theme: it.title,
            name: it.title.slice(0, 60),
            context: `Campagne initiée depuis cet article de veille :\n- Titre : ${it.title}${
              it.excerpt ? `\n- Extrait : ${it.excerpt}` : ""
            }${it.link ? `\n- URL : ${it.link}` : ""}\nLes posts de la campagne doivent partir de ce sujet d'actualité et le décliner sous différents angles pour la cible.`,
          })
        }
      />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
          <Lock size={22} className="text-[#ff5a5f] mx-auto mb-2" />
          <p className="text-sm font-semibold">Veille connectée & inspirations</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Surveillez les sources de votre secteur et transformez l'actualité en posts. Inclus à partir de l'offre Pro.
          </p>
          <a
            href="/tarifs"
            className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-white bg-[#ff5a5f] hover:bg-[#f63d44] px-4 py-2 rounded-full transition-colors"
          >
            <ArrowUpCircle size={13} /> Faire évoluer mon offre
          </a>
        </div>
      )}

      {/* Posts en attente de validation */}
      {toValidate.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm font-medium text-purple-800 flex items-center gap-2 mb-3">
            <Clock size={16} /> {toValidate.length} post{toValidate.length > 1 ? "s" : ""} en attente de
            validation
          </p>
          <div className="space-y-2">
            {toValidate.slice(0, 4).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 bg-white rounded-lg p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{d.theme || "Post"}</p>
                  <p className="text-xs text-gray-400">{fmtDateTime(d.scheduledAt)}</p>
                </div>
                <button
                  onClick={() => onApprove(d)}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
                >
                  <Check size={12} /> Valider
                </button>
              </div>
            ))}
          </div>
          {toValidate.length > 4 && (
            <button onClick={onGoHistory} className="text-xs text-purple-700 underline mt-2">
              Voir les {toValidate.length - 4} autres →
            </button>
          )}
        </div>
      )}

      {/* Erreurs de publication */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-medium text-red-700 flex items-center gap-2 mb-2">
            <AlertCircle size={16} /> {errors.length} publication{errors.length > 1 ? "s" : ""} en échec
          </p>
          {errors.slice(0, 3).map((d) => (
            <p key={d.id} className="text-xs text-red-600 truncate">
              « {d.theme} » — {d.publishError || "erreur inconnue"}
            </p>
          ))}
          <button onClick={onGoHistory} className="text-xs text-red-700 underline mt-2">
            Gérer dans Mes posts →
          </button>
        </div>
      )}

      {/* Planning */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Prochaines publications</h2>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                mode === "list" ? "bg-white shadow-sm" : "text-gray-500"
              }`}
            >
              <List size={13} /> Liste
            </button>
            <button
              onClick={() => setMode("calendar")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 ${
                mode === "calendar" ? "bg-white shadow-sm" : "text-gray-500"
              }`}
            >
              <CalendarDays size={13} /> Calendrier
            </button>
          </div>
        </div>

        {mode === "calendar" ? (
          <CalendarMonth drafts={drafts} />
        ) : scheduled.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
            <Clock size={28} className="mx-auto mb-2" />
            <p className="text-sm">Aucun post programmé.</p>
            <button onClick={onGoCreate} className="text-sm text-[#ff5a5f] hover:underline mt-1">
              Générer un post →
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {scheduled.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.theme || "Post"}</p>
                  <p className="text-xs text-gray-500 truncate">{d.text.slice(0, 90)}…</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium text-amber-600">{relativeTime(d.scheduledAt)}</p>
                  <p className="text-xs text-gray-400">
                    {fmtDateTime(d.scheduledAt)} ·{" "}
                    {d.target === "person" ? "profil perso" : "page entreprise"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dernières publications */}
      {recent.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3">Dernières publications</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
            {recent.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{d.theme || "Post"}</p>
                  <p className="text-xs text-gray-400">
                    {fmtDateTime(d.publishedAt ?? d.createdAt)} ·{" "}
                    {d.target === "person" ? "profil perso" : "page entreprise"}
                  </p>
                </div>
                {d.postId && (
                  <a
                    href={`https://www.linkedin.com/feed/update/${d.postId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[#ff5a5f] hover:underline flex items-center gap-1 shrink-0"
                  >
                    Voir sur LinkedIn <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ----------------------------------------------------------------
// Statistiques : profil personnel (Phyllo) + page entreprise (LinkedIn API)
// ----------------------------------------------------------------
function StatsView({ linkedin, orgs, profile, drafts }) {
  const [org, setOrg] = useState(orgs[0]?.urn ?? "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [campTab, setCampTab] = useState("active");
  const [expandedId, setExpandedId] = useState(null);
  const [pStats, setPStats] = useState(null);
  const [pLoading, setPLoading] = useState(false);

  useEffect(() => {
    fetch("/api/campaigns?all=1")
      .then((r) => r.json())
      .then((d) => setCampaigns(d.campaigns ?? []))
      .catch(() => {});
  }, []);

  // Stats du profil personnel via Phyllo
  useEffect(() => {
    if (!profile?.phylloAccountId) return;
    setPLoading(true);
    fetch("/api/phyllo/stats")
      .then(readJson)
      .then((d) => setPStats(d.connected ? d : null))
      .catch(() => {})
      .finally(() => setPLoading(false));
  }, [profile?.phylloAccountId]);

  // Stats LinkedIn par draft (disponibles pour les posts de page entreprise)
  const statsByDraftId = {};
  for (const p of data?.posts ?? []) {
    if (p.stats) statsByDraftId[p.id] = p.stats;
  }

  // Qualité agrégée d'une campagne (sur les posts dont LinkedIn fournit les stats)
  const campaignQuality = (c) => {
    const cDrafts = (drafts ?? []).filter((d) => d.campaignId === c.id);
    const withStats = cDrafts.map((d) => statsByDraftId[d.id]).filter(Boolean);
    if (!withStats.length) return null;
    const sum = (k) => withStats.reduce((acc, s) => acc + (s[k] ?? 0), 0);
    return {
      measured: withStats.length,
      impressions: sum("impressionCount"),
      clicks: sum("clickCount"),
      likes: sum("likeCount"),
      comments: sum("commentCount"),
      shares: sum("shareCount"),
    };
  };

  useEffect(() => {
    if (!org) return;
    setLoading(true);
    setError(null);
    fetch(`/api/linkedin/stats?org=${encodeURIComponent(org)}`)
      .then(readJson)
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [org]);

  const fmt = (n) => (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n));
  const pct = (n) => (n == null ? "—" : `${(n * 100).toFixed(2)} %`);

  const CARDS = data?.aggregate
    ? [
        { label: "Impressions", value: fmt(data.aggregate.impressionCount), icon: Eye },
        { label: "Clics", value: fmt(data.aggregate.clickCount), icon: MousePointerClick },
        { label: "Réactions", value: fmt(data.aggregate.likeCount), icon: ThumbsUp },
        { label: "Commentaires", value: fmt(data.aggregate.commentCount), icon: MessageSquare },
        { label: "Partages", value: fmt(data.aggregate.shareCount), icon: Share2 },
        { label: "Engagement", value: pct(data.aggregate.engagement), icon: BarChart3 },
      ]
    : [];

  const PAGE_CARDS = data?.pageStats
    ? [
        { label: "Vues totales", value: fmt(data.pageStats.totalPageViews), icon: Eye },
        { label: "Visiteurs uniques", value: fmt(data.pageStats.uniquePageViews), icon: Users },
        { label: "Vues mobile", value: fmt(data.pageStats.mobilePageViews), icon: Smartphone },
        { label: "Vues desktop", value: fmt(data.pageStats.desktopPageViews), icon: Monitor },
      ]
    : [];

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-semibold text-lg">Statistiques</h2>
          <p className="text-sm text-gray-500">Performance de vos publications</p>
        </div>
        {linkedin.orgConnected && orgs.length > 0 && (
          <select
            value={org}
            onChange={(e) => setOrg(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
          >
            {orgs.map((o) => (
              <option key={o.urn} value={o.urn}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── 1. Suivi des campagnes ── */}
      {campaigns.length > 0 && (
        <section>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Megaphone size={16} className="text-[#ff5a5f]" /> Suivi des campagnes
            </h3>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {[
                ["active",   `Actives (${campaigns.filter((c) => c.status === "active").length})`],
                ["archived", `Archivées (${campaigns.filter((c) => c.status === "archivée").length})`],
              ].map(([id, lbl]) => (
                <button key={id} onClick={() => setCampTab(id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${campTab === id ? "bg-white shadow-sm" : "text-gray-500"}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {campaigns
              .filter((c) => campTab === "active" ? c.status === "active" : c.status === "archivée")
              .map((c) => {
                const progress = c.postCount > 0 ? Math.round((c.published / c.postCount) * 100) : 0;
                const quality = campaignQuality(c);
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold truncate">{c.name}</h4>
                          {c.objective && <span className="text-xs bg-[#fff1f1] text-[#f63d44] px-2 py-0.5 rounded-full">{c.objective}</span>}
                          {c.status === "archivée" && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">archivée</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.theme} · ton {profile?.tone ?? "Professionnel"}
                          {profile?.targetAudience ? ` · cible : ${profile.targetAudience}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">créée le {new Date(c.createdAt).toLocaleDateString("fr-FR")}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                        <span>
                          <span className="font-semibold text-green-600">{c.published}</span> publié{c.published > 1 ? "s" : ""} ·{" "}
                          <span className="font-semibold text-amber-600">{c.scheduled + c.toValidate}</span> à publier
                          {c.toValidate > 0 && ` (dont ${c.toValidate} à valider)`}
                          {c.errors > 0 && <span className="text-red-600"> · {c.errors} en erreur</span>}
                        </span>
                        <span>{progress} %{c.nextScheduledAt && ` · prochain : ${fmtDateTime(c.nextScheduledAt)}`}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    {quality ? (
                      <div className="grid grid-cols-5 gap-2 text-center bg-gray-50 rounded-lg p-3">
                        {[["Impressions", quality.impressions], ["Clics", quality.clicks], ["Réactions", quality.likes], ["Comm.", quality.comments], ["Partages", quality.shares]].map(([label, v]) => (
                          <div key={label}>
                            <p className="text-sm font-bold">{new Intl.NumberFormat("fr-FR").format(v)}</p>
                            <p className="text-xs text-gray-500">{label}</p>
                          </div>
                        ))}
                      </div>
                    ) : c.published > 0 && (
                      <p className="text-xs text-gray-400">Qualité disponible pour les posts publiés sur une page entreprise connectée.</p>
                    )}
                    {c.context && (
                      <div className="mt-2">
                        <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="text-xs text-gray-500 hover:text-[#ff5a5f] flex items-center gap-1">
                          <ChevronDown size={13} className={`transition-transform ${expandedId === c.id ? "rotate-180" : ""}`} />
                          Détail de la campagne
                        </button>
                        {expandedId === c.id && (
                          <pre className="whitespace-pre-wrap text-xs text-gray-600 bg-gray-50 rounded-lg p-3 mt-2 max-h-48 overflow-y-auto font-sans">{c.context}</pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            {campaigns.filter((c) => campTab === "active" ? c.status === "active" : c.status === "archivée").length === 0 && (
              <p className="text-sm text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
                {campTab === "active" ? "Aucune campagne active." : "Aucune campagne archivée."}
              </p>
            )}
          </div>
        </section>
      )}

      {/* ── 2. Profil personnel (Phyllo) ── */}
      <section>
        <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
          <UserRound size={16} className="text-[#ff5a5f]" /> Profil personnel
          {pStats?.profile?.name && <span className="text-gray-400 font-normal text-sm">— {pStats.profile.name}</span>}
          {profile?.phylloAccountId && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">via Phyllo</span>}
        </h3>
        {!profile?.phylloAccountId ? (
          <div className="bg-[#fff1f1] border border-[#ffe0e0] rounded-xl p-4 text-sm text-[#1b2a4a] flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>Connectez Phyllo dans l'onglet Profil pour voir les statistiques de votre profil personnel.</span>
          </div>
        ) : pLoading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">
            <RefreshCw size={22} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
            <p className="text-sm">Récupération des statistiques du profil…</p>
          </div>
        ) : pStats ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
              {[
                ["Abonnés", pStats.profile?.followers],
                ["Vues", pStats.aggregate?.views],
                ["Réactions", pStats.aggregate?.likes],
                ["Commentaires", pStats.aggregate?.comments],
                ["Partages", pStats.aggregate?.shares],
              ].map(([label, v]) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xl font-bold">{v == null ? "—" : new Intl.NumberFormat("fr-FR").format(v)}</p>
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>
            {pStats.contents?.length > 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                      <th className="p-3 font-medium">Post</th>
                      <th className="p-3 font-medium text-right">Vues</th>
                      <th className="p-3 font-medium text-right">Réactions</th>
                      <th className="p-3 font-medium text-right">Comm.</th>
                      <th className="p-3 font-medium text-right">Partages</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {pStats.contents.slice(0, 10).map((c) => (
                      <tr key={c.id}>
                        <td className="p-3 max-w-xs">
                          <p className="truncate">{c.title || "Post"}</p>
                          <p className="text-xs text-gray-400">{c.publishedAt ? fmtDateTime(c.publishedAt) : ""}</p>
                        </td>
                        {["views", "likes", "comments", "shares"].map((k) => (
                          <td key={k} className="p-3 text-right">
                            {c[k] == null ? "—" : new Intl.NumberFormat("fr-FR").format(c[k])}
                          </td>
                        ))}
                        <td className="p-3">
                          {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-[#ff5a5f] hover:text-[#d12d33]"><ExternalLink size={14} /></a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
                Première synchronisation Phyllo en cours — les posts apparaîtront d'ici quelques minutes.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
            Données indisponibles — réessayez dans quelques minutes.
          </p>
        )}
      </section>

      {/* ── 3. Page entreprise ── */}
      <section>
        <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
          <Linkedin size={16} className="text-[#0a66c2]" /> Page entreprise
          {org && orgs.find((o) => o.urn === org) && (
            <span className="text-gray-400 font-normal text-sm">— {orgs.find((o) => o.urn === org).name}</span>
          )}
        </h3>
        {!linkedin.orgConnected ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center text-gray-400">
            <BarChart3 size={28} className="mx-auto mb-2" />
            <p className="text-sm">Connectez votre page entreprise (onglet Profil) pour voir ses statistiques.</p>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
            <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-[#ff5a5f]" />
            <p className="text-sm">Récupération des statistiques…</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Vues de la page */}
            {data.pageStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  ["Vues totales", data.pageStats.totalPageViews, Eye],
                  ["Visiteurs uniques", data.pageStats.uniquePageViews, Users],
                  ["Vues mobile", data.pageStats.mobilePageViews, Smartphone],
                  ["Vues desktop", data.pageStats.desktopPageViews, Monitor],
                ].map(([label, v, Icon]) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <Icon size={16} className="text-[#0a66c2] mb-2" />
                    <p className="text-xl font-bold">{v == null ? "—" : new Intl.NumberFormat("fr-FR").format(v)}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Performance des publications */}
            {data.aggregate && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  ["Impressions", data.aggregate.impressionCount, Eye],
                  ["Clics", data.aggregate.clickCount, MousePointerClick],
                  ["Réactions", data.aggregate.likeCount, ThumbsUp],
                  ["Commentaires", data.aggregate.commentCount, MessageSquare],
                  ["Partages", data.aggregate.shareCount, Share2],
                  ["Engagement", data.aggregate.engagement != null ? `${(data.aggregate.engagement * 100).toFixed(2)} %` : "—", BarChart3],
                ].map(([label, v, Icon]) => (
                  <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                    <Icon size={16} className="text-[#ff5a5f] mb-2" />
                    <p className="text-xl font-bold">{typeof v === "string" ? v : v == null ? "—" : new Intl.NumberFormat("fr-FR").format(v)}</p>
                    <p className="text-xs text-gray-500">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {/* Posts publiés via LinkeePost */}
            <div>
              <h4 className="font-medium text-sm mb-2 text-gray-700">Posts publiés via LinkeePost</h4>
              {data.posts.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
                  Aucun post publié sur cette page depuis l'application.
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                        <th className="p-3 font-medium">Post</th>
                        <th className="p-3 font-medium text-right">Impressions</th>
                        <th className="p-3 font-medium text-right">Clics</th>
                        <th className="p-3 font-medium text-right">Réactions</th>
                        <th className="p-3 font-medium text-right">Comm.</th>
                        <th className="p-3 font-medium text-right">Partages</th>
                        <th className="p-3 font-medium text-right">Engag.</th>
                        <th className="p-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.posts.map((p) => (
                        <tr key={p.id}>
                          <td className="p-3 max-w-xs">
                            <p className="font-medium truncate">{p.theme || "Post"}</p>
                            <p className="text-xs text-gray-400">{p.publishedAt ? fmtDateTime(p.publishedAt) : ""}</p>
                          </td>
                          <td className="p-3 text-right">{p.stats?.impressionCount ?? "—"}</td>
                          <td className="p-3 text-right">{p.stats?.clickCount ?? "—"}</td>
                          <td className="p-3 text-right">{p.stats?.likeCount ?? "—"}</td>
                          <td className="p-3 text-right">{p.stats?.commentCount ?? "—"}</td>
                          <td className="p-3 text-right">{p.stats?.shareCount ?? "—"}</td>
                          <td className="p-3 text-right">{p.stats?.engagement != null ? `${(p.stats.engagement * 100).toFixed(2)} %` : "—"}</td>
                          <td className="p-3">
                            {p.postId && (
                              <a href={`https://www.linkedin.com/feed/update/${p.postId}/`} target="_blank" rel="noreferrer"
                                className="text-[#ff5a5f] hover:text-[#d12d33]" title="Voir sur LinkedIn">
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>

    </main>
  );
}

// ----------------------------------------------------------------
// Onboarding première connexion : profil en 4 étapes
// ----------------------------------------------------------------
function OnboardingWizard({ user, profile, linkedinConnected, onDone, showToast }) {
  // Si LinkedIn vient d'être connecté (retour OAuth), on reprend à la dernière étape
  const [step, setStep] = useState(linkedinConnected ? 5 : 0);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState({
    name: profile?.name ?? user?.name ?? "",
    headline: profile?.headline ?? "",
    companyName: profile?.companyName ?? "",
    businessDescription: profile?.businessDescription ?? "",
    targetAudience: profile?.targetAudience ?? "",
    market: profile?.market ?? "",
    commGoals: profile?.commGoals ?? "",
    expertise: profile?.expertise ?? "",
    themes: profile?.themes ?? "",
    tone: profile?.tone ?? "Professionnel",
    styleNotes: profile?.styleNotes ?? "",
    defaultMaxChars: profile?.defaultMaxChars ?? 1300,
    publishDays: profile?.publishDays ?? "2,4",
    publishTime: profile?.publishTime ?? "09:00",
    requireValidation: profile?.requireValidation ?? true,
  });

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  const toggleCsv = (key, value) => {
    const list = (fields[key] ?? "").split(",").filter(Boolean);
    const v = String(value);
    set(key, (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(","));
  };

  const STEPS = [
    { title: "Bienvenue ! Qui êtes-vous ?", subtitle: "Ces informations personnalisent toutes vos campagnes." },
    {
      title: "Votre environnement",
      subtitle: "LinkeePost gère vos campagnes LinkedIn : décrivez votre activité, votre marché et votre cible.",
    },
    { title: "Expertise et objectifs", subtitle: "Ce que vous incarnez, et ce que votre communication doit accomplir." },
    { title: "Votre façon d'écrire", subtitle: "L'IA imitera votre style à chaque génération." },
    {
      title: "Votre rythme de publication",
      subtitle: "Jours et heure de vos posts — vos programmations suivront ce rythme.",
    },
    { title: "Connectez LinkedIn", subtitle: "Pour publier en un clic. Vous pourrez le faire plus tard." },
  ];

  const canNext =
    step === 0
      ? fields.name.trim()
      : step === 1
      ? fields.businessDescription.trim()
      : step === 2
      ? fields.expertise.trim()
      : true;

  // Sauvegarde le profil puis lance l'OAuth LinkedIn (la page va se recharger)
  const connectLinkedIn = async () => {
    setSaving(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      window.location.href = "/api/linkedin/auth";
    } catch {
      setSaving(false);
      showToast("Erreur de sauvegarde, réessayez");
    }
  };

  const finish = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          postsPerWeek: (fields.publishDays ?? "").split(",").filter(Boolean).length || null,
          onboarded: true,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      onDone(data.profile);
    } catch (e) {
      showToast(e.message);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="bg-[#ff5a5f] text-white p-2.5 rounded-xl">
            <LpMark size={24} />
          </div>
          <h1 className="font-bold text-xl">LinkeePost</h1>
        </div>

        {/* Progression */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-[#ff5a5f]" : "bg-gray-200"}`}
            />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <p className="text-xs font-medium text-[#ff5a5f] mb-1">
            Étape {step + 1} sur {STEPS.length}
          </p>
          <h2 className="font-semibold text-lg">{STEPS[step].title}</h2>
          <p className="text-sm text-gray-500 mb-5">{STEPS[step].subtitle}</p>

          {step === 0 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Votre nom *</label>
                <input
                  type="text"
                  value={fields.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="ex : Jacques Castel"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Titre professionnel
                </label>
                <input
                  type="text"
                  value={fields.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="ex : Consultant SEO @ Acme"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Entreprise ou marque personnelle
                </label>
                <input
                  type="text"
                  value={fields.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder="ex : Acme Conseil"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Votre activité — que faites-vous, pour qui, avec quelle valeur ajoutée ? *
                </label>
                <textarea
                  rows={3}
                  value={fields.businessDescription}
                  onChange={(e) => set("businessDescription", e.target.value)}
                  placeholder={"ex : cabinet de conseil en transformation digitale pour PME\nindustrielles, spécialisé dans l'automatisation des processus"}
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Votre cible sur LinkedIn
                </label>
                <input
                  type="text"
                  value={fields.targetAudience}
                  onChange={(e) => set("targetAudience", e.target.value)}
                  placeholder="ex : dirigeants de PME industrielles 50-500 salariés, DAF, DSI"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Votre marché et positionnement
                </label>
                <textarea
                  rows={2}
                  value={fields.market}
                  onChange={(e) => set("market", e.target.value)}
                  placeholder="ex : marché concurrentiel dominé par les grands cabinets ; nous nous différencions par la proximité et le forfait"
                  className={inputCls}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Je suis un(e)… *
                </label>
                <input
                  type="text"
                  value={fields.expertise}
                  onChange={(e) => set("expertise", e.target.value)}
                  placeholder="ex : consultant en marketing digital spécialisé B2B"
                  className={inputCls}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXPERTISE_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => set("expertise", s)}
                      className="text-xs bg-gray-100 hover:bg-[#fff1f1] hover:text-[#f63d44] text-gray-600 px-2 py-1 rounded-full"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Vos thématiques favorites{" "}
                  <span className="text-gray-400 font-normal">(séparées par des virgules)</span>
                </label>
                <input
                  type="text"
                  value={fields.themes}
                  onChange={(e) => set("themes", e.target.value)}
                  placeholder="ex : SEO, prospection LinkedIn, freelancing"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Objectifs de votre communication
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {COMM_GOALS.map((g) => {
                    const active = (fields.commGoals ?? "").split(",").includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleCsv("commGoals", g)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${
                          active
                            ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">Ton par défaut</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      key={t}
                      onClick={() => set("tone", t)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        fields.tone === t
                          ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Mon mode d'écriture{" "}
                  <span className="text-gray-400 font-normal">(consignes pour l'IA)</span>
                </label>
                <textarea
                  rows={3}
                  value={fields.styleNotes}
                  onChange={(e) => set("styleNotes", e.target.value)}
                  placeholder={"ex : je tutoie mon audience, pas d'emojis,\nphrases courtes, une anecdote en ouverture"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Longueur par défaut :{" "}
                  <span className="text-[#ff5a5f] font-semibold">{fields.defaultMaxChars} caractères</span>
                </label>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={fields.defaultMaxChars}
                  onChange={(e) => set("defaultMaxChars", Number(e.target.value))}
                  className="w-full accent-[#ff5a5f]"
                />
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Vos jours de publication
                  {(fields.publishDays ?? "").split(",").filter(Boolean).length > 0 && (
                    <span className="text-[#ff5a5f] font-semibold">
                      {" "}
                      — {(fields.publishDays ?? "").split(",").filter(Boolean).length} post
                      {(fields.publishDays ?? "").split(",").filter(Boolean).length > 1 ? "s" : ""}/semaine
                    </span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  {WEEK_DAYS.map(({ n, label }) => {
                    const active = (fields.publishDays ?? "").split(",").includes(String(n));
                    return (
                      <button
                        key={n}
                        onClick={() => toggleCsv("publishDays", n)}
                        className={`flex-1 py-2 rounded-lg border text-xs font-medium ${
                          active
                            ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Heure de publication</label>
                <input
                  type="time"
                  value={fields.publishTime}
                  onChange={(e) => set("publishTime", e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Sur LinkedIn, 8h-10h en semaine donne généralement le meilleur reach.
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fields.requireValidation}
                    onChange={(e) => set("requireValidation", e.target.checked)}
                    className="accent-[#ff5a5f] mt-0.5"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">Valider mes posts avant publication</span>
                    <br />
                    <span className="text-xs text-gray-500">
                      Les posts de série programmés attendront votre validation. Décochez pour une
                      publication 100 % automatique.
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="text-center py-4">
              {linkedinConnected ? (
                <p className="text-sm text-green-700 bg-green-50 rounded-lg p-3 inline-flex items-center gap-2">
                  <Check size={16} /> LinkedIn connecté
                </p>
              ) : (
                <button
                  onClick={connectLinkedIn}
                  disabled={saving}
                  className="inline-flex items-center gap-2 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg"
                >
                  {saving ? <RefreshCw size={16} className="animate-spin" /> : <Linkedin size={16} />}
                  Connecter mon compte LinkedIn
                </button>
              )}
              <p className="text-xs text-gray-400 mt-3">
                Optionnel — vous pourrez le faire à tout moment depuis l'en-tête de l'application.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
            {step > 0 ? (
              <button onClick={() => setStep(step - 1)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Retour
              </button>
            ) : (
              <span />
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canNext}
                className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
              >
                Continuer <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={saving}
                className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-5 py-2 rounded-lg flex items-center gap-1.5"
              >
                {saving && <RefreshCw size={14} className="animate-spin" />}
                Terminer <Check size={15} />
              </button>
            )}
          </div>
        </div>

        <button
          onClick={finish}
          disabled={saving}
          className="text-xs text-gray-400 hover:text-gray-600 mt-4 block mx-auto"
        >
          Passer la configuration (modifiable ensuite dans « Profil »)
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Vue Clients — multi-compte Agence
// ----------------------------------------------------------------
function ClientsView({ showToast, onManage }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [wizard, setWizard] = useState(false); // true = mode création
  const [form, setForm] = useState({ name: "", companyName: "", email: "" });
  const [formError, setFormError] = useState(null);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    fetch("/api/agency/clients")
      .then((r) => r.json())
      .then((d) => setClients(d.clients ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openWizard = () => { setForm({ name: "", companyName: "", email: "" }); setFormError(null); setWizard(true); };
  const closeWizard = () => setWizard(false);

  const createClient = async (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/agency/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error || "Erreur"); return; }
      setClients((c) => [...c, d.client]);
      closeWizard();
      showToast("Client créé ✓");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteClient = async (id) => {
    if (!confirm("Supprimer ce client et toutes ses données ? Cette action est irréversible.")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/agency/clients/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
      setClients((c) => c.filter((cl) => cl.id !== id));
      showToast("Client supprimé");
    } catch (err) {
      showToast(err.message);
    } finally {
      setDeleting(null);
    }
  };

  /* ── Mode wizard (création) ── */
  if (wizard) {
    return (
      <main className="max-w-xl mx-auto p-6">
        {/* Fil d'Ariane */}
        <button
          onClick={closeWizard}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-6"
        >
          <ChevronLeft size={16} /> Mes clients
        </button>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <div className="w-12 h-12 rounded-2xl bg-[#fff1f1] flex items-center justify-center mb-4">
            <UserPlus size={22} className="text-[#ff5a5f]" />
          </div>
          <h2 className="text-xl font-bold text-[#1b2a4a] mb-1">Nouveau client</h2>
          <p className="text-sm text-gray-400 mb-7">
            Ces informations permettent de personnaliser la génération de contenu.
            Vous pourrez compléter le profil et connecter LinkedIn depuis son espace.
          </p>

          <form onSubmit={createClient} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Nom du contact *</label>
              <input
                autoFocus
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Marie Dupont"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Entreprise</label>
              <input
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                placeholder="Acme SAS"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                E-mail <span className="text-gray-300 font-normal">(optionnel — pour référence uniquement)</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="marie@acme.fr"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-100 text-red-600 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                <AlertCircle size={15} /> {formError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting || !form.name.trim()}
                className="flex-1 bg-[#ff5a5f] text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e5454a] disabled:opacity-50 transition-colors"
              >
                {submitting ? "Création…" : "Créer le compte client"}
              </button>
              <button
                type="button"
                onClick={closeWizard}
                className="px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:bg-gray-50 border border-gray-100"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  /* ── Mode liste ── */
  return (
    <main className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#1b2a4a]">Mes clients</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {clients.length ? `${clients.length} client${clients.length > 1 ? "s" : ""}` : "Gérez les comptes de vos clients"}
          </p>
        </div>
        {clients.length > 0 && (
          <button
            onClick={openWizard}
            className="flex items-center gap-2 bg-[#ff5a5f] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#e5454a] transition-colors"
          >
            <UserPlus size={15} /> Ajouter un client
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-300 text-sm">Chargement…</div>
      ) : clients.length === 0 ? (
        /* État vide — wizard intégré dans la page */
        <div className="flex flex-col items-center justify-center py-10">
          <div className="w-16 h-16 rounded-2xl bg-[#fff1f1] flex items-center justify-center mb-5">
            <Users size={28} className="text-[#ff5a5f]" />
          </div>
          <h3 className="font-bold text-lg text-[#1b2a4a] mb-1">Ajoutez votre premier client</h3>
          <p className="text-sm text-gray-400 text-center max-w-xs mb-6">
            Chaque client dispose de son propre espace : profil, posts, campagnes et connexions LinkedIn.
          </p>
          <button
            onClick={openWizard}
            className="flex items-center gap-2 bg-[#ff5a5f] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#e5454a] transition-colors"
          >
            <UserPlus size={16} /> Créer le premier compte client
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white border border-gray-100 rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:border-[#ffd5d6] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#ff5a5f] to-orange-400 flex items-center justify-center text-white font-bold text-base shrink-0">
                  {(client.name?.[0] ?? "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#1b2a4a] truncate">{client.name}</p>
                  {client.companyName && (
                    <p className="text-xs text-gray-400 truncate">{client.companyName}</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-gray-400 flex items-center gap-1.5">
                <Linkedin size={13} className={client.linkedin?.personName ? "text-[#0a66c2]" : "text-gray-200"} />
                {client.linkedin?.personName
                  ? <span className="text-gray-600">{client.linkedin.personName}</span>
                  : <span>LinkedIn non connecté</span>
                }
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-gray-50">
                <button
                  onClick={() => onManage(client)}
                  className="flex-1 bg-[#ff5a5f] text-white py-1.5 rounded-lg text-xs font-semibold hover:bg-[#e5454a] transition-colors"
                >
                  Gérer ce client
                </button>
                <button
                  onClick={() => deleteClient(client.id)}
                  disabled={deleting === client.id}
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {/* Carte "Ajouter" toujours visible dans la grille */}
          <button
            onClick={openWizard}
            className="border-2 border-dashed border-gray-200 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 text-gray-300 hover:border-[#ff5a5f] hover:text-[#ff5a5f] transition-colors min-h-[140px]"
          >
            <UserPlus size={22} />
            <span className="text-xs font-medium">Ajouter un client</span>
          </button>
        </div>
      )}
    </main>
  );
}

// ----------------------------------------------------------------
// Page profil : identité, expertise, style de rédaction
// ----------------------------------------------------------------
function ProfileView({ profile, onSaved, showToast, linkedin, onDisconnect, instagram, onDisconnectInstagram, canOrgPublish = true }) {
  const [fields, setFields] = useState({
    name: profile?.name ?? "",
    headline: profile?.headline ?? "",
    website: profile?.website ?? "",
    companyName: profile?.companyName ?? "",
    businessDescription: profile?.businessDescription ?? "",
    targetAudience: profile?.targetAudience ?? "",
    market: profile?.market ?? "",
    commGoals: profile?.commGoals ?? "",
    expertise: profile?.expertise ?? "",
    themes: profile?.themes ?? "",
    tone: profile?.tone ?? "Professionnel",
    styleNotes: profile?.styleNotes ?? "",
    defaultMaxChars: profile?.defaultMaxChars ?? 1300,
    publishDays: profile?.publishDays ?? "",
    publishTime: profile?.publishTime ?? "09:00",
    requireValidation: profile?.requireValidation ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const set = (k, v) => setFields((f) => ({ ...f, [k]: v }));

  // Analyse le site internet et pré-remplit les champs de contexte métier
  const analyzeSite = async () => {
    if (!fields.website?.trim()) {
      showToast("Indiquez d'abord l'adresse de votre site.");
      return;
    }
    setAnalyzing(true);
    try {
      const res = await fetch("/api/profile/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: fields.website }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error || "Analyse impossible");
      const f = d.fields || {};
      setFields((prev) => ({
        ...prev,
        companyName: f.companyName?.trim() || prev.companyName,
        businessDescription: f.businessDescription?.trim() || prev.businessDescription,
        targetAudience: f.targetAudience?.trim() || prev.targetAudience,
        market: f.market?.trim() || prev.market,
        expertise: f.expertise?.trim() || prev.expertise,
        themes: f.themes?.trim() || prev.themes,
        commGoals: f.commGoals?.trim() || prev.commGoals,
      }));
      showToast("Profil pré-rempli depuis votre site ✓ Vérifiez et enregistrez.");
    } catch (e) {
      showToast(e.message);
    } finally {
      setAnalyzing(false);
    }
  };
  const toggleCsv = (key, value) => {
    const list = (fields[key] ?? "").split(",").filter(Boolean);
    const v = String(value);
    set(key, (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]).join(","));
  };

  // Connexion des statistiques du profil personnel via Phyllo Connect
  const connectPhyllo = async () => {
    try {
      const res = await fetch("/api/phyllo/connect-token", { method: "POST" });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error || "Erreur Phyllo");
      if (!window.PhylloConnect) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdn.getphyllo.com/connect/v2/phyllo-connect.js";
          s.onload = resolve;
          s.onerror = () => reject(new Error("Impossible de charger le SDK Phyllo"));
          document.body.appendChild(s);
        });
      }
      const pc = window.PhylloConnect.initialize({
        clientDisplayName: "LinkeePost",
        environment: d.environment,
        userId: d.phylloUserId,
        token: d.token,
        workPlatformId: d.workPlatformId,
      });
      // Le SDK Phyllo exige la signature exacte de chaque callback
      pc.on("accountConnected", async (accountId, workplatformId, phylloUserId) => {
        await fetch("/api/phyllo/account", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId }),
        });
        onSaved({ ...profile, phylloAccountId: accountId });
        showToast("Statistiques du profil connectées ✓ (première synchro en cours)");
      });
      pc.on("accountDisconnected", (accountId, workplatformId, phylloUserId) => {});
      pc.on("tokenExpired", (phylloUserId) => showToast("Session Phyllo expirée — recliquez sur Connecter"));
      pc.on("exit", (reason, phylloUserId) => {});
      pc.on("connectionFailure", (reason, workplatformId, phylloUserId) =>
        showToast("Connexion Phyllo échouée : " + reason)
      );
      pc.open();
    } catch (e) {
      showToast(e.message);
    }
  };

  const disconnectPhyllo = async () => {
    await fetch("/api/phyllo/account", { method: "DELETE" });
    onSaved({ ...profile, phylloAccountId: null });
    showToast("Statistiques du profil déconnectées");
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          postsPerWeek: (fields.publishDays ?? "").split(",").filter(Boolean).length || null,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      onSaved(data.profile);
      showToast("Profil enregistré ✓");
    } catch (err) {
      showToast(err.message);
    } finally {
      setSaving(false);
    }
  };

  const input =
    "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]";
  const label = "text-sm font-medium text-gray-700 block mb-1.5";
  const cardTitle = (Icon, title) => (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="p-2 rounded-xl bg-[#fff1f1] text-[#ff5a5f]">
        <Icon size={16} />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );

  return (
    <main className="max-w-5xl mx-auto p-6">
      <form onSubmit={save} className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contexte métier */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {cardTitle(Megaphone, "Contexte métier & communication")}
            {/* Site internet + analyse IA */}
            <div className="bg-[#fff1f1] rounded-xl p-3 mb-4">
              <label className={label}>Votre site internet</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="text"
                  value={fields.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="https://votre-site.fr"
                  className={input}
                />
                <button
                  type="button"
                  onClick={analyzeSite}
                  disabled={analyzing}
                  className="shrink-0 bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                >
                  {analyzing ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {analyzing ? "Analyse…" : "Analyser"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                L'IA lit votre site et pré-remplit les champs ci-dessous — vérifiez puis enregistrez.
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <label className={label}>Activité — que faites-vous, pour qui, avec quelle valeur ajoutée ?</label>
                <textarea
                  rows={3}
                  value={fields.businessDescription}
                  onChange={(e) => set("businessDescription", e.target.value)}
                  placeholder="ex : cabinet de conseil en transformation digitale pour PME industrielles"
                  className={input}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={label}>Cible sur LinkedIn</label>
                  <input
                    type="text"
                    value={fields.targetAudience}
                    onChange={(e) => set("targetAudience", e.target.value)}
                    placeholder="ex : dirigeants de PME, DAF, DSI"
                    className={input}
                  />
                </div>
                <div>
                  <label className={label}>Marché & positionnement</label>
                  <input
                    type="text"
                    value={fields.market}
                    onChange={(e) => set("market", e.target.value)}
                    placeholder="ex : différenciation par la proximité"
                    className={input}
                  />
                </div>
              </div>
              <div>
                <label className={label}>Objectifs de communication</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMM_GOALS.map((g) => {
                    const active = (fields.commGoals ?? "").split(",").includes(g);
                    return (
                      <button
                        type="button"
                        key={g}
                        onClick={() => toggleCsv("commGoals", g)}
                        className={`text-xs px-3 py-1.5 rounded-full border ${
                          active
                            ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Expertise & style */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {cardTitle(PenLine, "Expertise & style d'écriture")}
            <div className="space-y-4">
              <div>
                <label className={label}>Mon expertise — « Je suis un(e)… »</label>
                <input
                  type="text"
                  value={fields.expertise}
                  onChange={(e) => set("expertise", e.target.value)}
                  placeholder="ex : consultant en marketing digital spécialisé B2B"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>
                  Thématiques favorites <span className="text-gray-400 font-normal">(séparées par des virgules)</span>
                </label>
                <input
                  type="text"
                  value={fields.themes}
                  onChange={(e) => set("themes", e.target.value)}
                  placeholder="ex : SEO, prospection LinkedIn, freelancing"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Ton par défaut</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => set("tone", t)}
                      className={`text-xs px-3 py-1.5 rounded-full border ${
                        fields.tone === t
                          ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={label}>
                  Mon mode d'écriture <span className="text-gray-400 font-normal">(consignes pour l'IA)</span>
                </label>
                <textarea
                  rows={3}
                  value={fields.styleNotes}
                  onChange={(e) => set("styleNotes", e.target.value)}
                  placeholder={"ex : je tutoie mon audience, pas d'emojis, phrases courtes"}
                  className={input}
                />
              </div>
              <div>
                <label className={label}>
                  Longueur par défaut :{" "}
                  <span className="text-[#ff5a5f] font-semibold">{fields.defaultMaxChars} caractères</span>
                </label>
                <input
                  type="range"
                  min="300"
                  max="3000"
                  step="100"
                  value={fields.defaultMaxChars}
                  onChange={(e) => set("defaultMaxChars", Number(e.target.value))}
                  className="w-full accent-[#ff5a5f]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Identité */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff5a5f] to-pink-500 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-[#ffd5d6] mb-2">
                {(fields.name || profile?.email || "?").slice(0, 1).toUpperCase()}
              </div>
              <p className="text-sm font-semibold">{fields.name || "Votre nom"}</p>
              <p className="text-xs text-gray-400">{profile?.email}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className={label}>Nom</label>
                <input
                  type="text"
                  value={fields.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="ex : Jacques Castel"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Titre professionnel</label>
                <input
                  type="text"
                  value={fields.headline}
                  onChange={(e) => set("headline", e.target.value)}
                  placeholder="ex : Consultant SEO @ Acme"
                  className={input}
                />
              </div>
              <div>
                <label className={label}>Entreprise / marque</label>
                <input
                  type="text"
                  value={fields.companyName}
                  onChange={(e) => set("companyName", e.target.value)}
                  placeholder="ex : Acme Conseil"
                  className={input}
                />
              </div>
            </div>
          </div>

          {/* Rythme de publication */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {cardTitle(Clock, "Rythme de publication")}
            <div className="space-y-4">
              <div>
                <label className={label}>
                  Jours
                  {(fields.publishDays ?? "").split(",").filter(Boolean).length > 0 && (
                    <span className="text-[#ff5a5f] font-semibold">
                      {" "}
                      — {(fields.publishDays ?? "").split(",").filter(Boolean).length}/semaine
                    </span>
                  )}
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {WEEK_DAYS.map(({ n, label: l }) => {
                    const active = (fields.publishDays ?? "").split(",").includes(String(n));
                    return (
                      <button
                        type="button"
                        key={n}
                        onClick={() => toggleCsv("publishDays", n)}
                        className={`py-2 rounded-lg border text-[11px] font-medium ${
                          active
                            ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                            : "border-gray-200 text-gray-600 hover:border-gray-300"
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className={label}>Heure de publication</label>
                <input
                  type="time"
                  value={fields.publishTime}
                  onChange={(e) => set("publishTime", e.target.value)}
                  className={input}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fields.requireValidation}
                  onChange={(e) => set("requireValidation", e.target.checked)}
                  className="accent-[#ff5a5f]"
                />
                Valider avant publication
              </label>
            </div>
          </div>

          {/* Enregistrer — sticky */}
          <div className="sticky bottom-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-medium py-3 rounded-2xl shadow-lg shadow-[#ffd5d6] flex items-center justify-center gap-2"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer mon profil
            </button>
          </div>
        </div>
      </form>

      {/* Connexions */}
      <div className="mt-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-xl bg-[#fff1f1] text-[#ff5a5f]">
            <Linkedin size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Connexions LinkedIn</h3>
            <p className="text-xs text-gray-400">Les comptes sur lesquels vos posts seront publiés.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-100">
          {/* Profil personnel */}
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${linkedin.connected ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                <Linkedin size={18} />
              </div>
              <div>
                <p className="text-sm font-medium">Profil personnel</p>
                {linkedin.connected ? (
                  <p className="text-xs text-gray-500">
                    Connecté en tant que <span className="font-medium">{linkedin.name || "—"}</span>
                    {linkedin.personExpiresAt && (
                      <> · expire le {new Date(linkedin.personExpiresAt).toLocaleDateString("fr-FR")}</>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Non connecté — requis pour publier sur votre profil</p>
                )}
              </div>
            </div>
            {linkedin.connected ? (
              <div className="flex gap-2">
                <a href="/api/linkedin/auth" className="text-xs border border-gray-200 hover:border-[#ff5a5f] text-gray-700 px-3 py-1.5 rounded-xl">
                  Reconnecter
                </a>
                <button
                  onClick={onDisconnect}
                  type="button"
                  className="text-xs border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-700 px-3 py-1.5 rounded-xl"
                >
                  Déconnecter
                </button>
              </div>
            ) : (
              <a href="/api/linkedin/auth" className="bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-medium px-4 py-2 rounded-xl flex items-center gap-1.5">
                <Linkedin size={14} /> Connecter
              </a>
            )}
          </div>

          {/* Page entreprise */}
          <div className="p-5 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 flex-1">
              <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${linkedin.orgConnected ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                <Linkedin size={18} />
              </div>
              <div>
                <p className="text-sm font-medium">Page entreprise</p>
                {linkedin.orgConnected ? (
                  <p className="text-xs text-gray-500">
                    Connectée
                    {linkedin.orgExpiresAt && <> · expire le {new Date(linkedin.orgExpiresAt).toLocaleDateString("fr-FR")}</>}
                  </p>
                ) : canOrgPublish ? (
                  <p className="text-xs text-gray-400">Connectez votre page entreprise LinkedIn pour publier en son nom.</p>
                ) : (
                  <p className="text-xs text-gray-400">Disponible à partir du plan <strong>Agence</strong>.</p>
                )}
              </div>
            </div>
            {linkedin.orgConnected ? (
              <a href="/api/linkedin/auth-org" className="text-xs border border-gray-200 hover:border-[#ff5a5f] text-gray-700 px-3 py-1.5 rounded-xl shrink-0">
                Reconnecter
              </a>
            ) : canOrgPublish ? (
              <a href="/api/linkedin/auth-org" className="text-xs bg-[#0a66c2] hover:bg-[#004182] text-white px-3 py-1.5 rounded-xl shrink-0 transition-colors">
                Connecter
              </a>
            ) : (
              <a href="/tarifs" className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-xl shrink-0 flex items-center gap-1">
                <Lock size={11} /> Agence
              </a>
            )}
          </div>

          {/* Statistiques du profil personnel via Phyllo */}
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${profile?.phylloAccountId ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="text-sm font-medium">Statistiques du profil personnel</p>
                {profile?.phylloAccountId ? (
                  <p className="text-xs text-gray-500">Connectées via Phyllo — visibles dans l'onglet Statistiques</p>
                ) : (
                  <p className="text-xs text-gray-400">Via Phyllo : vues, réactions et engagement de vos posts personnels</p>
                )}
              </div>
            </div>
            {profile?.phylloAccountId ? (
              <button
                onClick={disconnectPhyllo}
                type="button"
                className="text-xs border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-700 px-3 py-1.5 rounded-xl"
              >
                Déconnecter
              </button>
            ) : (
              <button
                onClick={connectPhyllo}
                type="button"
                className="border border-[#0a66c2] text-[#0a66c2] hover:bg-[#fff1f1] text-xs font-medium px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <BarChart3 size={14} /> Connecter
              </button>
            )}
          </div>

          {/* Instagram */}
          <div className="p-5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${instagram ? "bg-pink-50 text-pink-500" : "bg-gray-100 text-gray-400"}`}>
                {/* Icône Instagram inline (lucide ne l'a pas) */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Instagram</p>
                {instagram ? (
                  <p className="text-xs text-gray-500">
                    Connecté{instagram.igUsername ? ` en tant que @${instagram.igUsername}` : ""}
                    {instagram.igName ? ` (${instagram.igName})` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">Compte Business requis · publiez vos posts avec image sur Instagram</p>
                )}
              </div>
            </div>
            {instagram ? (
              <div className="flex gap-2">
                <a href="/api/instagram/auth" className="text-xs border border-gray-200 hover:border-pink-400 text-gray-700 px-3 py-1.5 rounded-xl">
                  Reconnecter
                </a>
                <button
                  onClick={onDisconnectInstagram}
                  type="button"
                  className="text-xs border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-700 px-3 py-1.5 rounded-xl"
                >
                  Déconnecter
                </button>
              </div>
            ) : (
              <a
                href="/api/instagram/auth"
                className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white text-xs font-medium px-4 py-2 rounded-xl flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                </svg>
                Connecter
              </a>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------
// Tutoriel de première connexion
// ----------------------------------------------------------------
function TutorialOverlay({ canEvents, onClose }) {
  const steps = [
    { icon: Sparkles, title: "Bienvenue sur LinkeePost 👋", text: "Quelques minutes par semaine suffisent pour garder une présence LinkedIn régulière. Voici l'essentiel pour bien démarrer." },
    { icon: PenLine, title: "1 · Générez un post", text: "Dans « Créer », donnez un thème : l'IA rédige un post à votre image. Vous pouvez aussi partir d'une idée repérée par la veille." },
    { icon: BarChart3, title: "2 · Lisez son score d'engagement", text: "Chaque post reçoit une note sur 100, avec des conseils concrets critère par critère pour l'améliorer avant de publier." },
    { icon: History, title: "3 · Optimisez en un clic", text: "Sur la page d'optimisation, réécrivez l'accroche, le corps ou la signature. Le score se recalcule en direct et l'historique conserve chaque version." },
    { icon: Megaphone, title: "4 · Lancez des campagnes", text: "Un thème, un brief, et une série de posts se planifie sur vos créneaux. La veille transforme l'actualité de votre secteur en posts." },
    { icon: Clock, title: "5 · Publiez automatiquement", text: "Choisissez vos jours et votre heure : les posts partent seuls sur LinkedIn, après votre validation si vous le souhaitez." },
    ...(canEvents
      ? [{ icon: MapPin, title: "6 · Couvrez vos événements", text: "Ajoutez vos salons et forums : LinkeePost génère des posts de présence et vous notifie le jour J pour poster une photo en direct." }]
      : []),
    { icon: Check, title: "Tout est prêt 🚀", text: "Commencez par générer votre premier post. Vous pourrez revoir ce guide à tout moment via le bouton « ? » en bas de l'écran." },
  ];
  const [i, setI] = useState(0);
  const step = steps[i];
  const last = i === steps.length - 1;
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[60] bg-[#1b2a4a]/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-br from-orange-400 via-[#ff5a5f] to-pink-500 p-8 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <Icon size={30} />
          </div>
          <h3 className="text-xl font-extrabold">{step.title}</h3>
        </div>
        <div className="p-6">
          <p className="text-[#5a6b85] leading-relaxed text-center min-h-16">{step.text}</p>

          {/* Points de progression */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {steps.map((_, n) => (
              <button
                key={n}
                onClick={() => setI(n)}
                className={`h-2 rounded-full transition-all ${n === i ? "w-6 bg-[#ff5a5f]" : "w-2 bg-gray-200"}`}
                aria-label={`Étape ${n + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-6">
            {i > 0 ? (
              <button onClick={() => setI(i - 1)} className="text-sm font-medium text-[#5a6b85] hover:text-[#1b2a4a] flex items-center gap-1">
                <ChevronLeft size={16} /> Précédent
              </button>
            ) : (
              <button onClick={onClose} className="text-sm font-medium text-gray-400 hover:text-gray-600">
                Passer
              </button>
            )}
            {last ? (
              <button onClick={onClose} className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-6 py-2.5 rounded-full flex items-center gap-2">
                C'est parti <Check size={16} />
              </button>
            ) : (
              <button onClick={() => setI(i + 1)} className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-6 py-2.5 rounded-full flex items-center gap-2">
                Suivant <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Application
// ----------------------------------------------------------------
export default function Home() {
  const [user, setUser] = useState(null);
  const [impersonating, setImpersonating] = useState(null); // { id, name, companyName } du client géré
  const [authChecked, setAuthChecked] = useState(false);

  const [view, setView] = useState("dashboard");
  const [upgrade, setUpgrade] = useState(null); // { feature } quand on clique une fonctionnalité verrouillée
  const [optimizeText, setOptimizeText] = useState(null); // { text, type } → page Étape 2 plein écran
  const [rewriting, setRewriting] = useState(false);
  const [rewriteScope, setRewriteScope] = useState("all"); // all | hook | body | signature
  const [versions, setVersions] = useState([]); // historique de versions { id, text, label, score }
  const [showTutorial, setShowTutorial] = useState(false); // tutoriel de première connexion

  // Lien profond (notifications, retour Stripe) — ex : /app?view=events, /app?billing=success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("view");
    const billing = params.get("billing");
    if (v === "events") setView("events");
    if (v === "billing") setView("billing");
    if (billing === "success") {
      setView("billing");
      showToast("Merci ! Votre abonnement est en cours d'activation ✓");
      // le webhook met à jour le plan en arrière-plan : on interroge /me plusieurs fois
      let tries = 0;
      const poll = () => {
        fetch("/api/auth/me")
          .then((r) => r.json())
          .then((d) => {
            if (d.user) setUser(d.user);
            tries += 1;
            if (tries < 5 && !["active", "trialing"].includes(d.user?.subscriptionStatus || "")) {
              setTimeout(poll, 2000);
            }
          })
          .catch(() => {});
      };
      setTimeout(poll, 1500);
    } else if (billing === "cancel") {
      setView("billing");
      showToast("Paiement annulé — vous pouvez réessayer quand vous voulez.");
    }
    if (v || billing) window.history.replaceState({}, "", "/app");
  }, []);


  // Ouvre la page Étape 2 et initialise l'historique
  // draftId : si fourni, les modifications sont enregistrées dans le brouillon
  const openOptimize = (text, type, draftId = null) => {
    setRewriteScope("all");
    setVersions([{ id: Date.now(), text, label: "Version initiale", score: scorePost({ text, type }).score }]);
    setOptimizeText({ text, type, draftId });
  };

  // Répercute un nouveau texte : brouillon (si draftId) ou post en cours de création
  const persistOptimized = (newText) => {
    if (optimizeText?.draftId) {
      patchDraft(optimizeText.draftId, { text: newText }).catch(() => {});
      setDrafts((ds) => ds.map((p) => (p.id === optimizeText.draftId ? { ...p, text: newText } : p)));
    } else {
      setResult((r) => (r ? { ...r, text: newText } : { text: newText }));
    }
    setOptimizeText((o) => ({ ...o, text: newText }));
  };

  // Édition manuelle dans l'aperçu (recalcule le score en direct, sans enregistrer)
  const editOptimizeText = (newText) => setOptimizeText((o) => ({ ...o, text: newText }));

  // Enregistre l'édition manuelle courante
  const saveOptimize = () => {
    persistOptimized(optimizeText.text);
    setVersions((vs) =>
      vs[vs.length - 1]?.text === optimizeText.text
        ? vs
        : [...vs, { id: Date.now(), text: optimizeText.text, label: "Édition manuelle", score: scorePost({ text: optimizeText.text, type: optimizeText.type }).score }]
    );
    showToast(optimizeText?.draftId ? "Brouillon enregistré ✓" : "Modifications appliquées ✓");
  };

  // Restaure une version de l'historique
  const restoreVersion = (v) => persistOptimized(v.text);

  // Réécrit le post (selon le périmètre choisi) en appliquant les conseils
  const rewriteOptimized = async () => {
    if (!optimizeText) return;
    setRewriting(true);
    try {
      const res = await fetch("/api/score/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: optimizeText.text, type: optimizeText.type, scope: rewriteScope }),
      });
      const d = await readJson(res);
      if (!res.ok) throw new Error(d.error);
      const label = { all: "Réécriture complète", hook: "Accroche", body: "Corps", signature: "Signature" }[rewriteScope] || "Réécriture";
      persistOptimized(d.text);
      setVersions((vs) => [...vs, { id: Date.now(), text: d.text, label, score: scorePost({ text: d.text, type: optimizeText.type }).score }]);
      showToast("Post réécrit ✓");
    } catch (e) {
      showToast(e.message);
    } finally {
      setRewriting(false);
    }
  };
  const [scheduleDraft, setScheduleDraft] = useState(null);
  const [scheduleStatus, setScheduleStatus] = useState("programmé"); // statut après la modal de date
  const [dragOverCol, setDragOverCol] = useState(null); // colonne kanban survolée pendant un drag
  const [editingResult, setEditingResult] = useState(false);
  const [resultDraftText, setResultDraftText] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [genMode, setGenMode] = useState("single"); // single | series
  const [seriesCount, setSeriesCount] = useState(5);
  const [wantVariants, setWantVariants] = useState(false);
  const [variants, setVariants] = useState(null);
  const [activeVariant, setActiveVariant] = useState(0);
  const [history, setHistory] = useState([]); // versions précédentes du post
  const [seriesResult, setSeriesResult] = useState(null);
  const [savingSeries, setSavingSeries] = useState(false);
  const [seriesStart, setSeriesStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [seriesInterval, setSeriesInterval] = useState(2);
  const [seriesUseRhythm, setSeriesUseRhythm] = useState(true);
  // Image générée pour le post courant
  const [postImage, setPostImage] = useState(null); // { url, prompt }
  const [imagePromptInput, setImagePromptInput] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  // Article de veille servant d'inspiration à la génération
  const [inspiration, setInspiration] = useState(null);
  // Ouverture du wizard de campagne demandée depuis la sidebar
  const [campaignWizardOpen, setCampaignWizardOpen] = useState(false);
  // Wizard : étape suivante proposée après chaque action
  // { type: "saved"|"published"|"scheduled", draft?, postId?, when? }
  const [nextStep, setNextStep] = useState(null);
  const [scheduleFromCreate, setScheduleFromCreate] = useState(false);
  const [form, setForm] = useState({
    type: "simple",
    theme: "",
    expertise: "",
    tone: "Professionnel",
    maxChars: 1300,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [toast, setToast] = useState(null);
  const [linkedin, setLinkedin] = useState({ connected: false, name: "", orgConnected: false });
  const [instagram, setInstagram] = useState(null); // null = chargement, false = non connecté, objet = connecté
  const [publishingId, setPublishingId] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [target, setTarget] = useState("person");
  const [profile, setProfile] = useState(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [linkedinLoaded, setLinkedinLoaded] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canGenerate = form.theme.trim() && form.expertise.trim();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Tutoriel à la première connexion (une fois le profil configuré)
  useEffect(() => {
    if (!user?.id || !profile?.onboardedAt) return;
    try {
      if (!localStorage.getItem(`lp_tuto_${user.id}`)) setShowTutorial(true);
    } catch {}
  }, [user?.id, profile?.onboardedAt]);

  const closeTutorial = () => {
    setShowTutorial(false);
    try {
      if (user?.id) localStorage.setItem(`lp_tuto_${user.id}`, "1");
    } catch {}
  };

  // Session utilisateur
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { setUser(d.user); setImpersonating(d.impersonating ?? null); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  // Données du compte une fois connecté
  useEffect(() => {
    if (!user) return;
    fetch("/api/linkedin/me")
      .then((r) => r.json())
      .then((d) => {
        setLinkedin(d);
        if (d.orgConnected) {
          fetch("/api/linkedin/organizations")
            .then((r) => r.json())
            .then((o) => setOrgs(o.organizations ?? []))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLinkedinLoaded(true));
    fetch("/api/instagram/me")
      .then((r) => r.json())
      .then((d) => setInstagram(d.account || false))
      .catch(() => setInstagram(false));
    fetch("/api/drafts")
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts ?? []))
      .catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (!d.profile) return;
        setProfile(d.profile);
        // Pré-remplissage du générateur depuis le profil
        setForm((f) => ({
          ...f,
          expertise: f.expertise || d.profile.expertise || "",
          tone: d.profile.tone || f.tone,
          maxChars: d.profile.defaultMaxChars || f.maxChars,
        }));
      })
      .catch(() => {})
      .finally(() => setProfileLoaded(true));

    const params = new URLSearchParams(window.location.search);
    const li = params.get("linkedin");
    const liMsg = params.get("msg") ? decodeURIComponent(params.get("msg")) : null;
    const LI_MESSAGES = {
      connected: "LinkedIn connecté ✓",
      org_connected: "Page entreprise connectée ✓",
      refused: liMsg || "Vous avez refusé l'autorisation LinkedIn",
      org_refused: liMsg ? `Page entreprise refusée : ${liMsg}` : "Autorisation refusée pour la page entreprise",
      state_mismatch: "Session OAuth expirée — réessayez la connexion",
      not_logged_in: "Connectez-vous d'abord à votre compte LinkeePost",
      error: liMsg ? `Erreur LinkedIn : ${liMsg}` : "Erreur LinkedIn — consultez le terminal du serveur",
      org_error: liMsg ? `Erreur page entreprise : ${liMsg}` : "Erreur LinkedIn (page entreprise) — consultez le terminal du serveur",
    };
    if (li) {
      showToast(LI_MESSAGES[li] ?? "Connexion LinkedIn échouée");
      // Recharger le statut LinkedIn si connexion réussie (perso ou org)
      if (li === "connected" || li === "org_connected") {
        fetch("/api/linkedin/me").then((r) => r.json()).then((d) => {
          setLinkedin(d);
          if (d.orgConnected) {
            fetch("/api/linkedin/organizations").then((r) => r.json()).then((o) => setOrgs(o.organizations ?? [])).catch(() => {});
          }
        }).catch(() => {});
      }
      window.history.replaceState({}, "", "/app");
    }
    const ig = params.get("instagram");
    const IG_MESSAGES = {
      connected: "Instagram connecté ✓",
      refused: "Vous avez refusé l'autorisation Instagram",
      state_mismatch: "Session OAuth expirée — réessayez la connexion",
      not_logged_in: "Connectez-vous d'abord à votre compte LinkeePost",
      error: "Erreur Instagram — " + (params.get("msg") || "consultez le terminal du serveur"),
    };
    if (ig) {
      showToast(IG_MESSAGES[ig] ?? "Connexion Instagram échouée");
      if (ig === "connected") {
        fetch("/api/instagram/me").then((r) => r.json()).then((d) => setInstagram(d.account || false)).catch(() => {});
      }
      window.history.replaceState({}, "", "/app");
    }
  }, [user]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setDrafts([]);
    setLinkedin({ connected: false, name: "", orgConnected: false });
    setInstagram(false);
  };

  const disconnectInstagram = async () => {
    await fetch("/api/instagram/logout", { method: "POST" });
    setInstagram(false);
    showToast("Instagram déconnecté");
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setSeriesResult(null);
    setVariants(null);
    setHistory([]);
    setNextStep(null);
    setEditingResult(false);
    setPostImage(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          mode: genMode,
          count: seriesCount,
          variants: genMode === "single" && wantVariants ? 3 : undefined,
          inspiration: genMode === "single" ? inspiration : undefined,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur inconnue");
      if (data.posts) {
        setSeriesResult(data.posts);
      } else if (data.variants) {
        setVariants(data.variants);
        setActiveVariant(0);
        setResult(data.variants[0]);
      } else {
        setResult(data);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const undoResult = () => {
    if (!history.length) return;
    setResult(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setEditingResult(false);
  };

  // Enregistre toute la série (et la programme si demandé)
  const saveSeries = async (schedule) => {
    if (!seriesResult) return;
    setSavingSeries(true);
    try {
      const created = [];
      for (let i = 0; i < seriesResult.length; i++) {
        const p = seriesResult[i];
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "simple",
            theme: p.title || `${form.theme} — ${i + 1}/${seriesResult.length}`,
            expertise: form.expertise,
            tone: form.tone,
            maxChars: form.maxChars,
            text: p.text,
          }),
        });
        const data = await readJson(res);
        if (!res.ok) throw new Error(data.error);
        created.push(data.draft);
      }
      if (schedule) {
        const start = new Date(seriesStart);
        if (isNaN(start) || start <= new Date()) throw new Error("La date de début doit être dans le futur.");
        // Rythme du profil (jours/heure préférés) ou intervalle fixe
        const useRhythm = seriesUseRhythm && profile?.publishDays;
        const slots = useRhythm
          ? nextPreferredSlots(profile, created.length, new Date(start.getTime() - 60000))
          : null;
        // Validation avant publication si activée dans le profil
        const status = profile?.requireValidation ? "à valider" : "programmé";
        for (let i = 0; i < created.length; i++) {
          const when = slots ? slots[i] : new Date(start.getTime() + i * seriesInterval * 86400000);
          const res = await fetch(`/api/drafts/${created[i].id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, scheduledAt: when.toISOString(), target }),
          });
          const d2 = await readJson(res);
          if (!res.ok) throw new Error(d2.error);
          created[i] = { ...created[i], status, scheduledAt: when.toISOString(), target };
        }
      }
      setDrafts((d) => [...created.slice().reverse(), ...d]);
      showToast(
        schedule
          ? profile?.requireValidation
            ? `Série planifiée : ${created.length} posts en attente de votre validation`
            : `Série programmée : ${created.length} posts ✓`
          : `${created.length} brouillons enregistrés ✓`
      );
      setSeriesResult(null);
      setView(schedule ? "dashboard" : "history");
    } catch (e) {
      showToast(e.message);
    } finally {
      setSavingSeries(false);
    }
  };

  // Retouche IA du post généré (« plus court », consigne libre…)
  const handleRefine = async (instruction) => {
    if (!result || loading || !instruction.trim()) return;
    setLoading(true);
    setError(null);
    setEditingResult(false);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, refine: { text: result.text, instruction } }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur inconnue");
      setHistory((h) => [...h, result]); // version précédente récupérable
      setResult(data);
      setRefineInput("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveDraft = async ({ silent } = {}) => {
    if (!result) return null;
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          text: result.text,
          extra: result.extra,
          inspirationUrl: inspiration?.link ?? null,
          imageUrl: postImage?.url ?? null,
          imagePrompt: postImage?.prompt ?? null,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error);
      setDrafts((d) => [data.draft, ...d]);
      if (!silent) showToast("Brouillon enregistré ✓");
      return data.draft;
    } catch (e) {
      showToast(e.message || "Erreur d'enregistrement");
      return null;
    }
  };

  const clearResultArea = () => {
    setResult(null);
    setVariants(null);
    setHistory([]);
    setEditingResult(false);
    setPostImage(null);
    setImagePromptInput("");
  };

  // Génère l'image du post (prompt manuel ou rédigé par l'IA)
  const generateImage = async () => {
    if (!result || imageLoading) return;
    setImageLoading(true);
    try {
      const res = await fetch("/api/image/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: result.text, prompt: imagePromptInput }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur");
      setPostImage(data);
      setImagePromptInput("");
      showToast("Image générée ✓");
    } catch (e) {
      showToast(e.message);
    } finally {
      setImageLoading(false);
    }
  };

  // Wizard : Brouillon → propose programmer/publier ensuite
  const saveDraftFlow = async () => {
    const d = await saveDraft({ silent: true });
    if (!d) return;
    clearResultArea();
    setNextStep({ type: "saved", draft: d });
    showToast("Brouillon enregistré ✓");
  };

  // Wizard : Programmer (sauvegarde puis ouvre la modal de date)
  const scheduleNow = async () => {
    const d = await saveDraft({ silent: true });
    if (!d) return;
    clearResultArea();
    setScheduleFromCreate(true);
    setScheduleStatus("programmé");
    setScheduleDraft(d);
  };

  // Wizard : Publier immédiatement
  const publishNow = async () => {
    const d = await saveDraft({ silent: true });
    if (!d) return;
    const r = await publish(d);
    if (r) {
      clearResultArea();
      setNextStep({ type: "published", postId: typeof r === "string" ? r : null });
    }
  };

  // Glisser-déposer kanban : changement de statut selon la colonne cible
  const handleKanbanDrop = async (colId, draftId) => {
    const p = drafts.find((d) => d.id === draftId);
    if (!p || p.status === colId) return;
    if (p.status === "publié") {
      showToast("Un post publié ne peut plus changer de statut");
      return;
    }
    try {
      if (colId === "brouillon") {
        await patchDraft(p.id, { status: "brouillon", scheduledAt: null });
        setDrafts((d) =>
          d.map((x) =>
            x.id === p.id ? { ...x, status: "brouillon", scheduledAt: null, publishError: null } : x
          )
        );
        showToast("Repassé en brouillon");
      } else if (colId === "programmé") {
        if (p.status === "à valider" && p.scheduledAt) {
          // Glisser vers Programmés = valider (l'échéance existe déjà)
          await patchDraft(p.id, { status: "programmé" });
          setDrafts((d) => d.map((x) => (x.id === p.id ? { ...x, status: "programmé" } : x)));
          showToast("Post validé — il partira à l'heure prévue ✓");
        } else {
          setScheduleStatus("programmé");
          setScheduleDraft(p);
        }
      } else if (colId === "à valider") {
        if (p.status === "programmé" && p.scheduledAt) {
          // Re-soumettre à validation (l'échéance est conservée)
          await patchDraft(p.id, { status: "à valider" });
          setDrafts((d) => d.map((x) => (x.id === p.id ? { ...x, status: "à valider" } : x)));
          showToast("Post remis en attente de validation");
        } else {
          setScheduleStatus("à valider");
          setScheduleDraft(p);
        }
      } else if (colId === "publié") {
        if (window.confirm("Publier ce post sur LinkedIn maintenant ?")) {
          await publish(p);
        }
      }
      // colId === "erreur" : on ne dépose pas volontairement en erreur
    } catch (e) {
      showToast(e.message);
    }
  };

  // Publier un brouillon depuis le panneau "Et maintenant ?"
  const publishFromNextStep = async () => {
    if (!nextStep?.draft) return;
    const r = await publish(nextStep.draft);
    if (r) setNextStep({ type: "published", postId: typeof r === "string" ? r : null });
  };

  const patchDraft = async (id, patch) => {
    const res = await fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error((await readJson(res)).error || "Erreur");
  };

  const deleteDraft = async (id) => {
    setDrafts((d) => d.filter((x) => x.id !== id));
    fetch(`/api/drafts/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const publish = async (p) => {
    if (!linkedin.connected) {
      showToast("Connectez d'abord votre compte LinkedIn");
      return false;
    }
    setPublishingId(p.id);
    try {
      const res = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: p.text, author: target, imageUrl: p.imageUrl ?? null }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error || "Erreur de publication");
      await patchDraft(p.id, { status: "publié", postId: data.postId });
      setDrafts((d) => d.map((x) => (x.id === p.id ? { ...x, status: "publié", postId: data.postId } : x)));
      showToast("Post publié sur LinkedIn 🎉");
      return data.postId ?? true;
    } catch (e) {
      showToast(e.message);
      return false;
    } finally {
      setPublishingId(null);
    }
  };

  const disconnect = async () => {
    await fetch("/api/linkedin/logout", { method: "POST" });
    setLinkedin({ connected: false, name: "", orgConnected: false });
    setOrgs([]);
    setTarget("person");
  };

  const startEdit = (p) => {
    setEditingId(p.id);
    setEditText(p.text);
  };

  const saveEdit = async () => {
    try {
      await patchDraft(editingId, { text: editText });
      setDrafts((d) => d.map((p) => (p.id === editingId ? { ...p, text: editText } : p)));
      setEditingId(null);
      showToast("Modifications enregistrées ✓");
    } catch (e) {
      showToast(e.message);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <RefreshCw size={24} className="animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthScreen onAuth={setUser} />;

  // Essai terminé sans abonnement actif → blocage (paywall), avant même l'onboarding.
  // Bloque uniquement si le paiement est configuré (sinon déploiement non bloquant). Admins exemptés.
  if (user.billingEnabled && !user.isAdmin && accessState(user) === "expired") {
    return <PaywallScreen user={user} showToast={showToast} onLogout={logout} />;
  }

  // Première connexion : configuration du profil en étapes
  // (on attend aussi le statut LinkedIn pour que le wizard reprenne à la bonne étape)
  if (!profileLoaded || !linkedinLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <RefreshCw size={24} className="animate-spin" />
      </div>
    );
  }
  if (!profile?.onboardedAt) {
    return (
      <OnboardingWizard
        user={user}
        profile={profile}
        linkedinConnected={linkedin.connected}
        showToast={showToast}
        onDone={(p) => {
          setProfile(p);
          setForm((f) => ({
            ...f,
            expertise: p.expertise || f.expertise,
            tone: p.tone || f.tone,
            maxChars: p.defaultMaxChars || f.maxChars,
          }));
        }}
      />
    );
  }

  const plan = planOf(user);
  const canImages = plan.imagesPerMonth !== 0; // Essentiel = 0 → pas d'images
  const canScore = planAllows(user, "scoring"); // score d'engagement : Pro/Agence
  // Compteur de posts du mois (limite null = illimité)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const postsThisMonth = drafts.filter((d) => new Date(d.createdAt) >= monthStart).length;
  const postsLimit = plan.postsPerMonth;
  const postsReached = postsLimit != null && postsThisMonth >= postsLimit;
  const NAV = [
    { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { id: "create", label: "Créer un post", icon: Sparkles },
    { id: "new-campaign", label: "Créer une campagne", icon: Megaphone, requires: "campaigns", featureLabel: "L'outil de campagne" },
    { id: "history", label: "Mes posts", icon: History, badge: drafts.length || null },
    { id: "campaigns", label: "Campagnes", icon: LayersIcon, requires: "campaigns", featureLabel: "Les campagnes" },
    { id: "events", label: "Événements", icon: MapPin, requires: "events", featureLabel: "Le module Événements" },
    { id: "stats", label: "Statistiques", icon: BarChart3 },
    { id: "billing", label: "Abonnement", icon: CreditCard },
    { id: "profile", label: "Profil", icon: UserRound },
    ...(user.plan === "agence"
      ? [{ id: "clients", label: "Mes clients", icon: Users }]
      : []),
    ...(user.isAdmin
      ? [
          { id: "admin", label: "Administration", icon: ShieldCheck },
          { id: "content", label: "Contenu du site", icon: PenLine },
          { id: "messages", label: "Messages", icon: MessageSquare },
        ]
      : []),
  ];
  const VIEW_TITLES = {
    dashboard: "Tableau de bord",
    create: "Créer un post",
    history: "Mes posts",
    campaigns: "Campagnes",
    events: "Événements",
    stats: "Statistiques",
    billing: "Abonnement",
    profile: "Mon profil",
    clients: "Mes clients",
    admin: "Administration",
    content: "Contenu du site",
    messages: "Messages de contact",
  };
  const handleNav = (item) => {
    if (item.id === "new-campaign") {
      setCampaignWizardOpen(true);
      setView("campaigns");
    } else {
      setView(item.id);
    }
  };
  const isLocked = (item) => item.requires && !planAllows(user, item.requires);
  const onNav = (item) =>
    isLocked(item) ? setUpgrade({ feature: item.featureLabel, requires: item.requires }) : handleNav(item);

  const navBtn = (item) => {
    const locked = isLocked(item);
    return (
      <button
        key={item.id}
        onClick={() => onNav(item)}
        title={locked ? `${item.featureLabel} — réservé à une offre supérieure` : undefined}
        className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
          view === item.id
            ? "bg-[#ff5a5f] text-white shadow-md shadow-[#ffd5d6]"
            : locked
            ? "text-gray-300 hover:bg-gray-50"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
        }`}
      >
        <item.icon size={17} />
        <span className="flex-1 text-left">{item.label}</span>
        {locked ? (
          <Lock size={14} className="text-gray-300" />
        ) : item.badge ? (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full ${
              view === item.id ? "bg-white/20 text-white" : "bg-[#fff1f1] text-[#ff5a5f]"
            }`}
          >
            {item.badge}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Tutoriel de première connexion */}
      {showTutorial && <TutorialOverlay canEvents={planAllows(user, "events")} onClose={closeTutorial} />}

      {/* Bouton d'aide : revoir le tutoriel */}
      <button
        onClick={() => setShowTutorial(true)}
        title="Revoir le tutoriel"
        aria-label="Revoir le tutoriel"
        className="fixed bottom-5 left-5 z-40 w-11 h-11 rounded-full bg-white border border-gray-200 shadow-lg text-[#ff5a5f] hover:bg-[#fff1f1] font-extrabold text-lg flex items-center justify-center"
      >
        ?
      </button>

      {/* Étape 2 — page plein écran d'optimisation */}
      {optimizeText && (
        <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-3">
            <button
              onClick={() => setOptimizeText(null)}
              className="flex items-center gap-1.5 text-sm font-medium text-[#1b2a4a] hover:text-[#ff5a5f]"
            >
              <ChevronLeft size={18} /> Fermer
            </button>
          </div>
          <div className="max-w-6xl mx-auto p-6 grid lg:grid-cols-2 gap-6 items-start">
            {/* Gauche : aperçu du post + actions (collés au scroll) */}
            <div className="lg:sticky lg:top-20 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-400">Votre post (modifiable)</p>
                  <button
                    onClick={saveOptimize}
                    className="text-xs font-semibold text-[#ff5a5f] hover:underline flex items-center gap-1"
                  >
                    <Check size={13} /> {optimizeText.draftId ? "Enregistrer le brouillon" : "Appliquer"}
                  </button>
                </div>
                <textarea
                  value={optimizeText.text}
                  onChange={(e) => editOptimizeText(e.target.value)}
                  rows={12}
                  className="w-full text-sm leading-relaxed border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#ff5a5f] resize-y"
                />
              </div>
              {/* Niveau de réécriture (comme le choix du format) — réservé Pro/Agence */}
              {canScore && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Niveau de réécriture</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "all", label: "Tout le post" },
                      { id: "hook", label: "Accroche" },
                      { id: "body", label: "Corps" },
                      { id: "signature", label: "Signature" },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setRewriteScope(s.id)}
                        className={`text-sm font-medium px-3 py-2 rounded-xl border transition-colors ${
                          rewriteScope === s.id
                            ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                            : "bg-white text-[#1b2a4a] border-gray-200 hover:border-[#ffd5d6]"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                {canScore && (
                  <button
                    onClick={rewriteOptimized}
                    disabled={rewriting}
                    className="flex-1 bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-semibold px-5 py-3 rounded-full flex items-center justify-center gap-2"
                  >
                    {rewriting ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {rewriting ? "Réécriture…" : "Réécrire avec ces conseils"}
                  </button>
                )}
                <button
                  onClick={() => setOptimizeText(null)}
                  className="flex-1 border-2 border-[#ffd5d6] hover:border-[#ff5a5f] text-[#1b2a4a] font-semibold px-5 py-3 rounded-full"
                >
                  Fermer
                </button>
              </div>

              {/* Historique des versions */}
              {versions.length > 1 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
                    <History size={13} /> Historique des versions
                  </p>
                  <div className="space-y-1.5">
                    {versions.map((v, i) => {
                      const current = v.text === optimizeText.text;
                      return (
                        <div
                          key={v.id}
                          className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${current ? "bg-[#fff1f1]" : "hover:bg-gray-50"}`}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">V{i + 1} · {v.label}</p>
                            <p className="text-[11px] text-gray-400">Score {v.score}/100</p>
                          </div>
                          {current ? (
                            <span className="text-[11px] font-semibold text-[#ff5a5f] shrink-0">Affichée</span>
                          ) : (
                            <button
                              onClick={() => restoreVersion(v)}
                              className="text-xs font-semibold text-[#ff5a5f] hover:underline shrink-0"
                            >
                              Restaurer
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            {/* Droite : module d'optimisation (réservé Pro/Agence) */}
            {canScore ? (
              <ScorePanel text={optimizeText.text} type={optimizeText.type} recomputing={rewriting} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] flex items-center justify-center mx-auto mb-4">
                  <Lock size={26} />
                </div>
                <h3 className="font-extrabold text-lg">Score & optimisation d'engagement</h3>
                <p className="text-sm text-gray-500 mt-2 max-w-sm mx-auto">
                  Notez le potentiel de chaque post sur 100, recevez des conseils par l'IA et réécrivez l'accroche, le corps ou la signature en un clic.
                  Cette fonctionnalité est incluse à partir de l'offre <strong>Pro</strong>.
                </p>
                <div className="mt-5 flex flex-col items-center gap-2">
                  <a
                    href="/tarifs"
                    className="inline-flex items-center gap-2 bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-6 py-3 rounded-full transition-colors"
                  >
                    <ArrowUpCircle size={17} /> Faire évoluer mon offre
                  </a>
                  <a href="/scoring" className="text-xs font-medium text-[#ff5a5f] hover:underline">
                    En savoir plus sur le score d'engagement
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pop-up : fonctionnalité réservée à une offre supérieure */}
      {upgrade && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-6"
          onClick={() => setUpgrade(null)}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-[#fff1f1] text-[#ff5a5f] flex items-center justify-center mx-auto mb-4">
              <Lock size={26} />
            </div>
            <h3 className="text-lg font-extrabold">{upgrade.feature} n'est pas dans votre offre</h3>
            <p className="text-sm text-gray-500 mt-2">
              Votre offre actuelle : <strong>{plan.name}</strong>. Passez à une offre supérieure pour débloquer cette fonctionnalité.
            </p>
            <button
              onClick={() => { setUpgrade(null); setView("billing"); }}
              className="mt-5 w-full flex items-center justify-center gap-2 bg-[#ff5a5f] hover:bg-[#f63d44] text-white font-semibold px-5 py-3 rounded-full transition-colors"
            >
              <ArrowUpCircle size={17} /> Voir les offres et s'abonner
            </button>
            <button onClick={() => setUpgrade(null)} className="mt-3 text-xs text-gray-400 hover:text-gray-600">
              Plus tard
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-60 bg-white h-screen sticky top-0 hidden md:flex flex-col shrink-0 border-r border-gray-100">
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="bg-[#ff5a5f] text-white p-2 rounded-xl shadow-md shadow-[#ffd5d6]">
            <LpMark size={20} />
          </div>
          <div>
            <p className="font-bold leading-tight">LinkeePost</p>
            <p className="text-xs text-gray-400">Campagnes LinkedIn</p>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1 mt-2">{NAV.map(navBtn)}</nav>
        <div className="px-3 mt-2">
          <div className="rounded-2xl bg-[#fff1f1] p-3">
            <p className="text-[11px] text-gray-500">Votre offre</p>
            <p className="font-bold text-[#ff5a5f] flex items-center gap-1.5">
              <Sparkles size={13} /> {plan.name}
            </p>
            {postsLimit != null && (
              <div className="mt-2">
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-gray-500">Posts ce mois</span>
                  <span className={`font-semibold ${postsReached ? "text-red-600" : "text-[#ff5a5f]"}`}>
                    {postsThisMonth}/{postsLimit}
                  </span>
                </div>
                <div className="h-1.5 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${postsReached ? "bg-red-500" : "bg-[#ff5a5f]"}`}
                    style={{ width: `${Math.min(100, (postsThisMonth / postsLimit) * 100)}%` }}
                  />
                </div>
                {postsReached && <p className="text-[10px] text-red-600 mt-1">Limite mensuelle atteinte.</p>}
              </div>
            )}
            {plan.id !== "agence" && (
              <a
                href="/tarifs"
                className="mt-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-[#ff5a5f] hover:bg-[#f63d44] rounded-full py-1.5 transition-colors"
              >
                <ArrowUpCircle size={14} /> Faire évoluer mon offre
              </a>
            )}
          </div>
        </div>
        <div className="px-3 pb-5 pt-3 border-t border-gray-100 mx-3 mb-1">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-full bg-[#ffe0e0] text-[#f63d44] flex items-center justify-center text-sm font-bold shrink-0">
              {(user.name || user.email).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{user.name || "Mon compte"}</p>
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <button onClick={logout} className="text-gray-400 hover:text-red-600 p-1.5" title="Se déconnecter">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        {/* Navigation mobile */}
        <div className="md:hidden bg-white border-b border-gray-100 px-3 py-2 flex gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const locked = isLocked(item);
            return (
              <button
                key={item.id}
                onClick={() => onNav(item)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex items-center gap-1.5 ${
                  view === item.id ? "bg-[#ff5a5f] text-white" : locked ? "text-gray-300" : "text-gray-500"
                }`}
              >
                <item.icon size={14} /> {item.label}
                {locked && <Lock size={11} />}
              </button>
            );
          })}
          <button onClick={logout} className="text-gray-400 p-1.5 ml-auto">
            <LogOut size={15} />
          </button>
        </div>

        {/* Barre supérieure */}
        <header className="px-6 pt-6 pb-1 flex items-center justify-between flex-wrap gap-3 max-w-5xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">{VIEW_TITLES[view]}</h1>
            <p className="text-xs text-gray-400">Bonjour {user.name || ""} 👋</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
          {linkedin.connected ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {linkedin.name || "Connecté"}
              </span>
              {linkedin.orgConnected ? (
                <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-xs font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  Page entreprise
                </span>
              ) : (
                <a
                  href="/api/linkedin/auth-org"
                  className="border border-[#0a66c2] text-[#0a66c2] hover:bg-[#fff1f1] text-xs font-medium px-3 py-1.5 rounded-full"
                  title="Connecter la page entreprise (2e app LinkedIn, Community Management API)"
                >
                  + Connecter la page
                </a>
              )}
              <button onClick={disconnect} className="text-gray-400 hover:text-red-600 p-1.5" title="Déconnecter LinkedIn">
                <Linkedin size={16} />
              </button>
            </div>
          ) : (
            <a
              href="/api/linkedin/auth"
              className="bg-[#0a66c2] hover:bg-[#004182] text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <Linkedin size={16} /> Connecter LinkedIn
            </a>
          )}
          </div>
        </header>

      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {toast}
        </div>
      )}

      {scheduleDraft && (
        <ScheduleModal
          draft={scheduleDraft}
          linkedin={linkedin}
          orgs={orgs}
          profile={profile}
          statusAfter={scheduleStatus}
          showToast={showToast}
          onClose={() => {
            setScheduleDraft(null);
            // Wizard : programmation annulée depuis la création → le post reste en brouillon
            if (scheduleFromCreate) {
              setScheduleFromCreate(false);
              setNextStep((n) => n ?? { type: "saved", draft: scheduleDraft });
            }
          }}
          onScheduled={(patch) => {
            setDrafts((d) => d.map((x) => (x.id === scheduleDraft.id ? { ...x, ...patch } : x)));
            if (scheduleFromCreate) {
              setScheduleFromCreate(false);
              setNextStep({ type: "scheduled", when: patch.scheduledAt });
            }
          }}
        />
      )}

      {/* Bandeau d'essai / incident de paiement (seulement si le paiement est actif) */}
      {user.billingEnabled && (() => {
        const st = accessState(user);
        const left = trialDaysLeft(user);
        if (st === "past_due") {
          return (
            <div className="max-w-5xl mx-auto px-6 mt-3">
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2"><AlertCircle size={16} /> Votre dernier paiement a échoué. Mettez à jour votre moyen de paiement pour ne pas perdre l'accès.</span>
                <button onClick={() => setView("billing")} className="font-semibold underline shrink-0">Régulariser</button>
              </div>
            </div>
          );
        }
        if (st === "trial" && left != null && left <= 5) {
          return (
            <div className="max-w-5xl mx-auto px-6 mt-3">
              <div className="bg-[#fff1f1] border border-[#ffd5d6] text-[#1b2a4a] rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
                <span className="flex items-center gap-2"><Clock size={16} className="text-[#ff5a5f]" /> Il vous reste {left} jour{left > 1 ? "s" : ""} d'essai gratuit. Abonnez-vous pour ne pas être interrompu.</span>
                <button onClick={() => setView("billing")} className="font-semibold text-[#ff5a5f] underline shrink-0">Choisir une offre</button>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Bandeau mode client (impersonation agence) */}
      {impersonating && (
        <div className="max-w-5xl mx-auto px-6 mt-3">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap">
            <span className="flex items-center gap-2 font-medium">
              <Users size={15} />
              Mode client — <span className="font-semibold">{impersonating.companyName || impersonating.name}</span>
            </span>
            <button
              onClick={async () => {
                await fetch("/api/agency/impersonate", { method: "DELETE" });
                setImpersonating(null);
                setView("clients");
                // Recharger les données pour revenir sur le compte agence
                window.location.reload();
              }}
              className="text-xs font-semibold underline hover:no-underline"
            >
              ← Revenir à mon compte
            </button>
          </div>
        </div>
      )}

      {view === "dashboard" ? (
        <DashboardView
          drafts={drafts}
          canVeille={planAllows(user, "veille")}
          canEvents={planAllows(user, "events")}
          canScore={canScore}
          canCampaigns={plan.campaigns}
          postsLimit={plan.postsPerMonth}
          profile={profile}
          linkedin={linkedin}
          orgs={orgs}
          showToast={showToast}
          onProfileSaved={setProfile}
          onPlanned={() =>
            fetch("/api/drafts")
              .then((r) => r.json())
              .then((d) => setDrafts(d.drafts ?? []))
              .catch(() => {})
          }
          onInspire={(item) => {
            setForm((f) => ({ ...f, theme: item.title.slice(0, 120) }));
            setInspiration(item);
            setGenMode("single");
            setView("create");
            showToast("Article chargé comme inspiration ✓");
          }}
          onGoCreate={() => setView("create")}
          onGoHistory={() => setView("history")}
          onGoEvents={() => setView("events")}
          onGoProfile={() => setView("profile")}
          onApprove={async (d) => {
            try {
              await patchDraft(d.id, { status: "programmé" });
              setDrafts((x) => x.map((p) => (p.id === d.id ? { ...p, status: "programmé" } : p)));
              showToast("Post validé — il partira à l'heure prévue ✓");
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      ) : view === "create" ? (
        <main className="max-w-6xl mx-auto p-6 grid md:grid-cols-2 gap-6">
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5 h-fit">
            <h2 className="font-semibold text-base">Paramètres du post</h2>

            {/* Mode : post unique ou série graduée */}
            <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setGenMode("single")}
                className={`py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 ${
                  genMode === "single" ? "bg-white shadow-sm" : "text-gray-500"
                }`}
              >
                <FileText size={14} /> Post unique
              </button>
              <button
                onClick={() => setGenMode("series")}
                className={`py-2 rounded-md text-sm font-medium flex items-center justify-center gap-1.5 ${
                  genMode === "series" ? "bg-white shadow-sm" : "text-gray-500"
                }`}
              >
                <LayersIcon size={14} /> Série avec reveal
              </button>
            </div>

            {genMode === "series" && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Nombre de posts : <span className="text-[#ff5a5f] font-semibold">{seriesCount}</span>
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  value={seriesCount}
                  onChange={(e) => setSeriesCount(Number(e.target.value))}
                  className="w-full accent-[#ff5a5f]"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Montée en tension graduée : teaser → indices → reveal au dernier post.
                </p>
              </div>
            )}

            <div className={genMode === "series" ? "hidden" : ""}>
              <label className="text-sm font-medium text-gray-700 block mb-2">Type de post</label>
              <div className="grid grid-cols-3 gap-2">
                {POST_TYPES.map(({ id, label, icon: Icon, desc }) => (
                  <button
                    key={id}
                    onClick={() => set("type", id)}
                    className={`p-3 rounded-lg border text-left ${
                      form.type === id
                        ? "border-[#ff5a5f] bg-[#fff1f1] ring-1 ring-[#ff5a5f]"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Icon size={18} className={form.type === id ? "text-[#ff5a5f]" : "text-gray-400"} />
                    <div className="text-sm font-medium mt-1">{label}</div>
                    <div className="text-xs text-gray-500">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Votre expertise — « Je suis un(e)… »
              </label>
              <input
                type="text"
                value={form.expertise}
                onChange={(e) => set("expertise", e.target.value)}
                placeholder="ex : consultant en marketing digital"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {EXPERTISE_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => set("expertise", s)}
                    className="text-xs bg-gray-100 hover:bg-[#fff1f1] hover:text-[#f63d44] text-gray-600 px-2 py-1 rounded-full"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Thématique</label>
              <input
                type="text"
                value={form.theme}
                onChange={(e) => set("theme", e.target.value)}
                placeholder="ex : La prospection sur LinkedIn"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
              />
              {profile?.themes && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.themes
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                    .map((t) => (
                      <button
                        key={t}
                        onClick={() => set("theme", t)}
                        className="text-xs bg-gray-100 hover:bg-[#fff1f1] hover:text-[#f63d44] text-gray-600 px-2 py-1 rounded-full"
                      >
                        {t}
                      </button>
                    ))}
                </div>
              )}
              {inspiration && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-800 flex items-start justify-between gap-2">
                  <span>
                    💡 Le post rebondira sur : <strong>{inspiration.title}</strong>
                    {inspiration.source && <span className="text-amber-600"> ({inspiration.source})</span>}
                  </span>
                  <button
                    onClick={() => setInspiration(null)}
                    className="text-amber-500 hover:text-amber-800 shrink-0"
                    title="Retirer l'inspiration"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Ton</label>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => set("tone", t)}
                    className={`text-xs px-3 py-1.5 rounded-full border ${
                      form.tone === t
                        ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Longueur max : <span className="text-[#ff5a5f] font-semibold">{form.maxChars} caractères</span>
              </label>
              <input
                type="range"
                min="300"
                max="3000"
                step="100"
                value={form.maxChars}
                onChange={(e) => set("maxChars", Number(e.target.value))}
                className="w-full accent-[#ff5a5f]"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>300</span>
                <span>3000 (max LinkedIn)</span>
              </div>
            </div>

            {genMode === "single" && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantVariants}
                  onChange={(e) => setWantVariants(e.target.checked)}
                  className="accent-[#ff5a5f]"
                />
                Générer 3 variantes (angles différents) au choix
              </label>
            )}

            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="w-full bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {loading
                ? "Génération en cours…"
                : genMode === "series"
                ? `Générer la série (${seriesCount} posts)`
                : "Générer avec l'IA"}
            </button>
            {!canGenerate && (
              <p className="text-xs text-gray-400 text-center">
                Renseignez votre expertise et la thématique pour générer.
              </p>
            )}
          </section>

          <section className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
            {!result && !seriesResult && !loading && !error && !nextStep && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
                <Sparkles size={32} className="mx-auto mb-3" />
                <p className="text-sm">
                  {genMode === "series" ? "Votre série de posts apparaîtra ici" : "Votre post généré apparaîtra ici"}
                </p>
              </div>
            )}
            {loading && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-gray-400">
                <RefreshCw size={32} className="mx-auto mb-3 animate-spin text-[#ff5a5f]" />
                <p className="text-sm">
                  {genMode === "series"
                    ? `Claude construit votre série de ${seriesCount} posts…`
                    : "Claude rédige votre post…"}
                </p>
              </div>
            )}
            {/* Barre d'actions — en haut à droite dès la génération */}
            {result && (
              <div className="sticky top-4 z-20 bg-white/95 backdrop-blur rounded-xl border border-[#ffd5d6] ring-1 ring-[#ffe0e0] shadow-md p-3 flex items-center justify-between flex-wrap gap-2">
                <span className="text-sm font-medium text-green-700 flex items-center gap-1.5">
                  <Check size={15} /> Post prêt
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {linkedin.connected && linkedin.orgConnected && orgs.length > 0 && (
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                      title="Compte de publication"
                    >
                      <option value="person">Profil perso</option>
                      {orgs.map((o) => (
                        <option key={o.urn} value={o.urn}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => {
                      setResultDraftText(result.text);
                      setEditingResult(true);
                    }}
                    disabled={editingResult}
                    className="border border-gray-300 hover:border-[#ff5a5f] hover:text-[#ff5a5f] disabled:opacity-50 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <PenLine size={13} /> Modifier
                  </button>
                  <button
                    onClick={saveDraftFlow}
                    className="border border-gray-300 hover:border-[#ff5a5f] hover:text-[#ff5a5f] text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Save size={13} /> Brouillon
                  </button>
                  <button
                    onClick={scheduleNow}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    <Clock size={13} /> Programmer
                  </button>
                  <button
                    onClick={publishNow}
                    disabled={publishingId !== null || !linkedin.connected}
                    title={!linkedin.connected ? "Connectez d'abord votre compte LinkedIn" : undefined}
                    className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    {publishingId !== null ? (
                      <RefreshCw size={13} className="animate-spin" />
                    ) : (
                      <Send size={13} />
                    )}
                    Publier
                  </button>
                  {instagram && postImage && (
                    <button
                      onClick={async () => {
                        const d = await saveDraft({ silent: true });
                        if (!d) return;
                        try {
                          const res = await fetch("/api/instagram/publish", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ draftId: d.id }),
                          });
                          const data = await readJson(res);
                          if (!res.ok) throw new Error(data.error || "Erreur Instagram");
                          setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, igPostId: data.igPostId, igStatus: "published" } : x));
                          showToast("Publié sur Instagram ✓");
                        } catch (e) {
                          showToast("Instagram : " + e.message);
                        }
                      }}
                      className="bg-gradient-to-r from-pink-500 to-orange-400 hover:from-pink-600 hover:to-orange-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                      title="Publier ce post (avec son image) sur Instagram"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                      Instagram
                    </button>
                  )}
                </div>
              </div>
            )}

            {result && variants && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {variants.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (i === activeVariant) return;
                      setActiveVariant(i);
                      setResult(variants[i]);
                      setHistory([]);
                      setEditingResult(false);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border font-medium ${
                      i === activeVariant
                        ? "bg-[#ff5a5f] text-white border-[#ff5a5f]"
                        : "border-gray-300 text-gray-600 hover:border-[#ff8a8d]"
                    }`}
                  >
                    Variante {i + 1}
                  </button>
                ))}
              </div>
            )}

            {result && (
              <>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`text-xs font-medium uppercase tracking-wide ${
                        (editingResult ? resultDraftText : result.text).length > 3000
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      Aperçu · {(editingResult ? resultDraftText : result.text).length} / 3000 caractères
                    </span>
                    <div className="flex gap-2">
                      {history.length > 0 && (
                        <button
                          onClick={undoResult}
                          className="text-amber-600 hover:text-amber-800 p-1.5 rounded hover:bg-amber-50 flex items-center gap-1 text-xs font-medium"
                          title="Revenir à la version précédente"
                        >
                          <Undo2 size={16} /> v-{history.length}
                        </button>
                      )}
                      <button
                        onClick={() => handleCopy(result.text)}
                        className="text-gray-500 hover:text-[#ff5a5f] p-1.5 rounded hover:bg-gray-100"
                        title="Copier"
                      >
                        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                      </button>
                      <button
                        onClick={handleGenerate}
                        className="text-gray-500 hover:text-[#ff5a5f] p-1.5 rounded hover:bg-gray-100"
                        title="Tout régénérer"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                  </div>

                  {editingResult ? (
                    <div className="space-y-2">
                      <textarea
                        value={resultDraftText}
                        onChange={(e) => setResultDraftText(e.target.value)}
                        rows={12}
                        autoFocus
                        className="w-full border border-gray-300 rounded-lg p-3 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setHistory((h) => [...h, result]);
                            setResult((r) => ({ ...r, text: resultDraftText }));
                            setEditingResult(false);
                          }}
                          className="bg-[#ff5a5f] text-white text-sm px-4 py-1.5 rounded-lg flex items-center gap-1.5"
                        >
                          <Check size={14} /> Valider
                        </button>
                        <button
                          onClick={() => setEditingResult(false)}
                          className="text-gray-500 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-100 flex items-center gap-1.5"
                        >
                          <X size={14} /> Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{result.text}</pre>
                  )}

                </div>

                {!editingResult && result?.text && canScore && (
                  <button
                    onClick={() => openOptimize(result.text, form?.type)}
                    className="w-full flex items-center justify-between gap-2 bg-[#fff1f1] hover:bg-[#ffe0e0] text-[#1b2a4a] rounded-2xl px-5 py-4 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 text-left">
                      <span className="bg-[#ff5a5f] text-white p-2 rounded-xl shrink-0">
                        <BarChart3 size={18} />
                      </span>
                      <span>
                        <span className="block font-bold text-sm">Voir et optimiser le potentiel d'engagement</span>
                        <span className="block text-xs text-[#5a6b85]">Étape 2 — score détaillé + conseils pour améliorer votre post</span>
                      </span>
                    </span>
                    <ChevronRight size={20} className="text-[#ff5a5f] shrink-0" />
                  </button>
                )}
                {!editingResult && result?.text && !canScore && (
                  <button
                    onClick={() => setUpgrade({ feature: "Le score d'engagement" })}
                    className="w-full flex items-center justify-between gap-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-2xl px-5 py-4 transition-colors"
                  >
                    <span className="flex items-center gap-2.5 text-left">
                      <span className="bg-gray-200 text-gray-400 p-2 rounded-xl shrink-0">
                        <BarChart3 size={18} />
                      </span>
                      <span>
                        <span className="block font-bold text-sm flex items-center gap-1.5">
                          Score & optimisation d'engagement <Lock size={13} />
                        </span>
                        <span className="block text-xs text-gray-400">Inclus à partir de l'offre Pro — cliquez pour découvrir</span>
                      </span>
                    </span>
                    <ArrowUpCircle size={20} className="text-[#ff5a5f] shrink-0" />
                  </button>
                )}

                {/* Image du post */}
                {!editingResult && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <ImageIcon size={15} className="text-[#ff5a5f]" /> Image du post
                      <span className="text-xs text-gray-400 font-normal">(optionnelle — publiée avec le post)</span>
                    </p>
                    {!canImages ? (
                      <div className="rounded-xl bg-[#fff1f1] p-4 text-center">
                        <Lock size={20} className="text-[#ff5a5f] mx-auto mb-1.5" />
                        <p className="text-sm font-medium">Les images générées par IA sont incluses à partir de l'offre Pro.</p>
                        <a href="/tarifs" className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[#ff5a5f] hover:underline">
                          <ArrowUpCircle size={13} /> Faire évoluer mon offre
                        </a>
                      </div>
                    ) : postImage ? (
                      <>
                        <img
                          src={postImage.url}
                          alt="Image générée pour le post"
                          className="rounded-xl w-full mb-2"
                        />
                        <p className="text-xs text-gray-400 mb-3 line-clamp-2" title={postImage.prompt}>
                          Prompt : {postImage.prompt}
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={imagePromptInput}
                            onChange={(e) => setImagePromptInput(e.target.value)}
                            placeholder="Ajustement ou nouveau prompt — vide = l'IA redécide"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                          />
                          <button
                            onClick={generateImage}
                            disabled={imageLoading}
                            className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                          >
                            {imageLoading ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            Régénérer
                          </button>
                          <button
                            onClick={() => setPostImage(null)}
                            className="border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-600 text-xs px-3 py-1.5 rounded-lg"
                          >
                            Retirer
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={imagePromptInput}
                          onChange={(e) => setImagePromptInput(e.target.value)}
                          placeholder="Décrivez l'image souhaitée — vide = l'IA la déduit du post"
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                        />
                        <button
                          onClick={generateImage}
                          disabled={imageLoading}
                          className="bg-[#ff5a5f] hover:bg-[#f63d44] disabled:bg-gray-300 text-white text-xs font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
                        >
                          {imageLoading ? <RefreshCw size={13} className="animate-spin" /> : <ImageIcon size={13} />}
                          {imageLoading ? "Génération… (~30 s)" : "Générer une image"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {result.extra && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      {form.type === "carrousel" ? <Layers size={16} /> : <Video size={16} />}
                      {result.extra.title}
                    </h3>
                    <ul className="space-y-2">
                      {result.extra.items?.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <ChevronRight size={14} className="text-[#ff5a5f] mt-0.5 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Retouches rapides par IA — sticky en bas pendant le scroll */}
                {!editingResult && (
                  <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur rounded-2xl border border-gray-100 shadow-sm shadow-md p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1.5">
                      <Sparkles size={12} /> Retoucher avec l'IA
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {["Plus court", "Plus percutant", "Moins formel", "Ajoute une anecdote"].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleRefine(s)}
                          disabled={loading}
                          className="text-xs bg-gray-100 hover:bg-[#fff1f1] hover:text-[#f63d44] disabled:opacity-50 text-gray-600 px-2.5 py-1 rounded-full"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRefine(refineInput);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={refineInput}
                        onChange={(e) => setRefineInput(e.target.value)}
                        placeholder="Consigne libre : « insiste sur le ROI », « termine par une question »…"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                      />
                      <button
                        type="submit"
                        disabled={loading || !refineInput.trim()}
                        className="bg-gray-900 hover:bg-gray-700 disabled:bg-gray-300 text-white text-xs px-3 py-1.5 rounded-lg"
                      >
                        Appliquer
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}

            {/* Wizard : étape suivante après une action */}
            {nextStep && !result && !seriesResult && !loading && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                <p className="text-sm font-semibold text-green-800 flex items-center gap-2">
                  <Check size={16} />
                  {nextStep.type === "saved" && "Brouillon enregistré"}
                  {nextStep.type === "scheduled" &&
                    `Post programmé pour le ${fmtDateTime(nextStep.when)}`}
                  {nextStep.type === "published" && "Post publié sur LinkedIn 🎉"}
                </p>
                <p className="text-xs text-gray-500 mt-1 mb-3">Et maintenant ?</p>
                <div className="flex flex-wrap gap-2">
                  {nextStep.type === "saved" && (
                    <>
                      <button
                        onClick={() => {
                          setScheduleFromCreate(true);
                          setScheduleStatus("programmé");
                          setScheduleDraft(nextStep.draft);
                        }}
                        className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
                      >
                        <Clock size={13} /> Programmer ce post
                      </button>
                      <button
                        onClick={publishFromNextStep}
                        disabled={publishingId !== null || !linkedin.connected}
                        className="bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
                      >
                        {publishingId !== null ? (
                          <RefreshCw size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        Publier maintenant
                      </button>
                      <button
                        onClick={() => setView("history")}
                        className="border border-gray-300 hover:border-[#ff5a5f] text-gray-700 text-xs font-medium px-3 py-2 rounded-lg"
                      >
                        Voir mes posts
                      </button>
                    </>
                  )}
                  {nextStep.type === "scheduled" && (
                    <button
                      onClick={() => setView("dashboard")}
                      className="bg-[#ff5a5f] hover:bg-[#f63d44] text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
                    >
                      <LayoutDashboard size={13} /> Voir le tableau de bord
                    </button>
                  )}
                  {nextStep.type === "published" && nextStep.postId && (
                    <a
                      href={`https://www.linkedin.com/feed/update/${nextStep.postId}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="bg-[#0a66c2] hover:bg-[#004182] text-white text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
                    >
                      <ExternalLink size={13} /> Voir le post sur LinkedIn
                    </a>
                  )}
                  <button
                    onClick={() => {
                      setNextStep(null);
                      set("theme", "");
                    }}
                    className="border border-gray-300 hover:border-[#ff5a5f] text-gray-700 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <Sparkles size={13} /> Créer un nouveau post
                  </button>
                </div>
              </div>
            )}

            {/* Série générée */}
            {seriesResult && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <LayersIcon size={16} className="text-[#ff5a5f]" />
                    Série : {seriesResult.length} posts
                  </h3>
                  <button
                    onClick={handleGenerate}
                    className="text-gray-500 hover:text-[#ff5a5f] p-1.5 rounded hover:bg-gray-100"
                    title="Régénérer la série"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {seriesResult.map((p, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          i === seriesResult.length - 1
                            ? "bg-[#ff5a5f] text-white"
                            : "bg-[#fff1f1] text-[#f63d44]"
                        }`}
                      >
                        {p.title || `Post ${i + 1}`}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{p.text.length} car.</span>
                        <button
                          onClick={() => handleCopy(p.text)}
                          className="text-gray-400 hover:text-[#ff5a5f] p-1 rounded hover:bg-gray-100"
                          title="Copier"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed">{p.text}</pre>
                  </div>
                ))}

                {/* Actions série */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
                  {profile?.publishDays && (
                    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer bg-[#fff1f1] rounded-lg p-2.5">
                      <input
                        type="checkbox"
                        checked={seriesUseRhythm}
                        onChange={(e) => setSeriesUseRhythm(e.target.checked)}
                        className="accent-[#ff5a5f]"
                      />
                      <span>
                        Suivre mon rythme de publication{" "}
                        <span className="text-xs text-gray-500">
                          (
                          {(profile.publishDays ?? "")
                            .split(",")
                            .map((d) => WEEK_DAYS.find((w) => w.n === Number(d))?.label)
                            .filter(Boolean)
                            .join(", ")}{" "}
                          à {profile.publishTime ?? "09:00"})
                        </span>
                      </span>
                    </label>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        {seriesUseRhythm && profile?.publishDays ? "À partir du" : "Premier post le"}
                      </label>
                      <input
                        type="datetime-local"
                        value={seriesStart}
                        onChange={(e) => setSeriesStart(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                      />
                    </div>
                    {!(seriesUseRhythm && profile?.publishDays) && (
                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-1">Fréquence</label>
                        <select
                          value={seriesInterval}
                          onChange={(e) => setSeriesInterval(Number(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                        >
                          <option value={1}>Tous les jours</option>
                          <option value={2}>Tous les 2 jours</option>
                          <option value={3}>Tous les 3 jours</option>
                          <option value={7}>Toutes les semaines</option>
                        </select>
                      </div>
                    )}
                  </div>
                  {profile?.requireValidation && (
                    <p className="text-xs text-purple-700 bg-purple-50 rounded-lg p-2.5">
                      Validation activée : les posts seront planifiés mais attendront votre validation
                      avant publication (modifiable dans Profil).
                    </p>
                  )}
                  {linkedin.connected && orgs.length > 0 && (
                    <label className="flex items-center gap-2 text-xs text-gray-600">
                      Publier en tant que :
                      <select
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className="border border-gray-300 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                      >
                        <option value="person">
                          Profil personnel{linkedin.name ? ` (${linkedin.name})` : ""}
                        </option>
                        {linkedin.orgConnected &&
                          orgs.map((o) => (
                            <option key={o.urn} value={o.urn}>
                              Page : {o.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => saveSeries(null)}
                      disabled={savingSeries}
                      className="border border-gray-300 hover:border-[#ff5a5f] hover:text-[#ff5a5f] disabled:opacity-50 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm"
                    >
                      <Save size={15} /> Tout en brouillons
                    </button>
                    <button
                      onClick={() => saveSeries(true)}
                      disabled={savingSeries}
                      className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm"
                    >
                      {savingSeries ? (
                        <RefreshCw size={15} className="animate-spin" />
                      ) : (
                        <Clock size={15} />
                      )}
                      Programmer la série
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </main>
      ) : view === "campaigns" ? (
        plan.campaigns ? (
          <CampaignsView
            profile={profile}
            linkedin={linkedin}
            orgs={orgs}
            showToast={showToast}
            openWizard={campaignWizardOpen}
            onWizardConsumed={() => setCampaignWizardOpen(false)}
            onPlanned={() =>
              fetch("/api/drafts")
                .then((r) => r.json())
                .then((d) => setDrafts(d.drafts ?? []))
                .catch(() => {})
            }
          />
        ) : (
          <main className="max-w-3xl mx-auto p-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <div className="w-14 h-14 bg-[#fff1f1] rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Megaphone size={28} className="text-[#ff5a5f]" />
              </div>
              <h2 className="font-semibold text-xl mb-2">Campagnes LinkedIn</h2>
              <p className="text-gray-500 text-sm mb-1 max-w-md mx-auto">
                Planifiez des séries de posts cohérentes sur plusieurs semaines, suivez leur performance et laissez l'IA générer votre calendrier éditorial.
              </p>
              <p className="text-gray-400 text-xs mb-6">Disponible à partir du plan <strong>Pro</strong>.</p>
              <a
                href="/tarifs"
                className="inline-flex items-center gap-2 bg-[#ff5a5f] hover:bg-[#d12d33] text-white px-6 py-3 rounded-xl font-medium text-sm transition-colors"
              >
                <ArrowUpCircle size={16} /> Passer au plan Pro
              </a>
            </div>
          </main>
        )
      ) : view === "admin" && user.isAdmin ? (
        <AdminView showToast={showToast} />
      ) : view === "content" && user.isAdmin ? (
        <ContentAdminView showToast={showToast} />
      ) : view === "messages" && user.isAdmin ? (
        <ContactAdminView showToast={showToast} />
      ) : view === "events" ? (
        <EventsView
          profile={profile}
          showToast={showToast}
          onGenerated={() =>
            fetch("/api/drafts")
              .then((r) => r.json())
              .then((d) => setDrafts(d.drafts ?? []))
              .catch(() => {})
          }
        />
      ) : view === "stats" ? (
        <StatsView linkedin={linkedin} orgs={orgs} profile={profile} drafts={drafts} />
      ) : view === "billing" ? (
        <BillingView user={user} showToast={showToast} />
      ) : view === "profile" ? (
        <ProfileView
          key={profile?.email ?? "profile"}
          profile={profile}
          linkedin={linkedin}
          instagram={instagram}
          onDisconnect={disconnect}
          onDisconnectInstagram={disconnectInstagram}
          canOrgPublish={plan.orgPublish}
          showToast={showToast}
          onSaved={(p) => {
            setProfile(p);
            setForm((f) => ({
              ...f,
              expertise: p.expertise || f.expertise,
              tone: p.tone || f.tone,
              maxChars: p.defaultMaxChars || f.maxChars,
            }));
          }}
        />
      ) : view === "clients" ? (
        <ClientsView
          showToast={showToast}
          onManage={async (client) => {
            const res = await fetch("/api/agency/impersonate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientId: client.id }),
            });
            if (res.ok) {
              setImpersonating(client);
              setView("dashboard");
              window.location.reload();
            } else {
              showToast("Erreur lors du changement de compte");
            }
          }}
        />
      ) : (
        <main className="p-6">
          {/* Barre d'options */}
          <div className="flex items-center justify-end mb-4 flex-wrap gap-3">
            {linkedin.connected && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Publier en tant que :
                <select
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                >
                  <option value="person">Profil personnel{linkedin.name ? ` (${linkedin.name})` : ""}</option>
                  {linkedin.orgConnected &&
                    orgs.map((o) => (
                      <option key={o.urn} value={o.urn}>
                        Page : {o.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>

          {drafts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400 max-w-xl mx-auto">
              <History size={32} className="mx-auto mb-3" />
              <p className="text-sm">Aucun post pour l'instant. Générez un post puis enregistrez-le.</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto items-start pb-4">
              {[
                { id: "brouillon", title: "Brouillons", dot: "bg-gray-400" },
                { id: "à valider", title: "À valider", dot: "bg-purple-500" },
                { id: "programmé", title: "Programmés", dot: "bg-amber-400" },
                { id: "publié", title: "Publiés", dot: "bg-green-500" },
                { id: "erreur", title: "Erreurs", dot: "bg-red-500" },
              ]
                .filter((col) => col.id !== "erreur" || drafts.some((d) => d.status === "erreur"))
                .map((col) => {
                  const items = drafts.filter((d) => d.status === col.id);
                  const droppable = col.id !== "erreur";
                  return (
                    <div
                      key={col.id}
                      onDragOver={
                        droppable
                          ? (e) => {
                              e.preventDefault();
                              setDragOverCol(col.id);
                            }
                          : undefined
                      }
                      onDragLeave={droppable ? () => setDragOverCol(null) : undefined}
                      onDrop={
                        droppable
                          ? (e) => {
                              e.preventDefault();
                              setDragOverCol(null);
                              handleKanbanDrop(col.id, e.dataTransfer.getData("text/plain"));
                            }
                          : undefined
                      }
                      className={`w-80 shrink-0 rounded-2xl p-3 transition-colors ${
                        dragOverCol === col.id ? "bg-[#ffe0e0] ring-2 ring-[#ff8a8d]" : "bg-gray-200/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 px-1 mb-3">
                        <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
                        <p className="text-sm font-semibold">{col.title}</p>
                        <span className="text-xs font-medium text-gray-400 bg-white px-2 py-0.5 rounded-full ml-auto">
                          {items.length}
                        </span>
                      </div>
                      <div className="space-y-3 max-h-[68vh] overflow-y-auto pr-1">
                        {items.length === 0 && (
                          <p className="text-xs text-gray-400 text-center py-8">Aucun post</p>
                        )}
                        {items.map((p) => (
                          <div
                            key={p.id}
                            draggable={p.status !== "publié" && editingId !== p.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", p.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow ${
                              p.status !== "publié" && editingId !== p.id ? "cursor-grab active:cursor-grabbing" : ""
                            }`}
                          >
                            {p.imageUrl && (
                              <img
                                src={p.imageUrl}
                                alt=""
                                title={p.imagePrompt ?? ""}
                                className="w-full h-28 object-cover"
                              />
                            )}
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <p className="text-sm font-medium leading-snug line-clamp-2 min-w-0">
                                  {p.theme || "Post"}
                                </p>
                                <div className="flex gap-0.5 shrink-0">
                                  <button
                                    onClick={() => handleCopy(p.text)}
                                    className="text-gray-300 hover:text-[#ff5a5f] p-1"
                                    title="Copier"
                                  >
                                    <Copy size={13} />
                                  </button>
                                  <button
                                    onClick={() => openOptimize(p.text, p.type, p.id)}
                                    className="text-gray-300 hover:text-[#ff5a5f] p-1"
                                    title="Modifier et optimiser"
                                  >
                                    <PenLine size={13} />
                                  </button>
                                  <button
                                    onClick={() => deleteDraft(p.id)}
                                    className="text-gray-300 hover:text-red-600 p-1"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {editingId === p.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={10}
                                    className="w-full border border-gray-200 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#ff5a5f]"
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={saveEdit}
                                      className="flex-1 bg-[#ff5a5f] text-white text-xs px-2 py-1.5 rounded-lg flex items-center justify-center gap-1"
                                    >
                                      <Check size={12} /> Enregistrer
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="text-gray-500 text-xs px-2 py-1.5 rounded-lg hover:bg-gray-100"
                                    >
                                      Annuler
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <pre className="whitespace-pre-wrap text-xs text-gray-600 font-sans leading-relaxed line-clamp-5">
                                  {p.text}
                                </pre>
                              )}

                              <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-400 flex-wrap">
                                <span>{new Date(p.createdAt).toLocaleDateString("fr-FR")}</span>
                                {p.auto && <span className="bg-gray-100 px-1.5 py-0.5 rounded-full">auto</span>}
                                {p.inspirationUrl && (
                                  <a
                                    href={p.inspirationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-600 hover:text-amber-800"
                                    title="Article de veille à l'origine du post"
                                  >
                                    💡 source
                                  </a>
                                )}
                              </div>
                            </div>

                            {/* Pied de carte : actions selon le statut */}
                            {editingId !== p.id && (
                              <div className="px-3 pb-3">
                                {p.status === "brouillon" && (
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => publish(p)}
                                      disabled={publishingId === p.id}
                                      className="flex-1 bg-[#0a66c2] hover:bg-[#004182] disabled:bg-gray-300 text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1"
                                    >
                                      {publishingId === p.id ? (
                                        <RefreshCw size={12} className="animate-spin" />
                                      ) : (
                                        <Send size={12} />
                                      )}
                                      Publier
                                    </button>
                                    <button
                                      onClick={() => {
                                        setScheduleStatus("programmé");
                                        setScheduleDraft(p);
                                      }}
                                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1"
                                    >
                                      <Clock size={12} /> Programmer
                                    </button>
                                  </div>
                                )}
                                {p.status === "à valider" && (
                                  <>
                                    <p className="text-[11px] text-purple-700 mb-1.5 flex items-center gap-1">
                                      <Clock size={11} /> {fmtDateTime(p.scheduledAt)}
                                    </p>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={async () => {
                                          try {
                                            await patchDraft(p.id, { status: "programmé" });
                                            setDrafts((d) =>
                                              d.map((x) => (x.id === p.id ? { ...x, status: "programmé" } : x))
                                            );
                                            showToast("Post validé — il partira à l'heure prévue ✓");
                                          } catch (e) {
                                            showToast(e.message);
                                          }
                                        }}
                                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium py-1.5 rounded-lg flex items-center justify-center gap-1"
                                      >
                                        <Check size={12} /> Valider
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                            await patchDraft(p.id, { status: "brouillon", scheduledAt: null });
                                            setDrafts((d) =>
                                              d.map((x) =>
                                                x.id === p.id ? { ...x, status: "brouillon", scheduledAt: null } : x
                                              )
                                            );
                                          } catch (e) {
                                            showToast(e.message);
                                          }
                                        }}
                                        className="text-xs border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-500 px-2.5 py-1.5 rounded-lg"
                                      >
                                        Annuler
                                      </button>
                                    </div>
                                  </>
                                )}
                                {p.status === "programmé" && (
                                  <>
                                    <p className="text-[11px] text-amber-700 mb-1.5 flex items-center gap-1">
                                      <Clock size={11} /> {relativeTime(p.scheduledAt)} — {fmtDateTime(p.scheduledAt)}
                                    </p>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await patchDraft(p.id, { status: "brouillon", scheduledAt: null });
                                          setDrafts((d) =>
                                            d.map((x) =>
                                              x.id === p.id ? { ...x, status: "brouillon", scheduledAt: null } : x
                                            )
                                          );
                                          showToast("Programmation annulée");
                                        } catch (e) {
                                          showToast(e.message);
                                        }
                                      }}
                                      className="w-full text-xs border border-gray-200 hover:border-red-400 hover:text-red-600 text-gray-500 py-1.5 rounded-lg"
                                    >
                                      Annuler la programmation
                                    </button>
                                  </>
                                )}
                                {p.status === "publié" && (
                                  <div className="flex flex-col gap-1 text-[11px] text-gray-400">
                                    <div className="flex items-center justify-between">
                                      <span>{p.publishedAt ? fmtDateTime(p.publishedAt) : "Publié"}</span>
                                      {p.postId && (
                                        <a
                                          href={`https://www.linkedin.com/feed/update/${p.postId}/`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[#0a66c2] hover:underline flex items-center gap-1"
                                        >
                                          <Linkedin size={11} /> LinkedIn <ExternalLink size={11} />
                                        </a>
                                      )}
                                    </div>
                                    {p.igPostId && (
                                      <div className="flex items-center justify-end gap-1 text-pink-500">
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                                        Publié sur Instagram ✓
                                      </div>
                                    )}
                                  </div>
                                )}
                                {p.status === "erreur" && (
                                  <>
                                    <p className="text-[11px] text-red-600 mb-1.5 line-clamp-2">
                                      {p.publishError || "Erreur de publication"}
                                    </p>
                                    <button
                                      onClick={async () => {
                                        try {
                                          await patchDraft(p.id, { status: "brouillon", scheduledAt: null });
                                          setDrafts((d) =>
                                            d.map((x) =>
                                              x.id === p.id
                                                ? { ...x, status: "brouillon", publishError: null }
                                                : x
                                            )
                                          );
                                        } catch (e) {
                                          showToast(e.message);
                                        }
                                      }}
                                      className="w-full text-xs border border-gray-200 hover:border-[#ff5a5f] text-gray-500 py-1.5 rounded-lg"
                                    >
                                      Repasser en brouillon
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </main>
      )}
      </div>
    </div>
  );
}
