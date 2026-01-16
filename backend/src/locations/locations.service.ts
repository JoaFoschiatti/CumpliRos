import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { CreateLocationDto, UpdateLocationDto, LocationResponseDto } from './dto/location.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class LocationsService {
  constructor(private prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateLocationDto): Promise<LocationResponseDto> {
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

    return updated;
  }

  async deactivate(organizationId: string, locationId: string): Promise<void> {
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
  }
}
