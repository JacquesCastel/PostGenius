import crypto from "crypto";

// Chiffrement des tokens LinkedIn en base (AES-256-GCM).
// Clé : TOKEN_ENCRYPTION_KEY (64 caractères hex = 32 octets),
// à générer avec : openssl rand -hex 32

function getKey() {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOKEN_ENCRYPTION_KEY manquante (obligatoire en production).");
    }
    // Clé dérivée stable pour le dev uniquement
    return crypto.createHash("sha256").update("dev-only-token-key").digest();
  }
  if (!/^[0-9a-f]{64}$/i.test(k)) {
    throw new Error("TOKEN_ENCRYPTION_KEY invalide : attendu 64 caractères hexadécimaux.");
  }
  return Buffer.from(k, "hex");
}

export function encryptToken(plain) {
  if (plain == null) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return `enc:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

export function decryptToken(stored) {
  if (stored == null) return null;
  if (!stored.startsWith("enc:")) return stored; // valeur historique non chiffrée
  try {
    const [, ivHex, tagHex, dataHex] = stored.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null; // clé changée ou donnée corrompue → forcera une reconnexion LinkedIn
  }
}
