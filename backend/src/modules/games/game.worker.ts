import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from "@nestjs/common";
import { readEnvironment } from "../../common/config/environment.js";
import { GameLifecycleService } from "./game-lifecycle.service.js";
import { GameSchedulerService } from "./game-scheduler.service.js";

@Injectable()
export class GameWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(GameWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;

  constructor(private readonly scheduler: GameSchedulerService, private readonly lifecycle: GameLifecycleService) {}

  async onApplicationBootstrap() {
    const env = readEnvironment();
    if (env.nodeEnv === "test" || !env.gameWorkerEnabled) return;
    await this.tick();
    this.timer = setInterval(() => { void this.tick(); }, env.gameIntervalMs);
    this.timer.unref();
  }

  tick() {
    if (this.running) return this.running;
    this.running = (async () => {
      try { await this.scheduler.ensureToday(); } catch { this.logger.error("Günlük etkinlik oluşturulamadı; sonraki taramada tekrar denenecek."); }
      await this.lifecycle.scan();
    })().catch(() => { this.logger.error("Oyun aşama taraması başarısız; sonraki taramada tekrar denenecek."); })
      .finally(() => { this.running = undefined; });
    return this.running;
  }

  async onModuleDestroy() { if (this.timer) clearInterval(this.timer); await this.running; }
}
