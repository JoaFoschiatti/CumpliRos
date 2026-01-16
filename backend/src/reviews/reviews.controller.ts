import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, ReviewResponseDto } from './dto/review.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ACCOUNTANT, Role.MANAGER)
  @ApiOperation({ summary: 'Crear revisión de obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Revisión creada', type: ReviewResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    return this.reviewsService.create(organizationId, user.id, dto);
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(Role.OWNER, Role.ACCOUNTANT, Role.MANAGER)
  @ApiOperation({ summary: 'Listar obligaciones pendientes de revisión' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Lista de revisiones pendientes' })
  async findPending(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<ReviewResponseDto>> {
    return this.reviewsService.findPendingReviews(organizationId, pagination);
  }

  @Get('obligation/:obligationId')
  @ApiOperation({ summary: 'Listar revisiones de una obligación' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'obligationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Lista de revisiones' })
  async findByObligation(
    @Param('organizationId') organizationId: string,
    @Param('obligationId') obligationId: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<ReviewResponseDto>> {
    return this.reviewsService.findByObligation(organizationId, obligationId, pagination);
  }
}
