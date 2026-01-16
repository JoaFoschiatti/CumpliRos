import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import {
  UpdateUserDto,
  UserWithOrganizationsDto,
  UserResponseDto,
} from "./dto/user.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../common/interfaces/request.interface";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get("me")
  @ApiOperation({ summary: "Obtener perfil del usuario actual" })
  @ApiResponse({
    status: 200,
    description: "Perfil del usuario",
    type: UserWithOrganizationsDto,
  })
  async getMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<UserWithOrganizationsDto> {
    return this.usersService.findOne(user.id);
  }

  @Patch("me")
  @ApiOperation({ summary: "Actualizar perfil del usuario actual" })
  @ApiResponse({
    status: 200,
    description: "Perfil actualizado",
    type: UserResponseDto,
  })
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(user.id, dto);
  }
}
