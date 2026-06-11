import { PrismaClient } from "@prisma/client";

// Singleton Prisma (évite de multiplier les connexions en dev avec le hot-reload)
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
