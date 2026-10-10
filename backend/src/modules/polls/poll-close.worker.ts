import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { readEnvironment } from "../../common/config/environment.js";
import { PollParticipationService } from "./poll-participation.service.js";

@Injectable()
export class PollCloseWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PollCloseWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  async onApplicationBootstrap() {
    const env = readEnvironment();
    if (env.nodeEnv === "test" || !env.pollCloseWorkerEnabled) return;
    await this.tick();
    this.timer = setInterval(() => { void this.tick(); }, env.pollCloseIntervalMs);
    this.timer.unref();
  }

  constructor(private readonly polls: PollParticipationService) {}

  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.polls.closeExpiredBatch().then(() => {}).catch(() => {
      this.logger.error("Oylama kapanış taraması başarısız; sonraki taramada yeniden denenecek.");
    }).finally(() => { this.running = undefined; });
    return this.running;
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
