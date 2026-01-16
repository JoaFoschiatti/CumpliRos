import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
  IsEnum,
  IsEmail,
  IsUUID,
} from 'class-validator';
import { Plan, Role } from '@prisma/client';

export class CreateOrganizationDto {
  @ApiProperty({ example: '30-12345678-9', description: 'CUIT de la organización' })
  @IsString()
  @Matches(/^\d{2}-\d{8}-\d{1}$/, { message: 'CUIT inválido. Formato: XX-XXXXXXXX-X' })
  cuit: string;

  @ApiProperty({ example: 'Mi Comercio S.R.L.' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ enum: Plan, default: Plan.BASIC })
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @ApiPropertyOptional({ default: 15, minimum: 1, maximum: 90 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  thresholdYellowDays?: number;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  thresholdRedDays?: number;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class InviteUserDto {
  @ApiProperty({ example: 'contador@estudio.com' })
  @IsEmail({}, { message: 'Email inválido' })
  email: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role: Role;
}

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cuit: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: Plan })
  plan: Plan;

  @ApiProperty()
  thresholdYellowDays: number;

  @ApiProperty()
  thresholdRedDays: number;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  _count?: {
    locations: number;
    obligations: number;
  };
}

export class OrganizationMemberDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({ enum: Role })
  role: Role;

  @ApiProperty()
  joinedAt: Date;
}

export class OrganizationStatsDto {
  @ApiProperty()
  totalLocations: number;

  @ApiProperty()
  totalObligations: number;

  @ApiProperty()
  obligationsOverdue: number;

  @ApiProperty()
  obligationsUpcoming7Days: number;

  @ApiProperty()
  obligationsUpcoming15Days: number;

  @ApiProperty()
  obligationsCompleted: number;
}
