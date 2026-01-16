import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsUUID,
  IsEnum,
  IsDate,
  IsInt,
  Min,
  Max,
  IsBoolean,
  MaxLength,
} from "class-validator";
import { Type } from "class-transformer";
import { ObligationType, ObligationStatus } from "@prisma/client";

export class CreateObligationDto {
  @ApiProperty({ example: "Renovación de habilitación comercial" })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({
    example: "Renovación anual de habilitación municipal",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ObligationType })
  @IsEnum(ObligationType)
  type: ObligationType;

  @ApiProperty({ example: "2024-06-30" })
  @Type(() => Date)
  @IsDate()
  dueDate: Date;

  @ApiPropertyOptional({
    description: "ID del local (si aplica a local específico)",
  })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({
    example: "FREQ=YEARLY;INTERVAL=1",
    description: "Regla de recurrencia (iCalendar)",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  recurrenceRule?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresReview?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  requiredEvidenceCount?: number;

  @ApiProperty({ description: "ID del usuario responsable" })
  @IsUUID()
  ownerUserId: string;
}

export class UpdateObligationDto extends PartialType(CreateObligationDto) {
  @ApiPropertyOptional({ enum: ObligationStatus })
  @IsOptional()
  @IsEnum(ObligationStatus)
  status?: ObligationStatus;
}

export class ObligationFilterDto {
  @ApiPropertyOptional({ enum: ObligationStatus })
  @IsOptional()
  @IsEnum(ObligationStatus)
  status?: ObligationStatus;

  @ApiPropertyOptional({ enum: ObligationType })
  @IsOptional()
  @IsEnum(ObligationType)
  type?: ObligationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @ApiPropertyOptional({ description: "Filtrar por vencimiento desde" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDateFrom?: Date;

  @ApiPropertyOptional({ description: "Filtrar por vencimiento hasta" })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDateTo?: Date;

  @ApiPropertyOptional({ enum: ["GREEN", "YELLOW", "RED"] })
  @IsOptional()
  @IsString()
  trafficLight?: "GREEN" | "YELLOW" | "RED";
}

export enum TrafficLight {
  GREEN = "GREEN",
  YELLOW = "YELLOW",
  RED = "RED",
}

export class ObligationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  locationId?: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ObligationType })
  type: ObligationType;

  @ApiProperty({ enum: ObligationStatus })
  status: ObligationStatus;

  @ApiProperty()
  dueDate: Date;

  @ApiPropertyOptional()
  recurrenceRule?: string;

  @ApiProperty()
  requiresReview: boolean;

  @ApiProperty()
  requiredEvidenceCount: number;

  @ApiProperty()
  ownerUserId: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ enum: TrafficLight })
  trafficLight: TrafficLight;

  @ApiProperty()
  daysUntilDue: number;

  @ApiPropertyOptional()
  location?: {
    id: string;
    name: string;
  };

  @ApiPropertyOptional()
  owner?: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiPropertyOptional()
  _count?: {
    documents: number;
    tasks: number;
    reviews: number;
  };
}

export class ObligationDashboardDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  overdue: number;

  @ApiProperty()
  red: number;

  @ApiProperty()
  yellow: number;

  @ApiProperty()
  green: number;

  @ApiProperty()
  completed: number;

  @ApiProperty()
  upcoming7Days: ObligationResponseDto[];

  @ApiProperty()
  overdueList: ObligationResponseDto[];
}
