import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Role, ObligationStatus } from '@prisma/client';
import { ObligationsService } from './obligations.service';
import {
  CreateObligationDto,
  UpdateObligationDto,
  ObligationFilterDto,
  ObligationResponseDto,
  ObligationDashboardDto,
} from './dto/obligation.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('obligations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/obligations')
export class ObligationsController {
  constructor(private readonly obligationsService: ObligationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear nueva obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Obligación creada', type: ObligationResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateObligationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ObligationResponseDto> {
    return this.obligationsService.create(organizationId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar obligaciones de la organización' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Lista de obligaciones' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query() filters: ObligationFilterDto,
  ): Promise<PaginatedResponse<ObligationResponseDto>> {
    return this.obligationsService.findAll(organizationId, pagination, filters);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Obtener tablero de cumplimiento con semáforo' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Dashboard de obligaciones', type: ObligationDashboardDto })
  async getDashboard(
    @Param('organizationId') organizationId: string,
  ): Promise<ObligationDashboardDto> {
    return this.obligationsService.getDashboard(organizationId);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Obtener eventos para calendario' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiQuery({ name: 'startDate', type: Date })
  @ApiQuery({ name: 'endDate', type: Date })
  @ApiResponse({ status: 200, description: 'Eventos de calendario' })
  async getCalendarEvents(
    @Param('organizationId') organizationId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ObligationResponseDto[]> {
    return this.obligationsService.getCalendarEvents(
      organizationId,
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get(':obligationId')
  @ApiOperation({ summary: 'Obtener detalles de obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'obligationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detalles de la obligación', type: ObligationResponseDto })
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('obligationId') obligationId: string,
  ): Promise<ObligationResponseDto> {
    return this.obligationsService.findOne(organizationId, obligationId);
  }

  @Patch(':obligationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'obligationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Obligación actualizada', type: ObligationResponseDto })
  async update(
    @Param('organizationId') organizationId: string,
    @Param('obligationId') obligationId: string,
    @Body() dto: UpdateObligationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ObligationResponseDto> {
    return this.obligationsService.update(organizationId, obligationId, dto, user.id);
  }

  @Patch(':obligationId/status')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER, Role.ACCOUNTANT)
  @ApiOperation({ summary: 'Cambiar estado de obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'obligationId', type: 'string' })
  @ApiQuery({ name: 'status', enum: ObligationStatus })
  @ApiResponse({ status: 200, description: 'Estado actualizado', type: ObligationResponseDto })
  async updateStatus(
    @Param('organizationId') organizationId: string,
    @Param('obligationId') obligationId: string,
    @Query('status') status: ObligationStatus,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ObligationResponseDto> {
    return this.obligationsService.updateStatus(organizationId, obligationId, status, user.id);
  }

  @Delete(':obligationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'obligationId', type: 'string' })
  @ApiResponse({ status: 204, description: 'Obligación eliminada' })
  async delete(
    @Param('organizationId') organizationId: string,
    @Param('obligationId') obligationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.obligationsService.delete(organizationId, obligationId, user.id);
  }
}
