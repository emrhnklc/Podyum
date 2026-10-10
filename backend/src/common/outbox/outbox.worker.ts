import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { readEnvironment } from "../config/environment.js";
import { OutboxDispatcher } from "./outbox-dispatcher.js";

@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(private readonly dispatcher: OutboxDispatcher) {}

  async onApplicationBootstrap() {
    const env = readEnvironment();
    if (env.nodeEnv === "test" || !env.outboxWorkerEnabled) return;
    await this.tick();
    this.timer = setInterval(() => { void this.tick(); }, env.outboxIntervalMs);
    this.timer.unref();
  }

  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.dispatcher.drain().then(() => {}).catch(() => {
      this.logger.error("Olay kuyruğu taraması başarısız; sonraki taramada yeniden denenecek.");
    }).finally(() => { this.running = undefined; });
    return this.running;
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
