import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { assertProjectDatabase } from "../src/database/assert-database-target.js";
const userId = process.argv[2];
if (!userId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new Error("Kullanım: npm run accounts:cleanup -- <silme-isteği-olan-user-uuid>");
await assertProjectDatabase();
process.env.POLL_CLOSE_WORKER_ENABLED = "false"; process.env.GAME_WORKER_ENABLED = "false"; process.env.OUTBOX_WORKER_ENABLED = "false";
const { AppModule } = await import(new URL("../dist/app.module.js", import.meta.url).href);
const { AccountErasureService } = await import(new URL("../dist/modules/accounts/account-erasure.service.js", import.meta.url).href);
const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
try { console.log(JSON.stringify(await app.get(AccountErasureService).erase(userId))); }
finally { await app.close(); }
