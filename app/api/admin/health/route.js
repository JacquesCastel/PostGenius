import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireAdmin } from "@/lib/admin";

// Rapport de santé serveur (disque, conteneurs Docker, erreurs récentes),
// généré côté hôte par health-check.sh (cron, toutes les 5 min) et déposé
// dans le volume de données partagé. Le conteneur applicatif n'a lui-même
// aucun accès Docker/SSH : il ne fait que lire ce fichier.
const HEALTH_FILE = path.join(process.cwd(), "data", "health.json");

export async function GET(req) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "Accès refusé." }, { status: 403 });

  try {
    const raw = await fs.readFile(HEALTH_FILE, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "Rapport de santé indisponible (cron pas encore passé, ou serveur non configuré)." },
      { status: 404 }
    );
  }
}
