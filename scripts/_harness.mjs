// Outil de test (pas un test) : charge un module ou une route de l'application SANS Next.js ni base, en remplaçant ses imports par des doublures.
// Les imports du fichier sont retirés ; chaque nom importé est lu dans `stubs` (sinon : fonction vide). `prisma` et `NextResponse` ont une doublure à part.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NextResponse = { json: (body, init = {}) => ({ status: init.status ?? 200, body }) };

export async function loadModule(rel, { stubs = {}, prisma = null } = {}) {
  let src = fs.readFileSync(path.resolve(rel), "utf8");
  const names = [];
  src = src.replace(/^import\s+([\s\S]*?)\s+from\s+["'][^"']+["'];?[ \t]*$/gm, (_m, spec) => {
    const s = spec.trim();
    const named = s.match(/\{([\s\S]*)\}/);
    if (named) for (const part of named[1].split(",")) { const p = part.trim(); if (!p) continue; const [orig, alias] = p.split(/\s+as\s+/); names.push([(alias ?? orig).trim(), orig.trim()]); }
    const def = s.replace(/\{[\s\S]*\}/, "").replace(/,/g, "").trim();
    if (def && !def.startsWith("*")) names.push([def, "default"]);
    return "";
  });
  const unique = [...new Map(names.map((n) => [n[0], n])).values()];
  const prelude = `const __S = globalThis.__HARNESS;\n` + unique.map(([local, orig]) => `const ${local} = __S.stubs[${JSON.stringify(local)}] ?? (${JSON.stringify(local)} === "prisma" ? __S.prisma : ${JSON.stringify(local)} === "NextResponse" ? __S.NextResponse : async () => undefined);`).join("\n") + "\n";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-"));
  const file = path.join(dir, `m-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(file, prelude + src);
  globalThis.__HARNESS = { stubs, prisma, NextResponse };
  return import(pathToFileURL(file).href);
}

export const fakeReq = (body = {}, { url = "http://localhost/x" } = {}) => ({ json: async () => body, url, headers: new Headers(), cookies: { get: () => undefined } });
