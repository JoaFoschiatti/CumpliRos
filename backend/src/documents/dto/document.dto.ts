import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsInt, Min, MaxLength } from 'class-validator';

export class GetUploadUrlDto {
  @ApiProperty({ example: 'documento.pdf' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsString()
  @MaxLength(100)
  mimeType: string;
}

export class RegisterDocumentDto {
  @ApiProperty({ example: 'documento.pdf' })
  @IsString()
  @MaxLength(255)
  fileName: string;

  @ApiProperty({ example: 'org/<orgId>/docs/123_documento.pdf' })
  @IsString()
  @MaxLength(500)
  fileKey: string;

  @ApiPropertyOptional({ example: 'application/pdf', description: 'Opcional: se valida contra metadata del objeto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Opcional: no se confía (se valida contra metadata del objeto)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  sizeBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  obligationId?: string;
}

export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  obligationId?: string;

  @ApiPropertyOptional()
  taskId?: string;

  @ApiProperty()
  uploadedByUserId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  fileKey: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  uploadedAt: Date;

  @ApiPropertyOptional()
  uploadedBy?: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiPropertyOptional()
  signedUrl?: string;
}

export class DocumentFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  obligationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;
}
