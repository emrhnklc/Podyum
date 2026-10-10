import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service.js";
import { Public } from "../auth/decorators/public.decorator.js";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get("live")
  @ApiOkResponse({ schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["ok"] } } } })
  liveness() {
    return { status: "ok" };
  }

  @Get("ready")
  @ApiOkResponse({ schema: { type: "object", required: ["status", "database"], properties: { status: { type: "string", enum: ["ok"] }, database: { type: "string", enum: ["connected"] } } } })
  readiness() {
    return this.health.readiness();
  }
}
