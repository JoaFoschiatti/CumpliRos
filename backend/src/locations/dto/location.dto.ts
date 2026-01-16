import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsString, IsOptional, MaxLength, IsBoolean } from "class-validator";

export class CreateLocationDto {
  @ApiProperty({ example: "Local Centro" })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: "Av. Pellegrini 1234, Rosario" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ example: "Comercio minorista" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  rubric?: string;
}

export class UpdateLocationDto extends PartialType(CreateLocationDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class LocationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional({ nullable: true })
  address?: string | null;

  @ApiPropertyOptional({ nullable: true })
  rubric?: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  _count?: {
    obligations: number;
  };
}
