import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(
    "Kullanım: npm run maintenance:run -- [--apply] [--batch-size=100]\nVarsayılan rapor. DB, posta/push ve medya tek sırada; otomatik işçi: MAINTENANCE_* ayarları.",
  );
} else {
  if (
    args.some((arg) => arg !== "--apply" && !/^--batch-size=\d+$/.test(arg)) ||
    new Set(args).size !== args.length ||
    args.filter((arg) => arg.startsWith("--batch-size=")).length > 1
  )
    throw new Error("Geçersiz bakım seçeneği.");
  const batchSize = Number(
    args.find((arg) => arg.startsWith("--batch-size="))?.split("=")[1] ?? "100",
  );
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500)
    throw new Error("Bakım sınırı 1–500 olmalı.");
  await assertProjectDatabase();
  for (const key of [
    "POLL_CLOSE_WORKER_ENABLED",
    "GAME_WORKER_ENABLED",
    "OUTBOX_WORKER_ENABLED",
    "MAINTENANCE_WORKER_ENABLED",
  ])
    process.env[key] = "false";
  const { AppModule } = await import(
    new URL("../dist/app.module.js", import.meta.url).href
  );
  const { MaintenanceService } = await import(
    new URL(
      "../dist/modules/maintenance/maintenance.service.js",
      import.meta.url,
    ).href
  );
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error"],
  });
  try {
    const result = await app
      .get(MaintenanceService)
      .run(args.includes("--apply"), batchSize);
    console.log(JSON.stringify(result, null, 2));
    if (result.status === "PARTIAL" || result.status === "FAILED")
      process.exitCode = 1;
  } finally {
    await app.close();
  }
}
