import "reflect-metadata";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
const { AppModule } = await import(new URL("../dist/app.module.js", import.meta.url).href);
const { MediaService } = await import(new URL("../dist/modules/media/media.service.js", import.meta.url).href);

const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
try {
  console.log(JSON.stringify(await app.get(MediaService).cleanup(), null, 2));
} finally {
  await app.close();
}
