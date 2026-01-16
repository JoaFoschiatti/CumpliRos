import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedRequest } from '../interfaces/request.interface';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    // Get organizationId from params, query, or body
    const organizationId =
      request.params.organizationId ||
      request.query.organizationId ||
      request.body?.organizationId;

    if (!organizationId) {
      return true; // No organization context required
    }

    if (!user) {
      throw new ForbiddenException('Usuario no autenticado');
    }

    // Check if user has access to this organization
    const userOrg = await this.prisma.userOrg.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId,
        },
      },
    });

    if (!userOrg) {
      throw new ForbiddenException('No tienes acceso a esta organización');
    }

    // Attach organization context to request
    request.organization = {
      organizationId,
      role: userOrg.role,
    };

    return true;
  }
}
