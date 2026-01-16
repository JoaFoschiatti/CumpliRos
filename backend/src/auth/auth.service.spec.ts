import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './auth.service';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import * as argon2 from 'argon2';

vi.mock('argon2', () => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

const mockPrismaService = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  invitation: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userOrg: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(() => 'mock-access-token'),
};

const mockConfigService = {
  get: vi.fn((key: string) => {
    const config: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '7d',
      JWT_REFRESH_SECRET: 'test-refresh-secret',
      JWT_REFRESH_EXPIRES_IN: '30d',
    };
    return config[key];
  }),
};

const mockAuditService = {
  log: vi.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      mockPrismaService as any,
      mockJwtService as any,
      mockConfigService as any,
      mockAuditService as any,
    );
  });

  describe('register', () => {
    const registerDto = {
      email: 'test@test.com',
      password: 'Password123!',
      fullName: 'Test User',
    };

    it('should register a new user successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      vi.mocked(argon2.hash).mockResolvedValue('hashed-password');
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-123',
        email: registerDto.email,
        fullName: registerDto.fullName,
      });
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBe('mock-uuid');
      expect(result.user.email).toBe(registerDto.email);
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.register(registerDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@test.com',
      password: 'Password123!',
    };

    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: loginDto.email,
        fullName: 'Test User',
        passwordHash: 'hashed-password',
        active: true,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      vi.mocked(argon2.verify).mockResolvedValue(true);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.user.email).toBe(loginDto.email);
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        active: false,
      });

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: loginDto.email,
        passwordHash: 'hashed-password',
        active: true,
      });
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should refresh tokens successfully', async () => {
      const mockStoredToken = {
        id: 'token-123',
        token: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        user: {
          id: 'user-123',
          email: 'test@test.com',
          fullName: 'Test User',
          active: true,
        },
      };

      mockPrismaService.refreshToken.findFirst.mockResolvedValue(mockStoredToken);
      mockPrismaService.refreshToken.delete.mockResolvedValue({});
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.refreshToken('valid-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(mockPrismaService.refreshToken.delete).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      mockPrismaService.refreshToken.findFirst.mockResolvedValue({
        id: 'token-123',
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      await expect(service.refreshToken('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changePassword', () => {
    const userId = 'user-123';
    const changePasswordDto = {
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
    };

    it('should change password successfully', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        passwordHash: 'hashed-old-password',
      });
      vi.mocked(argon2.verify).mockResolvedValue(true);
      vi.mocked(argon2.hash).mockResolvedValue('hashed-new-password');
      mockPrismaService.user.update.mockResolvedValue({});
      mockPrismaService.refreshToken.deleteMany.mockResolvedValue({});

      await expect(service.changePassword(userId, changePasswordDto)).resolves.not.toThrow();
    });

    it('should throw BadRequestException for incorrect current password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        passwordHash: 'hashed-old-password',
      });
      vi.mocked(argon2.verify).mockResolvedValue(false);

      await expect(service.changePassword(userId, changePasswordDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('acceptInvitation', () => {
    it('should accept invitation for existing user', async () => {
      const mockInvitation = {
        id: 'inv-123',
        email: 'test@test.com',
        organizationId: 'org-123',
        role: 'ADMIN',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 86400000),
        organization: { name: 'Test Org' },
      };

      mockPrismaService.invitation.findUnique.mockResolvedValue(mockInvitation);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@test.com',
        fullName: 'Test User',
      });
      mockPrismaService.userOrg.findUnique.mockResolvedValue(null);
      mockPrismaService.$transaction.mockResolvedValue([{ id: 'membership-123' }, {}]);
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.acceptInvitation({ token: 'valid-token' });

      expect(result.accessToken).toBeDefined();
    });

    it('should throw BadRequestException for expired invitation', async () => {
      mockPrismaService.invitation.findUnique.mockResolvedValue({
        id: 'inv-123',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
      });

      await expect(service.acceptInvitation({ token: 'expired-token' })).rejects.toThrow(BadRequestException);
    });
  });
});
