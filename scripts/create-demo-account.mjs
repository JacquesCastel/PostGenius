// Crée le compte de démonstration pour la soumission LinkedIn.
// Lancer sur le serveur : node --env-file=.env scripts/create-demo-account.mjs
//   --reset-password   donne un NOUVEAU mot de passe aléatoire à un compte déjà existant (à utiliser si l'ancien est connu de tiers).
//                      Attention : si ce compte est celui indiqué à LinkedIn pour la vérification de l'application, leur communiquer le nouveau.
// Le mot de passe n'est jamais écrit dans le code : il est tiré au hasard à la création et affiché UNE seule fois (le noter dans un gestionnaire
// de mots de passe). TEST_ACCOUNT_PASSWORD (variable d'environnement) permet d'en imposer un.
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "demo@linkeepost.app";
const NAME = "Demo LinkeePost";
const reset = process.argv.includes("--reset-password");
const newPassword = () => process.env.TEST_ACCOUNT_PASSWORD || crypto.randomBytes(18).toString("base64url");

const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
let shown = null;
if (!existing) {
  shown = newPassword();
  await prisma.user.create({
    data: {
      email: EMAIL,
      password: await bcrypt.hash(shown, 12),
      name: NAME,
      plan: "agence",
      trialEndsAt: new Date(Date.now() + 365 * 86400000), // 1 an
      planUpdatedAt: new Date(),
    },
  });
  console.log("✅ Compte créé :", EMAIL);
} else if (reset) {
  shown = newPassword();
  await prisma.user.update({ where: { email: EMAIL }, data: { password: await bcrypt.hash(shown, 12) } });
  console.log("✅ Mot de passe réinitialisé :", EMAIL);
} else {
  console.log("✅ Compte déjà existant :", EMAIL);
}

console.log("   Email    :", EMAIL);
if (shown) {
  console.log("   Password :", shown);
  console.log("   (affiché une seule fois : le noter maintenant dans un gestionnaire de mots de passe)");
} else {
  console.log("   Password : inchangé (--reset-password pour en définir un nouveau)");
}
console.log("   URL      : https://linkeepost.app/app");

await prisma.$disconnect();
