// Client Phyllo (statistiques du profil LinkedIn personnel).
// Auth : Basic client_id:secret — appels serveur uniquement.
// Env : PHYLLO_CLIENT_ID, PHYLLO_SECRET, PHYLLO_ENV (sandbox | production)

const BASES = {
  sandbox: "https://api.sandbox.getphyllo.com",
  staging: "https://api.staging.getphyllo.com",
  production: "https://api.getphyllo.com",
};

export function phylloEnv() {
  return process.env.PHYLLO_ENV === "production" ? "production" : process.env.PHYLLO_ENV === "staging" ? "staging" : "sandbox";
}

export function isPhylloConfigured() {
  return Boolean(process.env.PHYLLO_CLIENT_ID && process.env.PHYLLO_SECRET);
}

export async function phylloFetch(path, { method = "GET", body, silent } = {}) {
  const auth = Buffer.from(`${process.env.PHYLLO_CLIENT_ID}:${process.env.PHYLLO_SECRET}`).toString("base64");
  const url = `${BASES[phylloEnv()]}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) {
    // undici masque la cause réseau réelle (DNS, TLS, proxy...) — on la remonte
    const cause = e.cause?.code || e.cause?.message || e.message;
    console.error("Phyllo injoignable:", url, "—", cause);
    throw new Error(`Phyllo injoignable (${cause}). Vérifiez la connexion réseau / proxy du serveur.`);
  }
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    if (!silent) console.error("Phyllo", res.status, path, text.slice(0, 300));
    const err = new Error(data?.error?.message || `Phyllo a répondu ${res.status} sur ${path}`);
    err.status = res.status;
    err.code = data?.error?.code ?? data?.error?.error_code ?? null;
    throw err;
  }
  return data;
}

// Identifiant de la plateforme LinkedIn chez Phyllo (résolu dynamiquement)
let linkedinPlatformId = null;
export async function getLinkedInPlatformId() {
  if (linkedinPlatformId) return linkedinPlatformId;
  const data = await phylloFetch("/v1/work-platforms?name=LinkedIn");
  linkedinPlatformId = data.data?.[0]?.id ?? null;
  if (!linkedinPlatformId) throw new Error("Plateforme LinkedIn introuvable chez Phyllo.");
  return linkedinPlatformId;
}
