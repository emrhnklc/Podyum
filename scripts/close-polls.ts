import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { isUUID } from "class-validator";
const pollId = process.argv[2];
if (process.argv.length > 3 || (pollId !== undefined && !isUUID(pollId))) throw new Error("Kullanım: npm run polls:close -- [poll-uuid]");
process.env.POLL_CLOSE_WORKER_ENABLED = "false";
const { AppModule } = await import(new URL("../dist/app.module.js", import.meta.url).href);
const { PollParticipationService } = await import(new URL("../dist/modules/polls/poll-participation.service.js", import.meta.url).href);
const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
try {
  console.log(JSON.stringify(await app.get(PollParticipationService).closeExpiredBatch(100, pollId), null, 2));
} finally {
  await app.close();
}
