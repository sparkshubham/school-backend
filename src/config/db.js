import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

// Local Supabase db.* hosts are IPv6-only. Vercel is IPv4 — leave the default there.
if (!process.env.VERCEL) {
  dns.setDefaultResultOrder('verbatim');
}

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
if (process.env.VERCEL) globalForPrisma.prisma = prisma;

export async function connectDb() {
  await prisma.$connect();
  console.log('PostgreSQL connected');
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
