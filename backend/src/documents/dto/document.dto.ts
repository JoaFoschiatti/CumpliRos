import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';

export class UploadDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  obligationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;
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
