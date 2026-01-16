import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuditActions } from "../audit/dto/audit.dto";
import {
  Prisma,
  ObligationStatus,
  Obligation,
  Organization,
} from "@prisma/client";
import {
  CreateObligationDto,
  UpdateObligationDto,
  ObligationFilterDto,
  ObligationResponseDto,
  ObligationDashboardDto,
  TrafficLight,
} from "./dto/obligation.dto";
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponse,
} from "../common/dto/pagination.dto";

@Injectable()
export class ObligationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  // Compute traffic light state based on due date, status, and org thresholds.
  calculateTrafficLight(
    dueDate: Date,
    status: ObligationStatus,
    thresholdYellow: number,
    thresholdRed: number,
  ): { trafficLight: TrafficLight; daysUntilDue: number } {
    if (
      status === ObligationStatus.COMPLETED ||
      status === ObligationStatus.NOT_APPLICABLE
    ) {
      return { trafficLight: TrafficLight.GREEN, daysUntilDue: 0 };
    }

    if (status === ObligationStatus.OVERDUE) {
      const daysUntilDue = Math.floor(
        (dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return { trafficLight: TrafficLight.RED, daysUntilDue };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const daysUntilDue = Math.floor(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDue < 0) {
      return { trafficLight: TrafficLight.RED, daysUntilDue };
    }

    if (daysUntilDue <= thresholdRed) {
      return { trafficLight: TrafficLight.RED, daysUntilDue };
    }

    if (daysUntilDue <= thresholdYellow) {
      return { trafficLight: TrafficLight.YELLOW, daysUntilDue };
    }

    return { trafficLight: TrafficLight.GREEN, daysUntilDue };
  }

  private enrichWithTrafficLight(
    obligation: Obligation & {
      organization?: Organization;
      location?: { id: string; name: string } | null;
      owner?: { id: string; fullName: string; email: string } | null;
      _count?: { documents: number; tasks: number; reviews: number };
    },
    organization: Organization,
  ): ObligationResponseDto {
    const { trafficLight, daysUntilDue } = this.calculateTrafficLight(
      obligation.dueDate,
      obligation.status,
      organization.thresholdYellowDays,
      organization.thresholdRedDays,
    );

    return {
      id: obligation.id,
      organizationId: obligation.organizationId,
      locationId: obligation.locationId ?? undefined,
      title: obligation.title,
      description: obligation.description ?? undefined,
      type: obligation.type,
      status: obligation.status,
      dueDate: obligation.dueDate,
      recurrenceRule: obligation.recurrenceRule ?? undefined,
      requiresReview: obligation.requiresReview,
      requiredEvidenceCount: obligation.requiredEvidenceCount,
      ownerUserId: obligation.ownerUserId,
      createdAt: obligation.createdAt,
      trafficLight,
      daysUntilDue,
      location: obligation.location ?? undefined,
      owner: obligation.owner ?? undefined,
      _count: obligation._count,
    };
  }

  async create(
    organizationId: string,
    dto: CreateObligationDto,
    userId?: string,
  ): Promise<ObligationResponseDto> {
    // Verify location belongs to organization if provided
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId, active: true },
      });
      if (!location) {
        throw new BadRequestException(
          "Local no encontrado o no pertenece a esta organización",
        );
      }
    }

    // Verify owner belongs to organization
    const ownerMembership = await this.prisma.userOrg.findFirst({
      where: { userId: dto.ownerUserId, organizationId },
    });
    if (!ownerMembership) {
      throw new BadRequestException(
        "El usuario responsable no pertenece a esta organización",
      );
    }

    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const obligation = await this.prisma.obligation.create({
      data: {
        organizationId,
        locationId: dto.locationId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        dueDate: dto.dueDate,
        recurrenceRule: dto.recurrenceRule,
        requiresReview: dto.requiresReview ?? false,
        requiredEvidenceCount: dto.requiredEvidenceCount ?? 0,
        ownerUserId: dto.ownerUserId,
      },
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.OBLIGATION_CREATED,
      "Obligation",
      obligation.id,
      userId,
      {
        title: obligation.title,
        type: obligation.type,
        dueDate: obligation.dueDate,
        ownerUserId: obligation.ownerUserId,
        locationId: obligation.locationId ?? undefined,
      },
    );

    return this.enrichWithTrafficLight(obligation, organization!);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters: ObligationFilterDto,
  ): Promise<PaginatedResponse<ObligationResponseDto>> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organización no encontrada");
    }

    const where: Prisma.ObligationWhereInput = { organizationId };

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.locationId) {
      where.locationId = filters.locationId;
    }
    if (filters.ownerUserId) {
      where.ownerUserId = filters.ownerUserId;
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {};
      if (filters.dueDateFrom) {
        where.dueDate.gte = filters.dueDateFrom;
      }
      if (filters.dueDateTo) {
        where.dueDate.lte = filters.dueDateTo;
      }
    }

    const [obligations, total] = await Promise.all([
      this.prisma.obligation.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { dueDate: pagination.sortOrder },
        include: {
          location: { select: { id: true, name: true } },
          owner: { select: { id: true, fullName: true, email: true } },
          _count: { select: { documents: true, tasks: true, reviews: true } },
        },
      }),
      this.prisma.obligation.count({ where }),
    ]);

    let enrichedObligations = obligations.map((o) =>
      this.enrichWithTrafficLight(o, organization),
    );

    // Filter by traffic light if specified
    if (filters.trafficLight) {
      enrichedObligations = enrichedObligations.filter(
        (o) => o.trafficLight === filters.trafficLight,
      );
    }

    return createPaginatedResponse(
      enrichedObligations,
      total,
      pagination.page!,
      pagination.limit!,
    );
  }

  async findOne(
    organizationId: string,
    obligationId: string,
  ): Promise<ObligationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const obligation = await this.prisma.obligation.findFirst({
      where: { id: obligationId, organizationId },
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
    });

    if (!obligation) {
      throw new NotFoundException("Obligación no encontrada");
    }

    return this.enrichWithTrafficLight(obligation, organization!);
  }

  async update(
    organizationId: string,
    obligationId: string,
    dto: UpdateObligationDto,
    userId?: string,
  ): Promise<ObligationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const existing = await this.prisma.obligation.findFirst({
      where: { id: obligationId, organizationId },
    });

    if (!existing) {
      throw new NotFoundException("Obligación no encontrada");
    }

    // Validate location if being updated
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, organizationId, active: true },
      });
      if (!location) {
        throw new BadRequestException(
          "Local no encontrado o no pertenece a esta organización",
        );
      }
    }

    // Validate owner if being updated
    if (dto.ownerUserId) {
      const ownerMembership = await this.prisma.userOrg.findFirst({
        where: { userId: dto.ownerUserId, organizationId },
      });
      if (!ownerMembership) {
        throw new BadRequestException(
          "El usuario responsable no pertenece a esta organización",
        );
      }
    }

    const obligation = await this.prisma.obligation.update({
      where: { id: obligationId },
      data: dto,
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.OBLIGATION_UPDATED,
      "Obligation",
      obligationId,
      userId,
      { changes: dto },
    );

    return this.enrichWithTrafficLight(obligation, organization!);
  }

  async updateStatus(
    organizationId: string,
    obligationId: string,
    status: ObligationStatus,
    userId?: string,
  ): Promise<ObligationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    const obligation = await this.prisma.obligation.findFirst({
      where: { id: obligationId, organizationId },
      include: {
        documents: true,
        reviews: { where: { status: "APPROVED" } },
      },
    });

    if (!obligation) {
      throw new NotFoundException("Obligación no encontrada");
    }

    // Enforce business rules before closing an obligation.
    if (status === ObligationStatus.COMPLETED) {
      // Check required evidence count
      if (obligation.requiredEvidenceCount > 0) {
        if (obligation.documents.length < obligation.requiredEvidenceCount) {
          throw new BadRequestException(
            `Se requieren al menos ${obligation.requiredEvidenceCount} evidencias para completar esta obligación`,
          );
        }
      }

      // Check if review is required and approved
      if (obligation.requiresReview) {
        if (obligation.reviews.length === 0) {
          throw new BadRequestException(
            "Esta obligación requiere aprobación antes de poder ser completada",
          );
        }
      }
    }

    const updated = await this.prisma.obligation.update({
      where: { id: obligationId },
      data: { status },
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.OBLIGATION_STATUS_CHANGED,
      "Obligation",
      obligationId,
      userId,
      { from: obligation.status, to: status },
    );

    return this.enrichWithTrafficLight(updated, organization!);
  }

  async delete(
    organizationId: string,
    obligationId: string,
    userId?: string,
  ): Promise<void> {
    const obligation = await this.prisma.obligation.findFirst({
      where: { id: obligationId, organizationId },
    });

    if (!obligation) {
      throw new NotFoundException("Obligación no encontrada");
    }

    await this.prisma.obligation.delete({
      where: { id: obligationId },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.OBLIGATION_DELETED,
      "Obligation",
      obligationId,
      userId,
      { title: obligation.title },
    );
  }

  async getDashboard(organizationId: string): Promise<ObligationDashboardDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organización no encontrada");
    }

    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);

    const obligations = await this.prisma.obligation.findMany({
      where: { organizationId },
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
    });

    const enriched = obligations.map((o) =>
      this.enrichWithTrafficLight(o, organization),
    );

    const total = enriched.length;
    const completed = enriched.filter(
      (o) => o.status === ObligationStatus.COMPLETED,
    ).length;
    const overdue = enriched.filter(
      (o) => o.status === ObligationStatus.OVERDUE,
    ).length;
    const red = enriched.filter(
      (o) =>
        o.trafficLight === TrafficLight.RED &&
        o.status !== ObligationStatus.COMPLETED,
    ).length;
    const yellow = enriched.filter(
      (o) =>
        o.trafficLight === TrafficLight.YELLOW &&
        o.status !== ObligationStatus.COMPLETED,
    ).length;
    const green = enriched.filter(
      (o) =>
        o.trafficLight === TrafficLight.GREEN &&
        o.status !== ObligationStatus.COMPLETED,
    ).length;

    const upcoming7Days = enriched
      .filter(
        (o) =>
          o.status !== ObligationStatus.COMPLETED &&
          o.status !== ObligationStatus.NOT_APPLICABLE &&
          o.daysUntilDue >= 0 &&
          o.daysUntilDue <= 7,
      )
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const overdueList = enriched
      .filter(
        (o) => o.status === ObligationStatus.OVERDUE || o.daysUntilDue < 0,
      )
      .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    return {
      total,
      overdue,
      red,
      yellow,
      green,
      completed,
      upcoming7Days,
      overdueList,
    };
  }

  async getCalendarEvents(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ObligationResponseDto[]> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundException("Organización no encontrada");
    }

    const obligations = await this.prisma.obligation.findMany({
      where: {
        organizationId,
        dueDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        location: { select: { id: true, name: true } },
        owner: { select: { id: true, fullName: true, email: true } },
        _count: { select: { documents: true, tasks: true, reviews: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return obligations.map((o) => this.enrichWithTrafficLight(o, organization));
  }

  // Job to update overdue status
  async updateOverdueObligations(): Promise<number> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const result = await this.prisma.obligation.updateMany({
      where: {
        status: {
          in: [ObligationStatus.PENDING, ObligationStatus.IN_PROGRESS],
        },
        dueDate: { lt: now },
      },
      data: { status: ObligationStatus.OVERDUE },
    });

    return result.count;
  }
}
