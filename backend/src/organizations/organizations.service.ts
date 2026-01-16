import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../common/prisma/prisma.service';
import { EmailService } from '../common/email/email.service';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuditActions } from '../audit/dto/audit.dto';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  InviteUserDto,
  UpdateMemberRoleDto,
  OrganizationResponseDto,
  OrganizationMemberDto,
  OrganizationStatsDto,
} from './dto/organization.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    // Check if CUIT already exists
    const existing = await this.prisma.organization.findUnique({
      where: { cuit: dto.cuit },
    });

    if (existing) {
      throw new ConflictException('Ya existe una organizacion con ese CUIT');
    }

    // Obtener jurisdiccion por defecto (Rosario) si no se especifica
    let jurisdictionId = dto.jurisdictionId;
    if (!jurisdictionId) {
      const defaultJurisdiction = await this.prisma.jurisdiction.findUnique({
        where: { code: 'ar-sf-rosario' },
      });
      jurisdictionId = defaultJurisdiction?.id;
    }

    // Create organization and assign creator as OWNER
    const organization = await this.prisma.organization.create({
      data: {
        cuit: dto.cuit,
        name: dto.name,
        jurisdictionId,
        plan: dto.plan,
        thresholdYellowDays: dto.thresholdYellowDays ?? 15,
        thresholdRedDays: dto.thresholdRedDays ?? 7,
        userOrgs: {
          create: {
            userId,
            role: Role.OWNER,
          },
        },
      },
      include: {
        jurisdiction: {
          select: { id: true, code: true, name: true, province: true },
        },
        _count: {
          select: { locations: true, obligations: true },
        },
      },
    });

    await this.auditService.log(
      organization.id,
      AuditActions.ORGANIZATION_CREATED,
      'Organization',
      organization.id,
      userId,
      { cuit: organization.cuit, name: organization.name, plan: organization.plan },
    );

    return organization;
  }

  async findAllForUser(userId: string, pagination: PaginationDto): Promise<PaginatedResponse<OrganizationResponseDto>> {
    const where = {
      userOrgs: {
        some: { userId },
      },
      active: true,
    };

    const [organizations, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: pagination.sortOrder },
        include: {
          jurisdiction: {
            select: { id: true, code: true, name: true, province: true },
          },
          _count: {
            select: { locations: true, obligations: true },
          },
        },
      }),
      this.prisma.organization.count({ where }),
    ]);

    return createPaginatedResponse(organizations, total, pagination.page!, pagination.limit!);
  }

  async findOne(organizationId: string): Promise<OrganizationResponseDto> {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        jurisdiction: {
          select: { id: true, code: true, name: true, province: true },
        },
        _count: {
          select: { locations: true, obligations: true },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organizacion no encontrada');
    }

    return organization;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto, userId?: string): Promise<OrganizationResponseDto> {
    // Check if CUIT is being changed and already exists
    if (dto.cuit) {
      const existing = await this.prisma.organization.findFirst({
        where: {
          cuit: dto.cuit,
          id: { not: organizationId },
        },
      });

      if (existing) {
        throw new ConflictException('Ya existe otra organización con ese CUIT');
      }
    }

    const organization = await this.prisma.organization.update({
      where: { id: organizationId },
      data: dto,
      include: {
        jurisdiction: {
          select: { id: true, code: true, name: true, province: true },
        },
        _count: {
          select: { locations: true, obligations: true },
        },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.ORGANIZATION_UPDATED,
      'Organization',
      organizationId,
      userId,
      { changes: dto },
    );

    return organization;
  }

  async deactivate(organizationId: string, userId?: string): Promise<void> {
    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { active: false },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.ORGANIZATION_DEACTIVATED,
      'Organization',
      organizationId,
      userId,
    );
  }

  async getStats(organizationId: string): Promise<OrganizationStatsDto> {
    const now = new Date();
    const in7Days = new Date();
    in7Days.setDate(now.getDate() + 7);
    const in15Days = new Date();
    in15Days.setDate(now.getDate() + 15);

    const [
      totalLocations,
      totalObligations,
      obligationsOverdue,
      obligationsUpcoming7Days,
      obligationsUpcoming15Days,
      obligationsCompleted,
    ] = await Promise.all([
      this.prisma.location.count({ where: { organizationId, active: true } }),
      this.prisma.obligation.count({ where: { organizationId } }),
      this.prisma.obligation.count({
        where: {
          organizationId,
          status: 'OVERDUE',
        },
      }),
      this.prisma.obligation.count({
        where: {
          organizationId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lte: in7Days, gte: now },
        },
      }),
      this.prisma.obligation.count({
        where: {
          organizationId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lte: in15Days, gte: now },
        },
      }),
      this.prisma.obligation.count({
        where: {
          organizationId,
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      totalLocations,
      totalObligations,
      obligationsOverdue,
      obligationsUpcoming7Days,
      obligationsUpcoming15Days,
      obligationsCompleted,
    };
  }

  // Members management
  async getMembers(organizationId: string): Promise<OrganizationMemberDto[]> {
    const userOrgs = await this.prisma.userOrg.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return userOrgs.map((uo) => ({
      id: uo.id,
      userId: uo.user.id,
      email: uo.user.email,
      fullName: uo.user.fullName,
      role: uo.role,
      joinedAt: uo.createdAt,
    }));
  }

  async inviteMember(
    organizationId: string,
    dto: InviteUserDto,
    inviterId: string,
  ): Promise<{ token: string }> {
    // Check if user is already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      const existingMembership = await this.prisma.userOrg.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId,
          },
        },
      });

      if (existingMembership) {
        throw new ConflictException('El usuario ya es miembro de esta organización');
      }
    }

    // Check for pending invitation
    const pendingInvitation = await this.prisma.invitation.findFirst({
      where: {
        organizationId,
        email: dto.email.toLowerCase(),
        status: 'PENDING',
      },
    });

    if (pendingInvitation) {
      throw new ConflictException('Ya existe una invitación pendiente para este email');
    }

    // Get organization and inviter details
    const [organization, inviter] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.user.findUnique({ where: { id: inviterId } }),
    ]);

    if (!organization || !inviter) {
      throw new NotFoundException('Organización o usuario no encontrado');
    }

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId,
        email: dto.email.toLowerCase(),
        role: dto.role,
        token: uuidv4(),
        expiresAt,
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.USER_INVITED,
      'Invitation',
      invitation.id,
      inviterId,
      { email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt },
    );

    // Send invitation email
    const baseUrl = this.configService.get<string>('CORS_ORIGINS')?.split(',')[0] || 'http://localhost:3000';
    const sent = await this.emailService.sendInvitationEmail(
      dto.email.toLowerCase(),
      organization.name,
      inviter.fullName,
      dto.role,
      invitation.token,
      baseUrl,
    );

    if (sent) {
      this.logger.log(`Invitation email sent to ${dto.email} for organization ${organization.name}`);
    } else {
      this.logger.warn(`Failed to send invitation email to ${dto.email}`);
    }

    return { token: invitation.token };
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
    currentUserId: string,
  ): Promise<void> {
    const userOrg = await this.prisma.userOrg.findUnique({
      where: { id: memberId },
    });

    if (!userOrg || userOrg.organizationId !== organizationId) {
      throw new NotFoundException('Miembro no encontrado');
    }

    // Cannot change your own role
    if (userOrg.userId === currentUserId) {
      throw new ForbiddenException('No puedes cambiar tu propio rol');
    }

    // Cannot demote the only OWNER
    if (userOrg.role === Role.OWNER && dto.role !== Role.OWNER) {
      const ownerCount = await this.prisma.userOrg.count({
        where: {
          organizationId,
          role: Role.OWNER,
        },
      });

      if (ownerCount === 1) {
        throw new BadRequestException('Debe haber al menos un propietario en la organización');
      }
    }

    await this.prisma.userOrg.update({
      where: { id: memberId },
      data: { role: dto.role },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.USER_ROLE_CHANGED,
      'UserOrg',
      memberId,
      currentUserId,
      { role: dto.role },
    );
  }

  async removeMember(organizationId: string, memberId: string, currentUserId: string): Promise<void> {
    const userOrg = await this.prisma.userOrg.findUnique({
      where: { id: memberId },
    });

    if (!userOrg || userOrg.organizationId !== organizationId) {
      throw new NotFoundException('Miembro no encontrado');
    }

    // Cannot remove yourself
    if (userOrg.userId === currentUserId) {
      throw new ForbiddenException('No puedes eliminarte a ti mismo de la organización');
    }

    // Cannot remove the only OWNER
    if (userOrg.role === Role.OWNER) {
      const ownerCount = await this.prisma.userOrg.count({
        where: {
          organizationId,
          role: Role.OWNER,
        },
      });

      if (ownerCount === 1) {
        throw new BadRequestException('No puedes eliminar al único propietario de la organización');
      }
    }

    await this.prisma.userOrg.delete({
      where: { id: memberId },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.USER_REMOVED,
      'UserOrg',
      memberId,
      currentUserId,
      { removedUserId: userOrg.userId, role: userOrg.role },
    );
  }

  async cancelInvitation(organizationId: string, invitationId: string, userId?: string): Promise<void> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.organizationId !== organizationId) {
      throw new NotFoundException('Invitación no encontrada');
    }

    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('La invitación ya fue procesada');
    }

    await this.prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.INVITATION_CANCELLED,
      'Invitation',
      invitationId,
      userId,
      { status: 'CANCELLED' },
    );
  }

  async getPendingInvitations(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: {
        organizationId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
