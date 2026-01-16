import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength, MinLength, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;
}

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class UserWithOrganizationsDto extends UserResponseDto {
  @ApiProperty()
  organizations: Array<{
    id: string;
    name: string;
    cuit: string;
    role: string;
  }>;
}
