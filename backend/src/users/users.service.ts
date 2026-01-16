import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import {
  UpdateUserDto,
  UserResponseDto,
  UserWithOrganizationsDto,
} from "./dto/user.dto";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(userId: string): Promise<UserWithOrganizationsDto> {
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
      active: user.active,
      createdAt: user.createdAt,
      organizations: user.userOrgs.map((uo) => ({
        id: uo.organization.id,
        name: uo.organization.name,
        cuit: uo.organization.cuit,
        role: uo.role,
      })),
    };
  }

  async update(userId: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("Usuario no encontrado");
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        fullName: true,
        active: true,
        createdAt: true,
      },
    });

    return updated;
  }

  async findByOrganization(organizationId: string): Promise<UserResponseDto[]> {
    const userOrgs = await this.prisma.userOrg.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });

    return userOrgs.map((uo) => uo.user);
  }
}
