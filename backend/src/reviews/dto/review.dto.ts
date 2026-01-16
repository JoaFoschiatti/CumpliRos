import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ReviewStatus } from '@prisma/client';

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID()
  obligationId: string;

  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @ApiPropertyOptional({ description: 'Requerido si el estado es REJECTED' })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  obligationId: string;

  @ApiProperty()
  reviewerUserId: string;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional()
  comment?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  reviewer?: {
    id: string;
    fullName: string;
    email: string;
  };

  @ApiPropertyOptional()
  obligation?: {
    id: string;
    title: string;
  };
}
