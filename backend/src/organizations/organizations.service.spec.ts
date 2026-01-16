import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationsService } from './organizations.service';
import { ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

const mockPrismaService = {
  organization: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  userOrg: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  invitation: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  location: {
    count: vi.fn(),
  },
  obligation: {
    count: vi.fn(),
  },
};

const mockEmailService = {
  sendInvitationEmail: vi.fn(),
};

const mockConfigService = {
  get: vi.fn((key: string) => {
    if (key === 'CORS_ORIGINS') return 'http://localhost:3000';
    return null;
  }),
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrganizationsService(
      mockPrismaService as any,
      mockEmailService as any,
      mockConfigService as any,
    );
  });

  describe('create', () => {
    const userId = 'user-123';
    const createDto = {
      cuit: '20-12345678-9',
      name: 'Test Organization',
      plan: 'BASIC' as any,
    };

    it('should create organization and assign creator as OWNER', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);
      mockPrismaService.organization.create.mockResolvedValue({
        id: 'org-123',
        ...createDto,
        _count: { locations: 0, obligations: 0 },
      });

      const result = await service.create(userId, createDto);

      expect(result.id).toBe('org-123');
      expect(mockPrismaService.organization.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userOrgs: { create: { userId, role: 'OWNER' } },
          }),
        }),
      );
    });

    it('should throw ConflictException if CUIT already exists', async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: 'existing-org',
        cuit: createDto.cuit,
      });

      await expect(service.create(userId, createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('inviteMember', () => {
    const organizationId = 'org-123';
    const inviterId = 'inviter-123';
    const inviteDto = {
      email: 'newuser@test.com',
      role: 'ADMIN' as any,
    };

    it('should create invitation and send email', async () => {
      mockPrismaService.user.findUnique
        .mockResolvedValueOnce(null) // User doesn't exist
        .mockResolvedValueOnce({ id: inviterId, fullName: 'Inviter Name' }); // Inviter
      mockPrismaService.userOrg.findUnique.mockResolvedValue(null);
      mockPrismaService.invitation.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: organizationId,
        name: 'Test Org',
      });
      mockPrismaService.invitation.create.mockResolvedValue({
        token: 'invite-token-123',
      });
      mockEmailService.sendInvitationEmail.mockResolvedValue(true);

      const result = await service.inviteMember(organizationId, inviteDto, inviterId);

      expect(result.token).toBe('invite-token-123');
      expect(mockEmailService.sendInvitationEmail).toHaveBeenCalled();
    });

    it('should throw ConflictException if user is already a member', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: inviteDto.email,
      });
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: 'membership-123',
      });

      await expect(service.inviteMember(organizationId, inviteDto, inviterId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if invitation already pending', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.invitation.findFirst.mockResolvedValue({
        id: 'existing-invitation',
        status: 'PENDING',
      });

      await expect(service.inviteMember(organizationId, inviteDto, inviterId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateMemberRole', () => {
    const organizationId = 'org-123';
    const memberId = 'member-123';
    const currentUserId = 'current-user-123';

    it('should update member role successfully', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: 'other-user',
        role: 'ADMIN',
      });
      mockPrismaService.userOrg.update.mockResolvedValue({});

      await expect(
        service.updateMemberRole(organizationId, memberId, { role: 'MANAGER' as any }, currentUserId),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when trying to change own role', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: currentUserId,
        role: 'ADMIN',
      });

      await expect(
        service.updateMemberRole(organizationId, memberId, { role: 'MANAGER' as any }, currentUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when demoting only OWNER', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: 'other-user',
        role: 'OWNER',
      });
      mockPrismaService.userOrg.count.mockResolvedValue(1);

      await expect(
        service.updateMemberRole(organizationId, memberId, { role: 'ADMIN' as any }, currentUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeMember', () => {
    const organizationId = 'org-123';
    const memberId = 'member-123';
    const currentUserId = 'current-user-123';

    it('should remove member successfully', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: 'other-user',
        role: 'ADMIN',
      });
      mockPrismaService.userOrg.delete.mockResolvedValue({});

      await expect(
        service.removeMember(organizationId, memberId, currentUserId),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when trying to remove self', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: currentUserId,
      });

      await expect(
        service.removeMember(organizationId, memberId, currentUserId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when removing only OWNER', async () => {
      mockPrismaService.userOrg.findUnique.mockResolvedValue({
        id: memberId,
        organizationId,
        userId: 'other-user',
        role: 'OWNER',
      });
      mockPrismaService.userOrg.count.mockResolvedValue(1);

      await expect(
        service.removeMember(organizationId, memberId, currentUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('should return organization statistics', async () => {
      mockPrismaService.location.count.mockResolvedValue(5);
      mockPrismaService.obligation.count
        .mockResolvedValueOnce(20) // total
        .mockResolvedValueOnce(2) // overdue
        .mockResolvedValueOnce(3) // upcoming 7 days
        .mockResolvedValueOnce(5) // upcoming 15 days
        .mockResolvedValueOnce(10); // completed

      const result = await service.getStats('org-123');

      expect(result.totalLocations).toBe(5);
      expect(result.totalObligations).toBe(20);
      expect(result.obligationsOverdue).toBe(2);
      expect(result.obligationsCompleted).toBe(10);
    });
  });

  describe('cancelInvitation', () => {
    it('should cancel pending invitation', async () => {
      mockPrismaService.invitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        organizationId: 'org-123',
        status: 'PENDING',
      });
      mockPrismaService.invitation.update.mockResolvedValue({});

      await expect(
        service.cancelInvitation('org-123', 'inv-123'),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException for already processed invitation', async () => {
      mockPrismaService.invitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        organizationId: 'org-123',
        status: 'ACCEPTED',
      });

      await expect(
        service.cancelInvitation('org-123', 'inv-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
