import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsUUID,
  ValidateNested,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ObligationType, Periodicity, TemplateSeverity } from '@prisma/client';

// DTO para items de checklist
export class ChecklistItemDto {
  @ApiProperty({ example: 'Completar formulario de solicitud' })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isRequired: boolean;
}

// DTO para referencias
export class TemplateReferenceDto {
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  links?: Array<{ url: string; title: string }>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  notes?: string[];
}

// Create DTO
export class CreateObligationTemplateDto {
  @ApiProperty({ example: '00000000-0000-0000-0000-000000000001' })
  @IsUUID()
  jurisdictionId: string;

  @ApiProperty({ example: 'rosario.gastronomia.habilitacion_comercial' })
  @IsString()
  @MaxLength(255)
  templateKey: string;

  @ApiProperty({ example: 'gastronomia' })
  @IsString()
  @MaxLength(100)
  rubric: string;

  @ApiProperty({ example: 'Habilitacion Comercial Municipal' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ example: 'Habilitacion municipal obligatoria para operar' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ObligationType })
  @IsEnum(ObligationType)
  type: ObligationType;

  @ApiProperty({ enum: Periodicity, default: 'ANNUAL' })
  @IsEnum(Periodicity)
  defaultPeriodicity: Periodicity;

  @ApiPropertyOptional({ example: 'Renovar antes de vencimiento' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultDueRule?: string;

  @ApiProperty({ default: false })
  @IsBoolean()
  requiresReview: boolean;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @Min(0)
  requiredEvidenceCount: number;

  @ApiProperty({ enum: TemplateSeverity, default: 'MEDIUM' })
  @IsEnum(TemplateSeverity)
  severity: TemplateSeverity;

  @ApiPropertyOptional({ type: TemplateReferenceDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TemplateReferenceDto)
  references?: TemplateReferenceDto;

  @ApiPropertyOptional({ type: [ChecklistItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChecklistItemDto)
  checklist?: ChecklistItemDto[];
}

export class UpdateObligationTemplateDto extends PartialType(CreateObligationTemplateDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  changelog?: string;
}

// Response DTOs
export class ChecklistTemplateItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  isRequired: boolean;
}

export class ObligationTemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  jurisdictionId: string;

  @ApiProperty()
  templateKey: string;

  @ApiProperty()
  rubric: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: ObligationType })
  type: ObligationType;

  @ApiProperty({ enum: Periodicity })
  defaultPeriodicity: Periodicity;

  @ApiPropertyOptional()
  defaultDueRule?: string;

  @ApiProperty()
  requiresReview: boolean;

  @ApiProperty()
  requiredEvidenceCount: number;

  @ApiProperty({ enum: TemplateSeverity })
  severity: TemplateSeverity;

  @ApiPropertyOptional()
  references?: any;

  @ApiProperty()
  version: number;

  @ApiPropertyOptional()
  changelog?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [ChecklistTemplateItemResponseDto] })
  checklistItems?: ChecklistTemplateItemResponseDto[];
}

export class TemplateSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  templateKey: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  rubric: string;

  @ApiProperty({ enum: ObligationType })
  type: ObligationType;

  @ApiProperty({ enum: Periodicity })
  defaultPeriodicity: Periodicity;

  @ApiProperty({ enum: TemplateSeverity })
  severity: TemplateSeverity;

  @ApiProperty()
  checklistItemCount: number;
}

// DTO para aplicar plantillas a una organizacion
export class ApplyTemplatesDto {
  @ApiProperty({ example: 'gastronomia', description: 'Rubro para filtrar plantillas' })
  @IsString()
  @MaxLength(100)
  rubric: string;

  @ApiPropertyOptional({ description: 'ID de jurisdiccion (usa la de la org si no se especifica)' })
  @IsOptional()
  @IsUUID()
  jurisdictionId?: string;

  @ApiPropertyOptional({ description: 'IDs especificos de templates a aplicar' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  templateIds?: string[];

  @ApiPropertyOptional({ description: 'ID del local donde aplicar (opcional)' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiPropertyOptional({ description: 'ID del usuario responsable de las obligaciones' })
  @IsOptional()
  @IsUUID()
  ownerUserId?: string;
}

export class ApplyTemplatesResultDto {
  @ApiProperty({ description: 'Cantidad de obligaciones creadas' })
  obligationsCreated: number;

  @ApiProperty({ description: 'Cantidad de tareas creadas' })
  tasksCreated: number;

  @ApiProperty({ description: 'IDs de las obligaciones creadas' })
  obligationIds: string[];
}

// Query DTO para buscar templates
export class TemplateQueryDto {
  @ApiPropertyOptional({ example: 'gastronomia' })
  @IsOptional()
  @IsString()
  rubric?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  jurisdictionId?: string;

  @ApiPropertyOptional({ enum: ObligationType })
  @IsOptional()
  @IsEnum(ObligationType)
  type?: ObligationType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

// DTO para listar rubros disponibles
export class RubricDto {
  @ApiProperty({ example: 'gastronomia' })
  rubric: string;

  @ApiProperty({ example: 'Gastronomia' })
  displayName: string;

  @ApiProperty({ example: 6 })
  templateCount: number;
}
