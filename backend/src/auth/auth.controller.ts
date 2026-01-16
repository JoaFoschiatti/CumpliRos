import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ThrottlerGuard, Throttle } from "@nestjs/throttler";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
  AcceptInvitationDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  AuthResponseDto,
  UserProfileDto,
} from "./dto/auth.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/request.interface";

const REFRESH_TOKEN_COOKIE = "cumpliros_refresh";

function getCookieValue(
  cookieHeader: string | undefined,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return undefined;
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private parseDurationMs(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) {
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

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const nodeEnv = this.configService.get<string>("NODE_ENV") || "development";
    const isProduction = nodeEnv === "production";
    const sameSite = (this.configService.get<string>("COOKIE_SAMESITE") ||
      (isProduction ? "lax" : "lax")) as "lax" | "strict" | "none";
    const domain = this.configService.get<string>("COOKIE_DOMAIN");
    const maxAge = this.parseDurationMs(
      this.configService.get<string>("JWT_REFRESH_EXPIRES_IN") || "30d",
    );

    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      domain: domain || undefined,
      path: "/api/v1/auth",
      maxAge,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    const nodeEnv = this.configService.get<string>("NODE_ENV") || "development";
    const isProduction = nodeEnv === "production";
    const sameSite = (this.configService.get<string>("COOKIE_SAMESITE") ||
      (isProduction ? "lax" : "lax")) as "lax" | "strict" | "none";
    const domain = this.configService.get<string>("COOKIE_DOMAIN");

    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      domain: domain || undefined,
      path: "/api/v1/auth",
    });
  }

  @Public()
  @Post("register")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registros por minuto
  @ApiOperation({ summary: "Registrar nuevo usuario" })
  @ApiResponse({
    status: 201,
    description: "Usuario registrado exitosamente",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: "El email ya está registrado" })
  @ApiResponse({ status: 429, description: "Demasiadas solicitudes" })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { refreshToken, ...rest } = await this.authService.register(dto);
    if (refreshToken) {
      this.setRefreshTokenCookie(res, refreshToken);
    }
    return rest;
  }

  @Public()
  @Post("login")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 intentos de login por minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Iniciar sesión" })
  @ApiResponse({
    status: 200,
    description: "Login exitoso",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: "Credenciales inválidas" })
  @ApiResponse({ status: 429, description: "Demasiadas solicitudes" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { refreshToken, ...rest } = await this.authService.login(dto);
    if (refreshToken) {
      this.setRefreshTokenCookie(res, refreshToken);
    }
    return rest;
  }

  @Public()
  @Post("refresh")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refresh por minuto
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refrescar token de acceso" })
  @ApiResponse({
    status: 200,
    description: "Token refrescado",
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Token de refresco inválido o expirado",
  })
  @ApiResponse({ status: 429, description: "Demasiadas solicitudes" })
  async refreshToken(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const tokenFromCookie = getCookieValue(
      req.headers.cookie,
      REFRESH_TOKEN_COOKIE,
    );
    const refreshToken = dto.refreshToken || tokenFromCookie;
    if (!refreshToken) {
      this.clearRefreshTokenCookie(res);
      throw new UnauthorizedException("Token de refresco faltante");
    }

    const { refreshToken: newRefreshToken, ...rest } =
      await this.authService.refreshToken(refreshToken);
    if (newRefreshToken) {
      this.setRefreshTokenCookie(res, newRefreshToken);
    } else {
      this.clearRefreshTokenCookie(res);
    }
    return rest;
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cerrar sesión" })
  @ApiResponse({ status: 204, description: "Sesión cerrada" })
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const tokenFromCookie = getCookieValue(
      req.headers.cookie,
      REFRESH_TOKEN_COOKIE,
    );
    const refreshToken = dto.refreshToken || tokenFromCookie;
    await this.authService.logout(user.id, refreshToken);
    this.clearRefreshTokenCookie(res);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Solicitar recuperación de contraseña" })
  @ApiResponse({ status: 200, description: "Solicitud procesada" })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto);
    return {
      message:
        "Si el email existe, recibirás instrucciones para restablecer tu contraseña",
    };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Restablecer contraseña con token" })
  @ApiResponse({ status: 200, description: "Contraseña actualizada" })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.resetPassword(dto);
    return { message: "Contraseña actualizada correctamente" };
  }

  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cambiar contraseña" })
  @ApiResponse({ status: 204, description: "Contraseña cambiada exitosamente" })
  @ApiResponse({ status: 400, description: "Contraseña actual incorrecta" })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("profile")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Obtener perfil del usuario actual" })
  @ApiResponse({
    status: 200,
    description: "Perfil del usuario",
    type: UserProfileDto,
  })
  async getProfile(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserProfileDto> {
    return this.authService.getProfile(user.id);
  }

  @Public()
  @Post("accept-invitation")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 intentos por minuto
  @ApiOperation({ summary: "Aceptar invitación a organización" })
  @ApiResponse({
    status: 200,
    description: "Invitación aceptada",
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invitación inválida o expirada" })
  @ApiResponse({ status: 429, description: "Demasiadas solicitudes" })
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { refreshToken, ...rest } =
      await this.authService.acceptInvitation(dto);
    if (refreshToken) {
      this.setRefreshTokenCookie(res, refreshToken);
    }
    return rest;
  }
}
