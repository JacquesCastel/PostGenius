// Génère une paire de clés VAPID pour les notifications push.
// Lancer depuis ~/linkedin :  node scripts/gen-vapid.mjs
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nCopie ces 3 lignes dans ton .env (local ET serveur) :\n");
console.log("NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + keys.publicKey);
console.log("VAPID_PRIVATE_KEY=" + keys.privateKey);
console.log("VAPID_SUBJECT=mailto:contact@votredomaine.fr\n");
