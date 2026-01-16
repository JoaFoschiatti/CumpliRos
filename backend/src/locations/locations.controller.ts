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
import { Role } from '@prisma/client';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto, LocationResponseDto } from './dto/location.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('locations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear nuevo local' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Local creado', type: LocationResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LocationResponseDto> {
    return this.locationsService.create(organizationId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar locales de la organización' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  @ApiResponse({ status: 200, description: 'Lista de locales' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('includeInactive') includeInactive?: boolean,
  ): Promise<PaginatedResponse<LocationResponseDto>> {
    return this.locationsService.findAll(organizationId, pagination, includeInactive);
  }

  @Get(':locationId')
  @ApiOperation({ summary: 'Obtener detalles de local' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detalles del local', type: LocationResponseDto })
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('locationId') locationId: string,
  ): Promise<LocationResponseDto> {
    return this.locationsService.findOne(organizationId, locationId);
  }

  @Patch(':locationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar local' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Local actualizado', type: LocationResponseDto })
  async update(
    @Param('organizationId') organizationId: string,
    @Param('locationId') locationId: string,
    @Body() dto: UpdateLocationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LocationResponseDto> {
    return this.locationsService.update(organizationId, locationId, dto, user.id);
  }

  @Delete(':locationId')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar local' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'locationId', type: 'string' })
  @ApiResponse({ status: 204, description: 'Local desactivado' })
  async deactivate(
    @Param('organizationId') organizationId: string,
    @Param('locationId') locationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.locationsService.deactivate(organizationId, locationId, user.id);
  }
}
