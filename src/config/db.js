import dns from 'node:dns';
import { PrismaClient } from '@prisma/client';

// Local Supabase db.* hosts are IPv6-only. Vercel is IPv4 — leave the default there.
if (!process.env.VERCEL) {
  dns.setDefaultResultOrder('verbatim');
}

function runtimeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    if (u.hostname.includes('pooler.supabase.com')) {
      u.searchParams.set('connect_timeout', '10');
      u.searchParams.set('pool_timeout', '10');
      if (!u.searchParams.get('sslmode')) u.searchParams.set('sslmode', 'require');
      if (process.env.VERCEL) {
        u.port = '6543';
        u.searchParams.set('pgbouncer', 'true');
        u.searchParams.set('connection_limit', '1');
      } else if (!u.searchParams.get('connection_limit')) {
        u.searchParams.set('connection_limit', '3');
      }
    }
    return u.toString();
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: { db: { url: runtimeDatabaseUrl() } },
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
