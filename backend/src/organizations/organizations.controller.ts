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
} from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { OrganizationsService } from "./organizations.service";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteUserDto,
  UpdateMemberRoleDto,
  OrganizationResponseDto,
  OrganizationMemberDto,
  OrganizationStatsDto,
} from "./dto/organization.dto";
import { PaginationDto, PaginatedResponse } from "../common/dto/pagination.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OrganizationGuard } from "../common/guards/organization.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AuthenticatedUser } from "../common/interfaces/request.interface";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: "Crear nueva organización" })
  @ApiResponse({
    status: 201,
    description: "Organización creada",
    type: OrganizationResponseDto,
  })
  @ApiResponse({ status: 409, description: "CUIT ya existe" })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar organizaciones del usuario" })
  @ApiResponse({ status: 200, description: "Lista de organizaciones" })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<OrganizationResponseDto>> {
    return this.organizationsService.findAllForUser(user.id, pagination);
  }

  @Get(":organizationId")
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: "Obtener detalles de organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Detalles de la organización",
    type: OrganizationResponseDto,
  })
  async findOne(
    @Param("organizationId") organizationId: string,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.findOne(organizationId);
  }

  @Patch(":organizationId")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Actualizar organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Organización actualizada",
    type: OrganizationResponseDto,
  })
  async update(
    @Param("organizationId") organizationId: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.update(organizationId, dto, user.id);
  }

  @Delete(":organizationId")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Desactivar organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({ status: 204, description: "Organización desactivada" })
  async deactivate(
    @Param("organizationId") organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.organizationsService.deactivate(organizationId, user.id);
  }

  @Get(":organizationId/stats")
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: "Obtener estadísticas de la organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Estadísticas",
    type: OrganizationStatsDto,
  })
  async getStats(
    @Param("organizationId") organizationId: string,
  ): Promise<OrganizationStatsDto> {
    return this.organizationsService.getStats(organizationId);
  }

  // Members
  @Get(":organizationId/members")
  @UseGuards(OrganizationGuard)
  @ApiOperation({ summary: "Listar miembros de la organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({
    status: 200,
    description: "Lista de miembros",
    type: [OrganizationMemberDto],
  })
  async getMembers(
    @Param("organizationId") organizationId: string,
  ): Promise<OrganizationMemberDto[]> {
    return this.organizationsService.getMembers(organizationId);
  }

  @Post(":organizationId/invitations")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Invitar usuario a la organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiResponse({ status: 201, description: "Invitación enviada" })
  async inviteMember(
    @Param("organizationId") organizationId: string,
    @Body() dto: InviteUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ token: string }> {
    return this.organizationsService.inviteMember(organizationId, dto, user.id);
  }

  @Get(":organizationId/invitations")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: "Listar invitaciones pendientes" })
  @ApiParam({ name: "organizationId", type: "string" })
  async getPendingInvitations(@Param("organizationId") organizationId: string) {
    return this.organizationsService.getPendingInvitations(organizationId);
  }

  @Delete(":organizationId/invitations/:invitationId")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Cancelar invitación" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiParam({ name: "invitationId", type: "string" })
  async cancelInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.organizationsService.cancelInvitation(
      organizationId,
      invitationId,
      user.id,
    );
  }

  @Patch(":organizationId/members/:memberId")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER)
  @ApiOperation({ summary: "Cambiar rol de miembro" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiParam({ name: "memberId", type: "string" })
  async updateMemberRole(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.organizationsService.updateMemberRole(
      organizationId,
      memberId,
      dto,
      user.id,
    );
  }

  @Delete(":organizationId/members/:memberId")
  @UseGuards(OrganizationGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar miembro de la organización" })
  @ApiParam({ name: "organizationId", type: "string" })
  @ApiParam({ name: "memberId", type: "string" })
  async removeMember(
    @Param("organizationId") organizationId: string,
    @Param("memberId") memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.organizationsService.removeMember(
      organizationId,
      memberId,
      user.id,
    );
  }
}
