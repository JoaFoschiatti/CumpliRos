import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiErrorDetail {
  @ApiProperty()
  code: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  field?: string;
}

export class ApiErrorResponse {
  @ApiProperty()
  statusCode: number;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional({ type: [ApiErrorDetail] })
  errors?: ApiErrorDetail[];

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional()
  path?: string;
}

export class ApiSuccessResponse<T> {
  @ApiProperty()
  data: T;

  @ApiPropertyOptional()
  message?: string;
}
