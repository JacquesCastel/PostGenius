import { cleanText, MAX_TEXT_CHARS } from "./knowledgeText";

// Extraction du texte d'un document PDF ou Word (.docx) déposé par le client (partie serveur).
// Le type est reconnu sur le CONTENU du fichier, jamais sur son nom ni sur l'en-tête envoyé par le navigateur.

export const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_PDF_PAGES = 300; // pages lues au plus (le texte conservé est de toute façon borné)
const MAX_ZIP_ENTRIES = 3000;
const MAX_ZIP_UNCOMPRESSED = 80 * 1024 * 1024; // garde contre les archives piégées (« zip bomb »)
const EXTRACT_TIMEOUT = 25_000;
const MIN_TEXT = 200;

export class DocError extends Error {}

const startsWith = (buf, sig) => sig.every((b, i) => buf[i] === b);
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP = [0x50, 0x4b, 0x03, 0x04]; // PK..
const OLE = [0xd0, 0xcf, 0x11, 0xe0]; // ancien format Word (.doc)

// Lit le répertoire central d'une archive ZIP sans rien décompresser : { entries: [{ name, size }] }
export function zipDirectory(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new DocError("Fichier Word illisible.");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  if (total > MAX_ZIP_ENTRIES) throw new DocError("Fichier Word anormal (trop d'éléments).");
  const entries = [];
  for (let n = 0; n < total; n++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) throw new DocError("Fichier Word illisible.");
    const size = buf.readUInt32LE(off + 24);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    entries.push({ name: buf.toString("utf8", off + 46, off + 46 + nameLen), size });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return { entries };
}

export function detectKind(buf) {
  if (startsWith(buf, PDF)) return "pdf";
  if (startsWith(buf, OLE)) return "doc";
  if (startsWith(buf, ZIP)) return "zip";
  return "unknown";
}

const withTimeout = (p) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new DocError("La lecture du document prend trop de temps : essayez un fichier plus léger.")), EXTRACT_TIMEOUT))]);

async function pdfText(buf) {
  const { getDocumentProxy } = await import("unpdf");
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buf));
  } catch (e) {
    if (/password/i.test(`${e?.name} ${e?.message}`)) throw new DocError("Ce PDF est protégé par un mot de passe : retirez la protection puis réessayez.");
    throw new DocError("Ce PDF est illisible ou endommagé.");
  }
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  let text = "";
  for (let i = 1; i <= pages && text.length < MAX_TEXT_CHARS; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    for (const it of content.items) {
      line += it.str ?? "";
      if (it.hasEOL) line += "\n";
      else if (it.str && !/\s$/.test(it.str)) line += " ";
    }
    text += `${line}\n\n`;
  }
  try { await pdf.destroy(); } catch {}
  return text.replace(/ +\n/g, "\n");
}

async function docxText(buf) {
  const { entries } = zipDirectory(buf);
  if (!entries.some((e) => e.name === "word/document.xml")) throw new DocError("Ce fichier n'est pas un document Word (.docx).");
  if (entries.reduce((s, e) => s + e.size, 0) > MAX_ZIP_UNCOMPRESSED) throw new DocError("Ce document est anormalement volumineux une fois décompressé : il est refusé.");
  const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
  try {
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  } catch {
    throw new DocError("Ce document Word est illisible ou endommagé.");
  }
}

// Fichier → { kind: "pdf" | "docx", text }. Lève DocError (message lisible par l'utilisateur).
export async function extractDocumentText(buf) {
  if (!Buffer.isBuffer(buf) || buf.length === 0) throw new DocError("Fichier vide.");
  if (buf.length > MAX_FILE_BYTES) throw new DocError("Fichier trop volumineux (8 Mo au maximum).");
  const type = detectKind(buf);
  if (type === "doc") throw new DocError("Ce format Word ancien (.doc) n'est pas pris en charge : enregistrez-le en .docx ou en PDF.");
  if (type !== "pdf" && type !== "zip") throw new DocError("Format non pris en charge : déposez un PDF ou un document Word (.docx).");
  const raw = await withTimeout(type === "pdf" ? pdfText(buf) : docxText(buf));
  const text = cleanText(raw);
  if (text.length < MIN_TEXT) {
    throw new DocError(
      type === "pdf"
        ? "Ce PDF ne contient pas de texte sélectionnable (document scanné ou images) : la reconnaissance de texte n'est pas prise en charge. Collez le texte à la place."
        : "Ce document contient trop peu de texte."
    );
  }
  return { kind: type === "pdf" ? "pdf" : "docx", text };
}
