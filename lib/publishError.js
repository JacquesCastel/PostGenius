// Message d'échec de publication (enregistré par le planificateur dans publishError) → explication claire et geste à faire.
// Fonction pure : le texte d'origine reste affiché ; on y ajoute ce que le client peut faire.
//   action : "reconnect" (reconnecter le profil), "reconnect-org" (reconnecter la page entreprise),
//            "edit" (modifier le post avant de reprogrammer), "retry" (réessayer)

export function explainPublishError(message) {
  const m = String(message ?? "").trim();
  const low = m.toLowerCase();
  if (!m) return { message: "La publication a échoué sans message de LinkedIn.", hint: "Réessayez maintenant ou reprogrammez le post.", action: "retry" };
  if (/page entreprise/.test(low) && /(expir|connect)/.test(low)) return { message: m, hint: "Reconnectez la page entreprise, puis reprogrammez le post.", action: "reconnect-org" };
  if (/(expir|non connect|session linkedin|reconnect)/.test(low)) return { message: m, hint: "Reconnectez votre compte LinkedIn, puis réessayez ou reprogrammez le post.", action: "reconnect" };
  if (/contenu identique/.test(low)) return { message: m, hint: "Modifiez le texte pour qu'il diffère d'un post récent, puis reprogrammez-le.", action: "edit" };
  if (/trop long/.test(low)) return { message: m, hint: "Raccourcissez le post (3 000 caractères au maximum), puis reprogrammez-le.", action: "edit" };
  if (/(image|vidéo).*(introuvable)/.test(low)) return { message: m, hint: "Ouvrez le post pour ajouter à nouveau son média, puis reprogrammez-le.", action: "edit" };
  if (/(vidéo|image|upload|transfert|traiter)/.test(low)) return { message: m, hint: "Réessayez. Si cela persiste, publiez le post sans ce média.", action: "retry" };
  if (/texte du post vide/.test(low)) return { message: m, hint: "Ajoutez du texte au post avant de le reprogrammer.", action: "edit" };
  return { message: m, hint: "Réessayez maintenant ou reprogrammez le post. Si l'échec se répète, reconnectez LinkedIn.", action: "retry" };
}
