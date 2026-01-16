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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { JurisdictionsService } from "./jurisdictions.service";
import {
  CreateJurisdictionDto,
  UpdateJurisdictionDto,
  JurisdictionResponseDto,
  JurisdictionSummaryDto,
} from "./dto/jurisdiction.dto";
import { PaginationDto, PaginatedResponse } from "../common/dto/pagination.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PlatformAdminGuard } from "../common/guards/platform-admin.guard";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("jurisdictions")
@Controller("jurisdictions")
export class JurisdictionsController {
  constructor(private readonly jurisdictionsService: JurisdictionsService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: "Listar jurisdicciones activas" })
  @ApiResponse({
    status: 200,
    description: "Lista de jurisdicciones",
    type: [JurisdictionSummaryDto],
  })
  async findAllActive(): Promise<JurisdictionSummaryDto[]> {
    return this.jurisdictionsService.findAllActive();
  }

  @Get("all")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({
    summary: "Listar todas las jurisdicciones (incluyendo inactivas)",
  })
  @ApiQuery({ name: "activeOnly", required: false, type: Boolean })
  @ApiResponse({ status: 200, description: "Lista paginada de jurisdicciones" })
  async findAll(
    @Query() pagination: PaginationDto,
    @Query("activeOnly") activeOnly?: boolean,
  ): Promise<PaginatedResponse<JurisdictionResponseDto>> {
    return this.jurisdictionsService.findAll(pagination, activeOnly !== false);
  }

  @Get("default")
  @Public()
  @ApiOperation({ summary: "Obtener jurisdiccion por defecto (Rosario)" })
  @ApiResponse({
    status: 200,
    description: "Jurisdiccion por defecto",
    type: JurisdictionResponseDto,
  })
  async getDefault(): Promise<JurisdictionResponseDto | null> {
    return this.jurisdictionsService.getDefaultJurisdiction();
  }

  @Get("by-code/:code")
  @Public()
  @ApiOperation({ summary: "Obtener jurisdiccion por codigo" })
  @ApiParam({ name: "code", example: "ar-sf-rosario" })
  @ApiResponse({
    status: 200,
    description: "Jurisdiccion encontrada",
    type: JurisdictionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Jurisdiccion no encontrada" })
  async findByCode(
    @Param("code") code: string,
  ): Promise<JurisdictionResponseDto> {
    return this.jurisdictionsService.findByCode(code);
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "Obtener detalles de jurisdiccion" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Detalles de la jurisdiccion",
    type: JurisdictionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Jurisdiccion no encontrada" })
  async findOne(@Param("id") id: string): Promise<JurisdictionResponseDto> {
    return this.jurisdictionsService.findOne(id);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: "Crear nueva jurisdiccion" })
  @ApiResponse({
    status: 201,
    description: "Jurisdiccion creada",
    type: JurisdictionResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "Ya existe una jurisdiccion con ese codigo",
  })
  async create(
    @Body() dto: CreateJurisdictionDto,
  ): Promise<JurisdictionResponseDto> {
    return this.jurisdictionsService.create(dto);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: "Actualizar jurisdiccion" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Jurisdiccion actualizada",
    type: JurisdictionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Jurisdiccion no encontrada" })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateJurisdictionDto,
  ): Promise<JurisdictionResponseDto> {
    return this.jurisdictionsService.update(id, dto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Desactivar jurisdiccion" })
  @ApiParam({ name: "id", type: "string" })
  @ApiResponse({ status: 204, description: "Jurisdiccion desactivada" })
  @ApiResponse({ status: 404, description: "Jurisdiccion no encontrada" })
  async deactivate(@Param("id") id: string): Promise<void> {
    await this.jurisdictionsService.deactivate(id);
  }
}
