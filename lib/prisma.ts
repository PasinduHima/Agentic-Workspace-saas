import { PrismaClient } from "./generated/prisma/client";
import {PrismaPg} from "@prisma/adapter-pg"

const globalForPrisma = global as unknown as {prisma: PrismaClient};

const adapter = new PrismaPg({connectionString : process.env.DATABASE_URL});

export const prisma = globalForPrisma.prisma || new PrismaClient({
    adapter
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// For interactive transactions: Prisma's default maxWait (2s) to get a connection is too short for
// a database that's waking up, which made the first save after idle fail with P2028.
export const TRANSACTION_OPTIONS = { maxWait: 10_000 };
