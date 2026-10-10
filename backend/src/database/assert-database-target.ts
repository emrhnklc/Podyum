import "dotenv/config";
import { readdir } from "node:fs/promises";
import { Client } from "pg";

/** Başka bir yerel projenin DB'sine yanlışlıkla migration/seed/test uygulanmasını engeller. */
export async function assertProjectDatabase({
  allowEmpty = false,
  allowOwnedShadow = false,
  connectionString = process.env.DATABASE_URL,
} = {}) {
  if (!connectionString) throw new Error("DATABASE_URL tanımlanmalı.");
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Bu başlangıç projesinin DB komutları yalnızca yerel bağlantılarda çalışır.");
  }
  const schema = url.searchParams.get("schema") ?? "public";
  if (schema !== "public") throw new Error("Bu yerel temel public schema için hazırlanmıştır.");
  const migrations = new Set((await readdir(new URL("../../prisma/migrations/", import.meta.url), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory()).map((entry) => entry.name));

  const client = new Client({ connectionString, connectionTimeoutMillis: 5_000 });
  await client.connect();
  try {
    const schemaInfo = await client.query<{ marker: string | null }>(
      "SELECT obj_description(oid, 'pg_namespace') AS marker FROM pg_namespace WHERE nspname = $1", [schema],
    );
    const marker = schemaInfo.rows[0]?.marker;
    if (marker && marker !== "standard public schema" && marker !== "kombin-proje2.local.v1") {
      throw new Error("Hedef schema başka bir sahiplik işareti içeriyor. İşlem durduruldu.");
    }
    const tables = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = $1", [schema],
    );
    if (tables.rows.length === 0 && allowEmpty) return;
    if (allowOwnedShadow && marker === "kombin-proje2.local.v1") return;
    if (!tables.rows.some((table) => table.tablename === "_prisma_migrations")) {
      throw new Error("Hedef boş değil veya bu projeye ait migration geçmişi yok. İşlem durduruldu.");
    }
    const history = await client.query<{ migration_name: string }>(
      `SELECT migration_name FROM "${schema}"."_prisma_migrations"`,
    );
    if (!history.rows.length) {
      if (allowEmpty && tables.rows.length === 1) return;
      throw new Error("Hedefte bu projeye ait uygulanmış migration bulunamadı.");
    }
    if (history.rows.some((migration) => !migrations.has(migration.migration_name))) {
      throw new Error("Hedef başka bir projenin migration geçmişini içeriyor. İşlem durduruldu.");
    }
  } finally {
    await client.end();
  }
}
