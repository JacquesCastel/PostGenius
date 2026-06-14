// Crée (ou met à jour) un compte de test sur l'offre Essentiel.
// Lancer depuis ~/linkedin :  node --env-file=.env scripts/create-essentiel.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "test-essentiel@postgenius.fr";
const PASSWORD = "Essentiel2026!";

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  update: { plan: "essentiel", disabled: false },
  create: {
    email: EMAIL,
    password: await bcrypt.hash(PASSWORD, 12),
    name: "Compte Essentiel (test)",
    plan: "essentiel",
    trialEndsAt: new Date(Date.now() + 14 * 86400000),
    planUpdatedAt: new Date(),
  },
});

console.log("\n✅ Compte prêt :");
console.log("   email    :", user.email);
console.log("   password :", PASSWORD);
console.log("   offre    :", user.plan, "\n");

await prisma.$disconnect();
