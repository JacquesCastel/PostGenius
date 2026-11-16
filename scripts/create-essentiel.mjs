// Crée un compte de test sur l'offre Essentiel (ou en met à jour l'offre).
// Lancer sur le serveur :  node --env-file=.env scripts/create-essentiel.mjs
//   --reset-password   donne un NOUVEAU mot de passe aléatoire à un compte déjà existant (à utiliser si l'ancien est connu de tiers)
// Le mot de passe n'est jamais écrit dans le code : il est tiré au hasard à la création et affiché UNE seule fois (le noter dans un gestionnaire
// de mots de passe). TEST_ACCOUNT_PASSWORD (variable d'environnement) permet d'en imposer un.
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "test-essentiel@linkeepost.app";
const reset = process.argv.includes("--reset-password");
const newPassword = () => process.env.TEST_ACCOUNT_PASSWORD || crypto.randomBytes(18).toString("base64url");

const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
let shown = null;
let user;
if (!existing) {
  shown = newPassword();
  user = await prisma.user.create({
    data: {
      email: EMAIL,
      password: await bcrypt.hash(shown, 12),
      name: "Compte Essentiel (test)",
      plan: "essentiel",
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
      planUpdatedAt: new Date(),
    },
  });
} else {
  const data = { plan: "essentiel", disabled: false };
  if (reset) { shown = newPassword(); data.password = await bcrypt.hash(shown, 12); }
  user = await prisma.user.update({ where: { email: EMAIL }, data });
}

console.log("\n✅ Compte prêt :");
console.log("   email    :", user.email);
console.log("   offre    :", user.plan);
if (shown) {
  console.log("   password :", shown);
  console.log("   (affiché une seule fois : le noter maintenant dans un gestionnaire de mots de passe)\n");
} else {
  console.log("   password : inchangé (compte déjà existant ; --reset-password pour en définir un nouveau)\n");
}

await prisma.$disconnect();
