import "reflect-metadata";
import "dotenv/config";
import { Logger } from "@nestjs/common";
import { createApp } from "./create-app.js";
import { readEnvironment } from "./common/config/environment.js";

const env = readEnvironment();
const app = await createApp(undefined, env);
await app.listen(env.port, env.host);
Logger.log(`Podyum backend: ${await app.getUrl()}`, "Bootstrap");
