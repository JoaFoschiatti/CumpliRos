import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CreateJurisdictionDto,
  UpdateJurisdictionDto,
  JurisdictionResponseDto,
  JurisdictionSummaryDto,
} from './dto/jurisdiction.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

// ID fijo de Rosario para compatibilidad hacia atras
export const ROSARIO_JURISDICTION_ID = '00000000-0000-0000-0000-000000000001';
export const ROSARIO_JURISDICTION_CODE = 'ar-sf-rosario';

@Injectable()
export class JurisdictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateJurisdictionDto): Promise<JurisdictionResponseDto> {
    // Verificar que el codigo no exista
    const existing = await this.prisma.jurisdiction.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new ConflictException(`Ya existe una jurisdiccion con el codigo: ${dto.code}`);
    }

    const jurisdiction = await this.prisma.jurisdiction.create({
      data: {
        code: dto.code,
        name: dto.name,
        country: dto.country || 'AR',
        province: dto.province,
        isActive: true,
      },
    });

    return this.toResponseDto(jurisdiction);
  }

  async findAll(pagination: PaginationDto, activeOnly = true): Promise<PaginatedResponse<JurisdictionResponseDto>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const where = activeOnly ? { isActive: true } : {};

    const [jurisdictions, total] = await Promise.all([
      this.prisma.jurisdiction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              obligationTemplates: true,
              organizations: true,
            },
          },
        },
      }),
      this.prisma.jurisdiction.count({ where }),
    ]);

    const data = jurisdictions.map((j) => this.toResponseDto(j, j._count));
    return createPaginatedResponse(data, total, page, limit);
  }

  async findAllActive(): Promise<JurisdictionSummaryDto[]> {
    const jurisdictions = await this.prisma.jurisdiction.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        province: true,
      },
    });

    return jurisdictions;
  }

  async findOne(id: string): Promise<JurisdictionResponseDto> {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            obligationTemplates: true,
            organizations: true,
          },
        },
      },
    });

    if (!jurisdiction) {
      throw new NotFoundException(`Jurisdiccion no encontrada: ${id}`);
    }

    return this.toResponseDto(jurisdiction, jurisdiction._count);
  }

  async findByCode(code: string): Promise<JurisdictionResponseDto> {
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { code },
      include: {
        _count: {
          select: {
            obligationTemplates: true,
            organizations: true,
          },
        },
      },
    });

    if (!jurisdiction) {
      throw new NotFoundException(`Jurisdiccion no encontrada con codigo: ${code}`);
    }

    return this.toResponseDto(jurisdiction, jurisdiction._count);
  }

  async update(id: string, dto: UpdateJurisdictionDto): Promise<JurisdictionResponseDto> {
    // Verificar que existe
    await this.findOne(id);

    // Si se cambia el codigo, verificar que no exista
    if (dto.code) {
      const existing = await this.prisma.jurisdiction.findFirst({
        where: {
          code: dto.code,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`Ya existe una jurisdiccion con el codigo: ${dto.code}`);
      }
    }

    const jurisdiction = await this.prisma.jurisdiction.update({
      where: { id },
      data: dto,
      include: {
        _count: {
          select: {
            obligationTemplates: true,
            organizations: true,
          },
        },
      },
    });

    return this.toResponseDto(jurisdiction, jurisdiction._count);
  }

  async deactivate(id: string): Promise<void> {
    await this.findOne(id);

    await this.prisma.jurisdiction.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getDefaultJurisdiction(): Promise<JurisdictionResponseDto | null> {
    // Rosario es la jurisdiccion por defecto
    const jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { code: ROSARIO_JURISDICTION_CODE },
      include: {
        _count: {
          select: {
            obligationTemplates: true,
            organizations: true,
          },
        },
      },
    });

    if (!jurisdiction) {
      return null;
    }

    return this.toResponseDto(jurisdiction, jurisdiction._count);
  }

  async getOrCreateDefault(): Promise<JurisdictionResponseDto> {
    let jurisdiction = await this.prisma.jurisdiction.findUnique({
      where: { code: ROSARIO_JURISDICTION_CODE },
    });

    if (!jurisdiction) {
      jurisdiction = await this.prisma.jurisdiction.create({
        data: {
          id: ROSARIO_JURISDICTION_ID,
          code: ROSARIO_JURISDICTION_CODE,
          name: 'Rosario',
          country: 'AR',
          province: 'Santa Fe',
          isActive: true,
        },
      });
    }

    return this.toResponseDto(jurisdiction);
  }

  private toResponseDto(
    jurisdiction: any,
    counts?: { obligationTemplates: number; organizations: number },
  ): JurisdictionResponseDto {
    return {
      id: jurisdiction.id,
      code: jurisdiction.code,
      name: jurisdiction.name,
      country: jurisdiction.country,
      province: jurisdiction.province,
      isActive: jurisdiction.isActive,
      createdAt: jurisdiction.createdAt,
      updatedAt: jurisdiction.updatedAt,
      templateCount: counts?.obligationTemplates,
      organizationCount: counts?.organizations,
    };
  }
}
