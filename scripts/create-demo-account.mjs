// Crée le compte de démonstration pour la soumission LinkedIn.
// Lancer sur le serveur : node --env-file=.env scripts/create-demo-account.mjs
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const EMAIL = "demo@postgenius.network";
const PASSWORD = "Demo2026!";
const NAME = "Demo LinkeePost";

const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
if (existing) {
  console.log("✅ Compte déjà existant :", EMAIL);
} else {
  await prisma.user.create({
    data: {
      email: EMAIL,
      password: await bcrypt.hash(PASSWORD, 12),
      name: NAME,
      plan: "agence",
      trialEndsAt: new Date(Date.now() + 365 * 86400000), // 1 an
      planUpdatedAt: new Date(),
    },
  });
  console.log("✅ Compte créé :", EMAIL);
}

console.log("   Email    :", EMAIL);
console.log("   Password :", PASSWORD);
console.log("   URL      : https://postgenius.network/app");

await prisma.$disconnect();
