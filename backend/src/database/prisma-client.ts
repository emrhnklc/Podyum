import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";

export function createPrismaAdapter() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL tanımlanmalı. .env.example dosyasına bakın.");

  // Local Prisma Postgres tek bağlantı destekler. Gerçek PostgreSQL'de havuz ayrı ayarlanacak.
  return new PrismaPg({ connectionString, max: 1, idleTimeoutMillis: 1_000 });
}

// Seed ve CLI scriptleri Nest uygulamasından bağımsız bir istemci kullanır.
export function createDb() {
  return new PrismaClient({ adapter: createPrismaAdapter() });
}
