import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthenticatedRequest } from "../interfaces/request.interface";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("Usuario no autenticado");
    }

    const configuredToken = this.configService.get<string>(
      "PLATFORM_ADMIN_TOKEN",
    );
    const headerToken = request.headers["x-admin-token"];
    if (
      configuredToken &&
      typeof headerToken === "string" &&
      headerToken === configuredToken
    ) {
      return true;
    }

    const adminEmails = (
      this.configService.get<string>("PLATFORM_ADMIN_EMAILS") || ""
    )
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (
      adminEmails.length > 0 &&
      adminEmails.includes(user.email.toLowerCase())
    ) {
      return true;
    }

    throw new ForbiddenException(
      "No tienes permisos de administrador de plataforma",
    );
  }
}
