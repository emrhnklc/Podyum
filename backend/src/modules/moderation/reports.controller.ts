import { Body, Controller, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuthenticatedUser } from "../../common/http/request-context.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { CreateReportDto, ReportReceiptDto } from "./dto/reports.dto.js";
import { ReportsService } from "./reports.service.js";

@ApiTags("moderation")
@ApiBearerAuth()
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post("reports")
  @ApiCreatedResponse({ type: ReportReceiptDto })
  @ApiOperation({ summary: "Görebildiğin paylaşımı, yorumu veya kullanıcıyı şikâyet et; aynı hedefin tekrarı ilk kaydı döndürür" })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateReportDto) { return this.reports.create(user.userId, body); }
}
