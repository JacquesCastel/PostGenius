import fs from "fs/promises";
import path from "path";

// Fichiers d'état écrits par le serveur hôte (deploy.sh, rollback.sh) dans le volume de données partagé : le conteneur ne fait que les lire.
const STATE_DIR = path.join(process.cwd(), "data", "state");

// Journal des déploiements : une ligne JSON par événement { at, event, sha, prev, detail } (deploy.sh / rollback.sh)
export async function readDeployJournal(limit = 30) {
  try {
    const raw = await fs.readFile(path.join(STATE_DIR, "deploys.jsonl"), "utf8");
    const rows = [];
    for (const line of raw.split("\n").slice(-400)) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch {}
    }
    return rows.slice(-limit).reverse();
  } catch {
    return null; // fichier absent : journal pas encore alimenté (ancien script de déploiement)
  }
}

export async function readVersion() {
  try {
    return JSON.parse(await fs.readFile(path.join(STATE_DIR, "version.json"), "utf8"));
  } catch {
    return null;
  }
}
