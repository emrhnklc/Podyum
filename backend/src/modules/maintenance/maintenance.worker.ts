import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { readEnvironment } from "../../common/config/environment.js";
import { MaintenanceService } from "./maintenance.service.js";
@Injectable()
export class MaintenanceWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private readonly logger = new Logger(MaintenanceWorker.name);
  constructor(private readonly service: MaintenanceService) {}
  async onApplicationBootstrap() {
    const env = readEnvironment();
    if (env.nodeEnv === "test" || !env.maintenanceWorkerEnabled) return;
    await this.tick();
    this.timer = setInterval(() => void this.tick(), env.maintenanceIntervalMs);
    this.timer.unref();
  }
  tick(): Promise<void> {
    if (this.running) return this.running;
    this.running = this.service
      .run()
      .then(() => {})
      .catch(() => {
        this.logger.error(
          "Bakım çalıştırılamadı; izleyen aralıkta tekrar denenecek.",
        );
      })
      .finally(() => {
        this.running = undefined;
      });
    return this.running;
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.running;
  }
}
