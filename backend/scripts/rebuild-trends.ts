import "reflect-metadata";
import "dotenv/config";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
import { PrismaService } from "../src/database/prisma.service.js";
import { TrendProjectionService } from "../src/modules/trends/trend-projection.service.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Kullanım: npm run trends:rebuild -- [--apply] [--batch-size=50] [--poll-id=UUID] [--cursor=...]\nVarsayılan yalnız rapor. nextCursor ile sonraki batch; gerçek tercih/etiketler değişmez.",
  );
} else {
  const names = args.map((arg) => arg.split("=")[0]);
  if (
    new Set(names).size !== names.length ||
    args.some(
      (arg) =>
        arg !== "--apply" && !/^--(?:batch-size|poll-id|cursor)=.+$/.test(arg),
    )
  )
    throw new Error("Geçersiz trend onarım seçeneği.");
  const option = (name: string) =>
    args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const batchSize = Number(option("batch-size") ?? "50");
  if (
    !/^\d+$/.test(option("batch-size") ?? "50") ||
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > 100
  )
    throw new Error("Trend onarım sınırı 1–100 olmalı.");
  await assertProjectDatabase();
  const db = new PrismaService();
  try {
    const result = await new TrendProjectionService(db).rebuildBatch({
      apply: args.includes("--apply"),
      batchSize,
      pollId: option("poll-id"),
      cursor: option("cursor"),
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.invalidSnapshots) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
