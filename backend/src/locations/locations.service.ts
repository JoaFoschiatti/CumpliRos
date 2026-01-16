import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditActions } from '../audit/dto/audit.dto';
import { CreateLocationDto, UpdateLocationDto, LocationResponseDto } from './dto/location.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class LocationsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(organizationId: string, dto: CreateLocationDto, userId?: string): Promise<LocationResponseDto> {
    // Check for duplicate name in same organization
    const existing = await this.prisma.location.findFirst({
      where: {
        organizationId,
        name: dto.name,
        active: true,
      },
    });

    if (existing) {
      throw new ConflictException('Ya existe un local con ese nombre en esta organización');
    }

    const location = await this.prisma.location.create({
      data: {
        organizationId,
        name: dto.name,
        address: dto.address,
        rubric: dto.rubric,
      },
      include: {
        _count: {
          select: { obligations: true },
        },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.LOCATION_CREATED,
      'Location',
      location.id,
      userId,
      { name: location.name, rubric: location.rubric ?? undefined },
    );

    return location;
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    includeInactive = false,
  ): Promise<PaginatedResponse<LocationResponseDto>> {
    const where = {
      organizationId,
      ...(includeInactive ? {} : { active: true }),
    };

    const [locations, total] = await Promise.all([
      this.prisma.location.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { obligations: true },
          },
        },
      }),
      this.prisma.location.count({ where }),
    ]);

    return createPaginatedResponse(locations, total, pagination.page!, pagination.limit!);
  }

  async findOne(organizationId: string, locationId: string): Promise<LocationResponseDto> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
      include: {
        _count: {
          select: { obligations: true },
        },
      },
    });

    if (!location) {
      throw new NotFoundException('Local no encontrado');
    }

    return location;
  }

  async update(
    organizationId: string,
    locationId: string,
    dto: UpdateLocationDto,
    userId?: string,
  ): Promise<LocationResponseDto> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new NotFoundException('Local no encontrado');
    }

    // Check for duplicate name if changing name
    if (dto.name && dto.name !== location.name) {
      const existing = await this.prisma.location.findFirst({
        where: {
          organizationId,
          name: dto.name,
          active: true,
          id: { not: locationId },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otro local con ese nombre');
      }
    }

    const updated = await this.prisma.location.update({
      where: { id: locationId },
      data: dto,
      include: {
        _count: {
          select: { obligations: true },
        },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.LOCATION_UPDATED,
      'Location',
      locationId,
      userId,
      { changes: dto },
    );

    return updated;
  }

  async deactivate(organizationId: string, locationId: string, userId?: string): Promise<void> {
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId,
      },
    });

    if (!location) {
      throw new NotFoundException('Local no encontrado');
    }

    await this.prisma.location.update({
      where: { id: locationId },
      data: { active: false },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.LOCATION_DEACTIVATED,
      'Location',
      locationId,
      userId,
    );
  }
}
