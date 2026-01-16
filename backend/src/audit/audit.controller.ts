import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditFilterDto, AuditEventResponseDto } from './dto/audit.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN, Role.ACCOUNTANT)
@Controller('organizations/:organizationId/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar log de auditoría' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Eventos de auditoría' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query() filters: AuditFilterDto,
  ): Promise<PaginatedResponse<AuditEventResponseDto>> {
    return this.auditService.findAll(organizationId, pagination, filters);
  }

  @Get(':entityType/:entityId')
  @ApiOperation({ summary: 'Consultar historial de una entidad' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'entityType', type: 'string' })
  @ApiParam({ name: 'entityId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Historial de la entidad' })
  async findByEntity(
    @Param('organizationId') organizationId: string,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<AuditEventResponseDto>> {
    return this.auditService.findByEntity(organizationId, entityType, entityId, pagination);
  }
}
