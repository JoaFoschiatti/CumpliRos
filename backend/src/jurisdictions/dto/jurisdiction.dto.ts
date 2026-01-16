import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateJurisdictionDto {
  @ApiProperty({ example: 'ar-sf-santa-fe', description: 'Codigo unico de jurisdiccion' })
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z]{2}-[a-z]{2,3}-[a-z0-9-]+$/, {
    message: 'Code debe seguir el formato: pais-provincia-ciudad (ej: ar-sf-rosario)',
  })
  code: string;

  @ApiProperty({ example: 'Santa Fe', description: 'Nombre de la ciudad/municipio' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'AR', description: 'Codigo de pais ISO 3166-1 alpha-2' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  country?: string;

  @ApiPropertyOptional({ example: 'Santa Fe', description: 'Nombre de la provincia' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;
}

export class UpdateJurisdictionDto extends PartialType(CreateJurisdictionDto) {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class JurisdictionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'ar-sf-rosario' })
  code: string;

  @ApiProperty({ example: 'Rosario' })
  name: string;

  @ApiProperty({ example: 'AR' })
  country: string;

  @ApiPropertyOptional({ example: 'Santa Fe' })
  province?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Cantidad de plantillas disponibles' })
  templateCount?: number;

  @ApiPropertyOptional({ description: 'Cantidad de organizaciones usando esta jurisdiccion' })
  organizationCount?: number;
}

export class JurisdictionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'ar-sf-rosario' })
  code: string;

  @ApiProperty({ example: 'Rosario' })
  name: string;

  @ApiPropertyOptional({ example: 'Santa Fe' })
  province?: string;
}
