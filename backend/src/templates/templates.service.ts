import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import {
  JurisdictionsService,
  ROSARIO_JURISDICTION_CODE,
} from "../jurisdictions/jurisdictions.service";
import {
  CreateObligationTemplateDto,
  UpdateObligationTemplateDto,
  ObligationTemplateResponseDto,
  TemplateSummaryDto,
  ApplyTemplatesDto,
  ApplyTemplatesResultDto,
  TemplateQueryDto,
  RubricDto,
  ChecklistItemDto,
} from "./dto/template.dto";
import {
  PaginationDto,
  PaginatedResponse,
  createPaginatedResponse,
} from "../common/dto/pagination.dto";
import { Prisma, ObligationStatus, TaskStatus } from "@prisma/client";

type TemplateWithChecklist = Prisma.ObligationTemplateGetPayload<{
  include: {
    checklistItems: true;
  };
}>;

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jurisdictionsService: JurisdictionsService,
  ) {}

  async create(
    dto: CreateObligationTemplateDto,
  ): Promise<ObligationTemplateResponseDto> {
    // Verificar que la jurisdiccion existe
    await this.jurisdictionsService.findOne(dto.jurisdictionId);

    const template = await this.prisma.obligationTemplate.create({
      data: {
        jurisdictionId: dto.jurisdictionId,
        templateKey: dto.templateKey,
        rubric: dto.rubric.toLowerCase(),
        title: dto.title,
        description: dto.description,
        type: dto.type,
        defaultPeriodicity: dto.defaultPeriodicity,
        defaultDueRule: dto.defaultDueRule,
        requiresReview: dto.requiresReview,
        requiredEvidenceCount: dto.requiredEvidenceCount,
        severity: dto.severity,
        references: dto.references
          ? (dto.references as Prisma.InputJsonValue)
          : undefined,
        isActive: true,
      },
      include: {
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Crear checklist items si se proporcionaron
    if (dto.checklist && dto.checklist.length > 0) {
      await this.createChecklistItems(template.id, dto.checklist);
    }

    return this.findOne(template.id);
  }

  async findAll(
    query: TemplateQueryDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<TemplateSummaryDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ObligationTemplateWhereInput = {};

    if (query.jurisdictionId) {
      where.jurisdictionId = query.jurisdictionId;
    }
    if (query.rubric) {
      where.rubric = query.rubric.toLowerCase();
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.activeOnly !== false) {
      where.isActive = true;
    }

    const [templates, total] = await Promise.all([
      this.prisma.obligationTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ rubric: "asc" }, { title: "asc" }],
        include: {
          _count: {
            select: { checklistItems: true },
          },
        },
      }),
      this.prisma.obligationTemplate.count({ where }),
    ]);

    const data = templates.map((t) => ({
      id: t.id,
      templateKey: t.templateKey,
      title: t.title,
      rubric: t.rubric,
      type: t.type,
      defaultPeriodicity: t.defaultPeriodicity,
      severity: t.severity,
      checklistItemCount: t._count.checklistItems,
    }));

    return createPaginatedResponse(data, total, page, limit);
  }

  async findByJurisdictionAndRubric(
    jurisdictionId: string,
    rubric: string,
  ): Promise<TemplateSummaryDto[]> {
    const templates = await this.prisma.obligationTemplate.findMany({
      where: {
        jurisdictionId,
        rubric: rubric.toLowerCase(),
        isActive: true,
      },
      orderBy: { title: "asc" },
      include: {
        _count: {
          select: { checklistItems: true },
        },
      },
    });

    return templates.map((t) => ({
      id: t.id,
      templateKey: t.templateKey,
      title: t.title,
      rubric: t.rubric,
      type: t.type,
      defaultPeriodicity: t.defaultPeriodicity,
      severity: t.severity,
      checklistItemCount: t._count.checklistItems,
    }));
  }

  async findOne(id: string): Promise<ObligationTemplateResponseDto> {
    const template = await this.prisma.obligationTemplate.findUnique({
      where: { id },
      include: {
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template no encontrado: ${id}`);
    }

    return this.toResponseDto(template);
  }

  async findByKey(templateKey: string): Promise<ObligationTemplateResponseDto> {
    const template = await this.prisma.obligationTemplate.findUnique({
      where: { templateKey },
      include: {
        checklistItems: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!template) {
      throw new NotFoundException(
        `Template no encontrado con key: ${templateKey}`,
      );
    }

    return this.toResponseDto(template);
  }

  async update(
    id: string,
    dto: UpdateObligationTemplateDto,
  ): Promise<ObligationTemplateResponseDto> {
    await this.findOne(id);

    const { checklist, references, ...rest } = dto;
    const updateData: Prisma.ObligationTemplateUpdateInput = {
      ...rest,
      ...(references
        ? { references: references as Prisma.InputJsonValue }
        : {}),
    };

    // Incrementar version si hay cambios sustanciales
    if (dto.title || dto.description || dto.checklist) {
      updateData.version = { increment: 1 };
    }

    // Manejar checklist por separado
    await this.prisma.obligationTemplate.update({
      where: { id },
      data: updateData,
    });

    // Actualizar checklist si se proporciono
    if (checklist) {
      await this.prisma.checklistTemplateItem.deleteMany({
        where: { obligationTemplateId: id },
      });
      await this.createChecklistItems(id, checklist);
    }

    return this.findOne(id);
  }

  async deactivate(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.obligationTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getRubrics(jurisdictionId?: string): Promise<RubricDto[]> {
    const where: Prisma.ObligationTemplateWhereInput = { isActive: true };
    if (jurisdictionId) {
      where.jurisdictionId = jurisdictionId;
    }

    const rubrics = await this.prisma.obligationTemplate.groupBy({
      by: ["rubric"],
      where,
      _count: { id: true },
    });

    // Mapeo de nombres para display
    const rubricNames: Record<string, string> = {
      gastronomia: "Gastronomia",
      comercio: "Comercio General",
      estetica: "Estetica y Spa",
      farmacia: "Farmacia",
      salud: "Salud",
      educacion: "Educacion",
      hoteleria: "Hoteleria",
      construccion: "Construccion",
      transporte: "Transporte",
      otros: "Otros",
    };

    return rubrics.map((r) => ({
      rubric: r.rubric,
      displayName:
        rubricNames[r.rubric] ||
        r.rubric.charAt(0).toUpperCase() + r.rubric.slice(1),
      templateCount: r._count.id,
    }));
  }

  // === METODO PRINCIPAL: Aplicar plantillas a una organizacion ===
  async applyToOrganization(
    organizationId: string,
    dto: ApplyTemplatesDto,
    requestingUserId: string,
  ): Promise<ApplyTemplatesResultDto> {
    // Obtener la organizacion
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        jurisdiction: true,
        userOrgs: {
          where: { userId: requestingUserId },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(
        `Organizacion no encontrada: ${organizationId}`,
      );
    }

    // Determinar jurisdiccion a usar
    let jurisdictionId = dto.jurisdictionId;
    if (!jurisdictionId) {
      if (organization.jurisdictionId) {
        jurisdictionId = organization.jurisdictionId;
      } else {
        // Usar Rosario por defecto
        const defaultJurisdiction = await this.jurisdictionsService.findByCode(
          ROSARIO_JURISDICTION_CODE,
        );
        jurisdictionId = defaultJurisdiction.id;
      }
    }

    // Determinar owner de las obligaciones
    const ownerUserId = dto.ownerUserId || requestingUserId;

    // Obtener templates a aplicar
    let templates;
    if (dto.templateIds && dto.templateIds.length > 0) {
      templates = await this.prisma.obligationTemplate.findMany({
        where: {
          id: { in: dto.templateIds },
          isActive: true,
        },
        include: {
          checklistItems: {
            orderBy: { order: "asc" },
          },
        },
      });
    } else {
      templates = await this.prisma.obligationTemplate.findMany({
        where: {
          jurisdictionId,
          rubric: dto.rubric.toLowerCase(),
          isActive: true,
        },
        include: {
          checklistItems: {
            orderBy: { order: "asc" },
          },
        },
      });
    }

    if (templates.length === 0) {
      throw new BadRequestException(
        `No se encontraron plantillas para el rubro "${dto.rubric}" en la jurisdiccion seleccionada`,
      );
    }

    // Verificar que no existan obligaciones duplicadas (por templateKey)
    const existingObligations = await this.prisma.obligation.findMany({
      where: {
        organizationId,
        locationId: dto.locationId || null,
      },
      select: { title: true },
    });
    const existingTitles = new Set(existingObligations.map((o) => o.title));

    const result: ApplyTemplatesResultDto = {
      obligationsCreated: 0,
      tasksCreated: 0,
      obligationIds: [],
    };

    // Crear obligaciones y tareas
    for (const template of templates) {
      // Evitar duplicados basados en titulo
      if (existingTitles.has(template.title)) {
        continue;
      }

      // Calcular fecha de vencimiento inicial basada en periodicidad
      const dueDate = this.calculateInitialDueDate(template.defaultPeriodicity);

      // Crear obligacion
      const obligation = await this.prisma.obligation.create({
        data: {
          organizationId,
          locationId: dto.locationId || null,
          title: template.title,
          description: template.description,
          type: template.type,
          status: ObligationStatus.PENDING,
          dueDate,
          recurrenceRule: this.periodicityToRecurrenceRule(
            template.defaultPeriodicity,
          ),
          requiresReview: template.requiresReview,
          requiredEvidenceCount: template.requiredEvidenceCount,
          ownerUserId,
        },
      });

      result.obligationIds.push(obligation.id);
      result.obligationsCreated++;

      // Crear tarea con checklist si hay items
      if (template.checklistItems.length > 0) {
        const task = await this.prisma.task.create({
          data: {
            obligationId: obligation.id,
            assignedToUserId: ownerUserId,
            title: `Checklist: ${template.title}`,
            description:
              template.defaultDueRule || "Completar los items del checklist",
            status: TaskStatus.OPEN,
            dueDate,
          },
        });

        // Crear items de checklist
        await this.prisma.taskItem.createMany({
          data: template.checklistItems.map((item) => ({
            taskId: task.id,
            description: item.description,
            order: item.order,
            done: false,
          })),
        });

        result.tasksCreated++;
      }
    }

    return result;
  }

  // === Helpers ===

  private async createChecklistItems(
    templateId: string,
    items: ChecklistItemDto[],
  ): Promise<void> {
    await this.prisma.checklistTemplateItem.createMany({
      data: items.map((item, index) => ({
        obligationTemplateId: templateId,
        description: item.description,
        order: index,
        isRequired: item.isRequired,
      })),
    });
  }

  private calculateInitialDueDate(periodicity: string): Date {
    const now = new Date();
    const dueDate = new Date(now);

    switch (periodicity) {
      case "WEEKLY":
        dueDate.setDate(now.getDate() + 7);
        break;
      case "BIWEEKLY":
        dueDate.setDate(now.getDate() + 14);
        break;
      case "MONTHLY":
        dueDate.setMonth(now.getMonth() + 1);
        break;
      case "BIMONTHLY":
        dueDate.setMonth(now.getMonth() + 2);
        break;
      case "QUARTERLY":
        dueDate.setMonth(now.getMonth() + 3);
        break;
      case "SEMIANNUAL":
        dueDate.setMonth(now.getMonth() + 6);
        break;
      case "ANNUAL":
        dueDate.setFullYear(now.getFullYear() + 1);
        break;
      case "BIENNIAL":
        dueDate.setFullYear(now.getFullYear() + 2);
        break;
      case "ONE_TIME":
        dueDate.setMonth(now.getMonth() + 1); // 1 mes por defecto
        break;
      default:
        dueDate.setFullYear(now.getFullYear() + 1);
    }

    return dueDate;
  }

  private periodicityToRecurrenceRule(periodicity: string): string | null {
    // Convertir a formato iCalendar RRULE
    const rules: Record<string, string | null> = {
      WEEKLY: "FREQ=WEEKLY;INTERVAL=1",
      BIWEEKLY: "FREQ=WEEKLY;INTERVAL=2",
      MONTHLY: "FREQ=MONTHLY;INTERVAL=1",
      BIMONTHLY: "FREQ=MONTHLY;INTERVAL=2",
      QUARTERLY: "FREQ=MONTHLY;INTERVAL=3",
      SEMIANNUAL: "FREQ=MONTHLY;INTERVAL=6",
      ANNUAL: "FREQ=YEARLY;INTERVAL=1",
      BIENNIAL: "FREQ=YEARLY;INTERVAL=2",
      ONE_TIME: null,
    };

    return rules[periodicity] || null;
  }

  private toResponseDto(
    template: TemplateWithChecklist,
  ): ObligationTemplateResponseDto {
    return {
      id: template.id,
      jurisdictionId: template.jurisdictionId,
      templateKey: template.templateKey,
      rubric: template.rubric,
      title: template.title,
      description: template.description,
      type: template.type,
      defaultPeriodicity: template.defaultPeriodicity,
      defaultDueRule: template.defaultDueRule,
      requiresReview: template.requiresReview,
      requiredEvidenceCount: template.requiredEvidenceCount,
      severity: template.severity,
      references: template.references,
      version: template.version,
      changelog: template.changelog,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      checklistItems: template.checklistItems?.map((item) => ({
        id: item.id,
        description: item.description,
        order: item.order,
        isRequired: item.isRequired,
      })),
    };
  }
}
