import sharp from "sharp";

// PDF d'images : une image par page, à la taille de l'image. Pas de dépendance : les images sont recodées en JPEG
// (filtre DCTDecode) et assemblées à la main. Sert à publier un carrousel comme document LinkedIn.
export async function imagesToPdf(images) {
  if (!images?.length) throw new Error("Aucune image pour le PDF.");
  const pages = [];
  for (const buf of images) {
    const { data, info } = await sharp(buf).flatten({ background: "#ffffff" }).toColourspace("srgb").jpeg({ quality: 88 }).toBuffer({ resolveWithObject: true });
    pages.push({ jpeg: data, w: info.width, h: info.height });
  }
  const chunks = [];
  const offsets = [];
  let size = 0;
  const push = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1"); chunks.push(buf); size += buf.length; };
  const obj = (n, body) => { offsets[n] = size; push(`${n} 0 obj\n`); push(body); push("\nendobj\n"); };
  push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  // 1 = catalogue, 2 = liste des pages ; page i : 3+3i (page), 4+3i (contenu), 5+3i (image)
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ")}] >>`);
  pages.forEach((p, i) => {
    const page = 3 + 3 * i;
    const content = `q ${p.w} 0 0 ${p.h} 0 0 cm /Im0 Do Q`;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.w} ${p.h}] /Resources << /XObject << /Im0 ${page + 2} 0 R >> >> /Contents ${page + 1} 0 R >>`);
    obj(page + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    offsets[page + 2] = size;
    push(`${page + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push("\nendstream\nendobj\n");
  });
  const count = 3 + 3 * pages.length;
  const xref = size;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}
