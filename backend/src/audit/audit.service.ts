import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditFilterDto, AuditEventResponseDto, AuditAction } from './dto/audit.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(
    organizationId: string,
    action: AuditAction | string,
    entityType: string,
    entityId?: string,
    userId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        organizationId,
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata ?? undefined,
        ipAddress,
        userAgent,
      },
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters: AuditFilterDto,
  ): Promise<PaginatedResponse<AuditEventResponseDto>> {
    const where: any = { organizationId };

    if (filters.action) {
      where.action = { contains: filters.action };
    }
    if (filters.entityType) {
      where.entityType = filters.entityType;
    }
    if (filters.entityId) {
      where.entityId = filters.entityId;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate;
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    const enrichedEvents = events.map((e) => this.enrichEvent(e));

    return createPaginatedResponse(enrichedEvents, total, pagination.page!, pagination.limit!);
  }

  async findByEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<AuditEventResponseDto>> {
    const where = { organizationId, entityType, entityId };

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    const enrichedEvents = events.map((e) => this.enrichEvent(e));

    return createPaginatedResponse(enrichedEvents, total, pagination.page!, pagination.limit!);
  }

  private enrichEvent(event: any): AuditEventResponseDto {
    return {
      id: event.id,
      organizationId: event.organizationId,
      userId: event.userId ?? undefined,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? undefined,
      metadata: event.metadata ?? undefined,
      ipAddress: event.ipAddress ?? undefined,
      userAgent: event.userAgent ?? undefined,
      createdAt: event.createdAt,
      user: event.user ?? undefined,
    };
  }
}
