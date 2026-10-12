// Gabarit des e-mails LinkeePost : bandeau de marque (pastille « LP » corail), carte blanche, bouton d'action, pied de page.
// Mise en page en tableaux et styles en ligne : c'est ce que lisent tous les clients de messagerie (Outlook, Gmail, Apple Mail).
// Le logo est dessiné en HTML (pas d'image à autoriser) ; les paragraphes sont du HTML déjà échappé par l'appelant.
const CORAL = "#ff5a5f";
const NAVY = "#1b2a4a";
const GREY = "#5a6b85";

export const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const siteUrl = () => (process.env.APP_URL || "https://postgenius.network").replace(/\/$/, "");
const host = () => siteUrl().replace(/^https?:\/\//, "");

// { title, paragraphs: [html], cta: { label, url }, preheader, eyebrow, note } → HTML complet
export function emailHtml({ title, paragraphs = [], cta = null, preheader = "", eyebrow = "", note = "" }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.65;color:${NAVY}">${p}</p>`).join("");
  const button = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 8px"><tr><td style="background:${CORAL};border-radius:999px"><a href="${cta.url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:inherit">${escHtml(cta.label)}</a></td></tr></table>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${GREY}">Le bouton ne s'ouvre pas ? Copiez ce lien dans votre navigateur :<br><a href="${cta.url}" style="color:#0a66c2;word-break:break-all">${escHtml(cta.url)}</a></p>`
    : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f4f6fb">${escHtml(preheader || title)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f6fb"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px">
    <tr><td style="padding:0 4px 16px">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="background:${CORAL};border-radius:10px;width:38px;height:38px;text-align:center;vertical-align:middle;color:#ffffff;font-weight:800;font-size:15px;letter-spacing:-0.5px;line-height:38px">LP</td>
        <td style="padding-left:10px;vertical-align:middle"><span style="font-size:19px;font-weight:800;color:${NAVY}">LinkeePost</span><br><span style="font-size:11px;color:${GREY}">Campagnes LinkedIn</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e6eaf2;border-top:4px solid ${CORAL};padding:30px 30px 26px">
      ${eyebrow ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${CORAL}">${escHtml(eyebrow)}</p>` : ""}
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;font-weight:800;color:${NAVY}">${escHtml(title)}</h1>
      ${body}${button}
    </td></tr>
    <tr><td style="padding:18px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:#8a97ad">
      ${note ? `${note}<br>` : ""}LinkeePost · <a href="${siteUrl()}" style="color:#8a97ad">${escHtml(host())}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// Version texte (même contenu, sans balises) pour les messageries qui n'affichent pas le HTML
export function emailText({ title, paragraphs = [], cta = null }) {
  const strip = (h) => String(h).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return [title, ...paragraphs.map(strip), cta ? `${cta.label} : ${cta.url}` : "", "— LinkeePost"].filter(Boolean).join("\n\n");
}

// { subject, ...contenu } → { subject, html, text } prêt pour sendMail
export function buildEmail({ subject, ...content }) {
  return { subject, html: emailHtml(content), text: emailText(content) };
}
