import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Res,
  Header,
} from "@nestjs/common";
import { Response } from "express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiProduces,
} from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { ReportsService } from "./reports.service";
import {
  ReportFilterDto,
  ComplianceReportDto,
  ObligationReportItemDto,
} from "./dto/report.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrganizationGuard } from "../common/guards/organization.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";

@ApiTags("reports")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
@Controller("organizations/:organizationId/reports")
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get("compliance")
  @ApiOperation({ summary: "Obtener reporte de cumplimiento" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Reporte de cumplimiento",
    type: ComplianceReportDto,
  })
  async getComplianceReport(
    @Param("organizationId") organizationId: string,
    @Query() filters: ReportFilterDto,
  ): Promise<ComplianceReportDto> {
    return this.reportsService.getComplianceReport(organizationId, filters);
  }

  @Get("obligations")
  @ApiOperation({ summary: "Obtener lista de obligaciones para reporte" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Lista de obligaciones",
    type: [ObligationReportItemDto],
  })
  async getObligationsReport(
    @Param("organizationId") organizationId: string,
    @Query() filters: ReportFilterDto,
  ): Promise<ObligationReportItemDto[]> {
    return this.reportsService.getObligationsReport(organizationId, filters);
  }

  @Get("export/csv")
  @ApiOperation({ summary: "Exportar obligaciones a CSV" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiProduces("text/csv")
  @ApiResponse({ status: 200, description: "Archivo CSV" })
  @Header("Content-Type", "text/csv")
  async exportToCsv(
    @Param("organizationId") organizationId: string,
    @Query() filters: ReportFilterDto,
    @Res() res: Response,
  ): Promise<void> {
    const csv = await this.reportsService.exportToCsv(organizationId, filters);
    const fileName = `obligaciones_${organizationId}_${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csv);
  }
}
