import "dotenv/config";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { createDb } from "../src/database/prisma-client.js";
import { runTechnicalRetention } from "../src/common/maintenance/technical-retention.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Kullanım: npm run maintenance:technical -- [--apply] [--batch-size=100]\nVarsayılan yalnız raporlar. --apply bir sınırlı DB temizliği yapar; tüm tabloyu/dosyaları silmez.");
} else {
  if (args.some((arg) => arg !== "--apply" && !/^--batch-size=\d+$/.test(arg)) || new Set(args).size !== args.length || args.filter((arg) => arg.startsWith("--batch-size=")).length > 1)
    throw new Error("Yalnız --apply ve bir --batch-size=N seçeneği kullanılabilir.");
  const batchSize = Number(args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? "100");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("Batch sınırı 1–500 olmalı.");
  await assertProjectDatabase();
  const db = createDb();
  try { console.log(JSON.stringify(await runTechnicalRetention(db, { apply: args.includes("--apply"), batchSize }), null, 2)); }
  finally { await db.$disconnect(); }
}
