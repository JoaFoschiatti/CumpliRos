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
import { TemplatesService } from './templates.service';
import {
  CreateObligationTemplateDto,
  UpdateObligationTemplateDto,
  ObligationTemplateResponseDto,
  TemplateSummaryDto,
  ApplyTemplatesDto,
  ApplyTemplatesResultDto,
  TemplateQueryDto,
  RubricDto,
} from './dto/template.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('templates')
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Listar plantillas de obligaciones' })
  @ApiResponse({ status: 200, description: 'Lista paginada de plantillas' })
  async findAll(
    @Query() query: TemplateQueryDto,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<TemplateSummaryDto>> {
    return this.templatesService.findAll(query, pagination);
  }

  @Get('rubrics')
  @Public()
  @ApiOperation({ summary: 'Listar rubros disponibles con cantidad de plantillas' })
  @ApiQuery({ name: 'jurisdictionId', required: false })
  @ApiResponse({ status: 200, description: 'Lista de rubros', type: [RubricDto] })
  async getRubrics(@Query('jurisdictionId') jurisdictionId?: string): Promise<RubricDto[]> {
    return this.templatesService.getRubrics(jurisdictionId);
  }

  @Get('by-key/:templateKey')
  @Public()
  @ApiOperation({ summary: 'Obtener plantilla por templateKey' })
  @ApiParam({ name: 'templateKey', example: 'rosario.gastronomia.habilitacion_comercial' })
  @ApiResponse({ status: 200, description: 'Plantilla encontrada', type: ObligationTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  async findByKey(@Param('templateKey') templateKey: string): Promise<ObligationTemplateResponseDto> {
    return this.templatesService.findByKey(templateKey);
  }

  @Get('jurisdiction/:jurisdictionId/rubric/:rubric')
  @Public()
  @ApiOperation({ summary: 'Obtener plantillas por jurisdiccion y rubro' })
  @ApiParam({ name: 'jurisdictionId', type: 'string' })
  @ApiParam({ name: 'rubric', example: 'gastronomia' })
  @ApiResponse({ status: 200, description: 'Lista de plantillas', type: [TemplateSummaryDto] })
  async findByJurisdictionAndRubric(
    @Param('jurisdictionId') jurisdictionId: string,
    @Param('rubric') rubric: string,
  ): Promise<TemplateSummaryDto[]> {
    return this.templatesService.findByJurisdictionAndRubric(jurisdictionId, rubric);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Obtener detalles de plantilla' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detalles de la plantilla', type: ObligationTemplateResponseDto })
  @ApiResponse({ status: 404, description: 'Plantilla no encontrada' })
  async findOne(@Param('id') id: string): Promise<ObligationTemplateResponseDto> {
    return this.templatesService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Crear nueva plantilla' })
  @ApiResponse({ status: 201, description: 'Plantilla creada', type: ObligationTemplateResponseDto })
  async create(@Body() dto: CreateObligationTemplateDto): Promise<ObligationTemplateResponseDto> {
    return this.templatesService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Actualizar plantilla' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 200, description: 'Plantilla actualizada', type: ObligationTemplateResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateObligationTemplateDto,
  ): Promise<ObligationTemplateResponseDto> {
    return this.templatesService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactivar plantilla' })
  @ApiParam({ name: 'id', type: 'string' })
  @ApiResponse({ status: 204, description: 'Plantilla desactivada' })
  async deactivate(@Param('id') id: string): Promise<void> {
    await this.templatesService.deactivate(id);
  }
}

// Controller separado para aplicar templates a organizaciones
@ApiTags('organizations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/templates')
export class OrganizationTemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post('apply')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN, Role.MANAGER)
  @ApiOperation({ summary: 'Aplicar plantillas a la organizacion' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Plantillas aplicadas', type: ApplyTemplatesResultDto })
  @ApiResponse({ status: 400, description: 'No se encontraron plantillas para el rubro especificado' })
  async applyTemplates(
    @Param('organizationId') organizationId: string,
    @Body() dto: ApplyTemplatesDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApplyTemplatesResultDto> {
    return this.templatesService.applyToOrganization(organizationId, dto, user.id);
  }
}
