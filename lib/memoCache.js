// Cache mémoire des contenus publics lus en base (page d'accueil, tarifs, pages légales, blog).
// Utile surtout avec une base distante (Neon) : la plupart des visites n'attendent plus aucune requête, et un contenu expiré est servi
// tout de suite pendant qu'il se rafraîchit en arrière-plan. Une base momentanément injoignable ne vide jamais le contenu déjà connu.
// Les modifications faites dans l'Administration appellent memoClear() : elles sont visibles immédiatement.
// Sur globalThis : les pages et les routes de l'Administration (empaquetées séparément) partagent ainsi le même cache
const g = globalThis;
const store = (g.__memoStore ??= new Map()); // clé → { value, at }
const loading = (g.__memoLoading ??= new Map()); // clé → promesse en cours (une seule lecture à la fois par clé)
const MAX_ENTRIES = 500; // borne la mémoire (adresses d'articles inventées par un visiteur)

export const MEMO_TTL = 5 * 60 * 1000;

function refresh(key, load) {
  if (!loading.has(key)) {
    const p = load()
      .then((value) => {
        store.delete(key);
        store.set(key, { value, at: Date.now() });
        while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
        return value;
      })
      .finally(() => loading.delete(key));
    loading.set(key, p);
  }
  return loading.get(key);
}

// load : lit la base et LÈVE en cas d'erreur ; fallback : valeur renvoyée (sans être mémorisée) si rien n'est connu et que la lecture échoue
export async function memo(key, ttlMs, load, fallback) {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (hit) {
    refresh(key, load).catch(() => {}); // contenu expiré : on le sert, on rafraîchit derrière
    return hit.value;
  }
  try {
    return await refresh(key, load);
  } catch {
    return fallback;
  }
}

export function memoClear() {
  store.clear();
}
