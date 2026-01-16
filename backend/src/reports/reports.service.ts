import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import {
  Prisma,
  ObligationStatus,
  ObligationType,
  ReviewStatus,
} from "@prisma/client";
import {
  ReportFilterDto,
  ComplianceReportDto,
  ObligationReportItemDto,
} from "./dto/report.dto";

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getComplianceReport(
    organizationId: string,
    filters: ReportFilterDto,
  ): Promise<ComplianceReportDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organización no encontrada");
    }

    const fromDate =
      filters.fromDate ||
      new Date(new Date().setMonth(new Date().getMonth() - 1));
    const toDate = filters.toDate || new Date();

    const where: Prisma.ObligationWhereInput = {
      organizationId,
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    // Get all obligations in period
    const obligations = await this.prisma.obligation.findMany({
      where,
      include: {
        location: { select: { id: true, name: true } },
        reviews: { where: { status: ReviewStatus.APPROVED }, take: 1 },
      },
    });

    // Calculate summary
    const totalObligations = obligations.length;
    const completed = obligations.filter(
      (o) => o.status === ObligationStatus.COMPLETED,
    ).length;
    const pending = obligations.filter(
      (o) =>
        o.status === ObligationStatus.PENDING ||
        o.status === ObligationStatus.IN_PROGRESS,
    ).length;
    const overdue = obligations.filter(
      (o) => o.status === ObligationStatus.OVERDUE,
    ).length;
    const complianceRate =
      totalObligations > 0
        ? Math.round((completed / totalObligations) * 100)
        : 0;

    // By type
    const typeGroups = new Map<
      ObligationType,
      { total: number; completed: number }
    >();
    for (const obl of obligations) {
      if (!typeGroups.has(obl.type)) {
        typeGroups.set(obl.type, { total: 0, completed: 0 });
      }
      const group = typeGroups.get(obl.type)!;
      group.total++;
      if (obl.status === ObligationStatus.COMPLETED) {
        group.completed++;
      }
    }

    const byType = Array.from(typeGroups.entries()).map(([type, data]) => ({
      type,
      total: data.total,
      completed: data.completed,
      complianceRate:
        data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    // By location
    const locationGroups = new Map<
      string,
      { name: string; total: number; completed: number; overdue: number }
    >();
    for (const obl of obligations) {
      const locId = obl.locationId || "global";
      const locName = obl.location?.name || "Global (Organización)";
      if (!locationGroups.has(locId)) {
        locationGroups.set(locId, {
          name: locName,
          total: 0,
          completed: 0,
          overdue: 0,
        });
      }
      const group = locationGroups.get(locId)!;
      group.total++;
      if (obl.status === ObligationStatus.COMPLETED) {
        group.completed++;
      }
      if (obl.status === ObligationStatus.OVERDUE) {
        group.overdue++;
      }
    }

    const byLocation = Array.from(locationGroups.entries()).map(
      ([locationId, data]) => ({
        locationId,
        locationName: data.name,
        total: data.total,
        completed: data.completed,
        overdue: data.overdue,
        complianceRate:
          data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      }),
    );

    // Timeline (grouped by week)
    const timelineMap = new Map<
      string,
      { completed: number; overdue: number }
    >();
    for (const obl of obligations) {
      const weekStart = this.getWeekStart(obl.dueDate);
      const key = weekStart.toISOString().split("T")[0];
      if (!timelineMap.has(key)) {
        timelineMap.set(key, { completed: 0, overdue: 0 });
      }
      const entry = timelineMap.get(key)!;
      if (obl.status === ObligationStatus.COMPLETED) {
        entry.completed++;
      }
      if (obl.status === ObligationStatus.OVERDUE) {
        entry.overdue++;
      }
    }

    const timeline = Array.from(timelineMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      period: { from: fromDate, to: toDate },
      summary: {
        totalObligations,
        completed,
        pending,
        overdue,
        complianceRate,
      },
      byType,
      byLocation,
      timeline,
    };
  }

  async getObligationsReport(
    organizationId: string,
    filters: ReportFilterDto,
  ): Promise<ObligationReportItemDto[]> {
    const where: Prisma.ObligationWhereInput = { organizationId };

    if (filters.fromDate || filters.toDate) {
      where.dueDate = {};
      if (filters.fromDate) {
        where.dueDate.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.dueDate.lte = filters.toDate;
      }
    }

    if (filters.locationId) {
      where.locationId = filters.locationId;
    }

    const obligations = await this.prisma.obligation.findMany({
      where,
      include: {
        location: { select: { name: true } },
        owner: { select: { fullName: true } },
        reviews: { where: { status: ReviewStatus.APPROVED }, take: 1 },
        _count: { select: { documents: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return obligations.map((o) => ({
      id: o.id,
      title: o.title,
      type: o.type,
      status: o.status,
      dueDate: o.dueDate,
      locationName: o.location?.name,
      ownerName: o.owner.fullName,
      documentsCount: o._count.documents,
      hasApprovedReview: o.reviews.length > 0,
    }));
  }

  async exportToCsv(
    organizationId: string,
    filters: ReportFilterDto,
  ): Promise<string> {
    const obligations = await this.getObligationsReport(
      organizationId,
      filters,
    );

    const headers = [
      "ID",
      "Título",
      "Tipo",
      "Estado",
      "Fecha de Vencimiento",
      "Local",
      "Responsable",
      "Documentos",
      "Revisión Aprobada",
    ];

    const rows = obligations.map((o) => [
      o.id,
      this.sanitizeCsvField(o.title),
      o.type,
      o.status,
      o.dueDate.toISOString().split("T")[0],
      this.sanitizeCsvField(o.locationName) || "Global",
      this.sanitizeCsvField(o.ownerName),
      o.documentsCount.toString(),
      o.hasApprovedReview ? "Sí" : "No",
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return csv;
  }

  /**
   * Sanitize CSV field to prevent formula injection attacks
   * Prefixes dangerous characters with a single quote
   */
  private sanitizeCsvField(field: string | null | undefined): string {
    if (!field) return "";

    // Escape double quotes
    let sanitized = field.replace(/"/g, '""');

    // Prevent formula injection - prefix with ' if starts with dangerous characters
    if (/^[=+\-@\t\r]/.test(sanitized)) {
      sanitized = `'${sanitized}`;
    }

    return `"${sanitized}"`;
  }

  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }
}
