import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module.js";
import { OutboxDispatcher, OutboxRegistry } from "./outbox-dispatcher.js";
import { OutboxWorker } from "./outbox.worker.js";

@Module({ imports: [DatabaseModule], providers: [OutboxRegistry, OutboxDispatcher, OutboxWorker], exports: [OutboxRegistry, OutboxDispatcher] })
export class OutboxModule {}
