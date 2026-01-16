import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import { createHash, randomBytes } from "crypto";
import { PrismaService } from "../common/prisma/prisma.service";
import { JwtPayload } from "../common/interfaces/request.interface";
import { AuditService } from "../audit/audit.service";
import { AuditActions } from "../audit/dto/audit.dto";
import { EmailService } from "../common/email/email.service";
import {
  RegisterDto,
  LoginDto,
  AuthResponseDto,
  ChangePasswordDto,
  AcceptInvitationDto,
  UserProfileDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
    private emailService: EmailService,
  ) {}

  private hashRefreshToken(refreshToken: string): string {
    // Hash refresh tokens so a DB leak can't be used to mint sessions.
    const pepper = this.configService.get<string>("JWT_REFRESH_SECRET") || "";
    return createHash("sha256")
      .update(`${pepper}:${refreshToken}`)
      .digest("hex");
  }

  private hashPasswordResetToken(token: string): string {
    // Password reset tokens are stored only as hashes and expire quickly.
    const pepper =
      this.configService.get<string>("PASSWORD_RESET_SECRET") ||
      this.configService.get<string>("JWT_SECRET") ||
      "";
    return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("El email ya está registrado");
    }

    // Hash password
    const passwordHash = await argon2.hash(dto.password);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
      },
    });

    return this.generateTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    return this.generateTokens(user);
  }

  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    const tokenHash = this.hashRefreshToken(refreshToken);

    const storedToken = await this.prisma.refreshToken.findFirst({
      where: { token: { in: [tokenHash, refreshToken] } },
      include: { user: true },
    });

    if (!storedToken) {
      throw new UnauthorizedException("Token de refresco inválido");
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });
      throw new UnauthorizedException("Token de refresco expirado");
    }

    if (!storedToken.user.active) {
      throw new UnauthorizedException("Usuario inactivo");
    }

    // Rotate refresh tokens to prevent replay.
    await this.prisma.refreshToken.delete({ where: { id: storedToken.id } });

    return this.generateTokens(storedToken.user);
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      const tokenHash = this.hashRefreshToken(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: { in: [tokenHash, refreshToken] } },
      });
    } else {
      // Delete all refresh tokens for user
      await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const isCurrentPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException("La contraseña actual es incorrecta");
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    // Invalidate all refresh tokens
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    // Avoid leaking whether the email exists.
    if (!user || !user.active) {
      return;
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenHash = this.hashPasswordResetToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const baseUrl =
      this.configService.get<string>("FRONTEND_URL") ||
      this.configService.get<string>("CORS_ORIGINS")?.split(",")[0] ||
      "http://localhost:3000";

    // Short-lived reset link; token is not stored in plain text.
    await this.emailService.sendPasswordResetEmail(
      user.email,
      user.fullName,
      `${baseUrl}/auth/reset-password?token=${resetToken}`,
    );
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = this.hashPasswordResetToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException("Token inválido o expirado");
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      },
    });

    // Kill existing sessions after a password reset.
    await this.prisma.refreshToken.deleteMany({
      where: { userId: user.id },
    });
  }

  async getProfile(userId: string): Promise<UserProfileDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userOrgs: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                cuit: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizations: user.userOrgs.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        cuit: uo.organization.cuit,
        role: uo.role,
      })),
    };
  }

  async acceptInvitation(dto: AcceptInvitationDto): Promise<AuthResponseDto> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.token },
      include: { organization: true },
    });

    if (!invitation) {
      throw new NotFoundException("Invitación no encontrada");
    }

    if (invitation.status !== "PENDING") {
      throw new BadRequestException("La invitación ya fue procesada");
    }

    if (invitation.expiresAt < new Date()) {
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      throw new BadRequestException("La invitación ha expirado");
    }

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
    });

    if (!user) {
      // User doesn't exist, need fullName and password
      if (!dto.fullName || !dto.password) {
        throw new BadRequestException(
          "Se requiere nombre completo y contraseña para usuarios nuevos",
        );
      }

      const passwordHash = await argon2.hash(dto.password);

      user = await this.prisma.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          fullName: dto.fullName,
          passwordHash,
        },
      });
    }

    // Check if already member
    const existingMembership = await this.prisma.userOrg.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: invitation.organizationId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException("Ya eres miembro de esta organización");
    }

    // Create membership and update invitation
    const [membership] = await this.prisma.$transaction([
      this.prisma.userOrg.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    await this.auditService.log(
      invitation.organizationId,
      AuditActions.USER_JOINED,
      "UserOrg",
      membership.id,
      user.id,
      { role: invitation.role, email: user.email },
    );

    return this.generateTokens(user);
  }

  private async generateTokens(user: {
    id: string;
    email: string;
    fullName: string;
  }): Promise<AuthResponseDto> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: this.configService.get("JWT_EXPIRES_IN") || "15m",
    });

    const refreshToken = uuidv4();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const refreshExpiresIn =
      this.configService.get("JWT_REFRESH_EXPIRES_IN") || "30d";
    const expiresAt = new Date();
    expiresAt.setTime(
      expiresAt.getTime() + this.parseDuration(refreshExpiresIn),
    );

    // Store only the hashed refresh token for session persistence.
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  /**
   * Parse duration string to milliseconds
   * Supports: 30d, 7d, 24h, 60m, 30s
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) {
      // Default to 30 days if invalid format
      return 30 * 24 * 60 * 60 * 1000;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "d":
        return value * 24 * 60 * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "m":
        return value * 60 * 1000;
      case "s":
        return value * 1000;
      default:
        return 30 * 24 * 60 * 60 * 1000;
    }
  }
}
