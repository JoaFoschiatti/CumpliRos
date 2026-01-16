import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDate, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportFilterDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class ComplianceReportDto {
  @ApiProperty()
  period: {
    from: Date;
    to: Date;
  };

  @ApiProperty()
  summary: {
    totalObligations: number;
    completed: number;
    pending: number;
    overdue: number;
    complianceRate: number;
  };

  @ApiProperty()
  byType: Array<{
    type: string;
    total: number;
    completed: number;
    complianceRate: number;
  }>;

  @ApiProperty()
  byLocation: Array<{
    locationId: string;
    locationName: string;
    total: number;
    completed: number;
    overdue: number;
    complianceRate: number;
  }>;

  @ApiProperty()
  timeline: Array<{
    date: string;
    completed: number;
    overdue: number;
  }>;
}

export class ObligationReportItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  dueDate: Date;

  @ApiPropertyOptional()
  locationName?: string;

  @ApiProperty()
  ownerName: string;

  @ApiProperty()
  documentsCount: number;

  @ApiProperty()
  hasApprovedReview: boolean;
}
