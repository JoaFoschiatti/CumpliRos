import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { ReviewStatus, Role, ObligationStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuditActions } from '../audit/dto/audit.dto';
import { CreateReviewDto, ReviewResponseDto } from './dto/review.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    reviewerUserId: string,
    dto: CreateReviewDto,
  ): Promise<ReviewResponseDto> {
    // Verify obligation belongs to organization
    const obligation = await this.prisma.obligation.findFirst({
      where: { id: dto.obligationId, organizationId },
    });

    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }

    if (!obligation.requiresReview) {
      throw new BadRequestException('Esta obligación no requiere revisión');
    }

    // Verify user has permission to review (ACCOUNTANT, MANAGER, or OWNER)
    const membership = await this.prisma.userOrg.findFirst({
      where: { userId: reviewerUserId, organizationId },
    });

    if (!membership) {
      throw new ForbiddenException('No tienes acceso a esta organización');
    }

    const allowedRoles: Role[] = [Role.OWNER, Role.ACCOUNTANT, Role.MANAGER];
    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('No tienes permisos para realizar revisiones');
    }

    // Require comment for rejection
    if (dto.status === ReviewStatus.REJECTED && !dto.comment) {
      throw new BadRequestException('Se requiere un comentario para rechazar la revisión');
    }

    const review = await this.prisma.review.create({
      data: {
        obligationId: dto.obligationId,
        reviewerUserId,
        status: dto.status,
        comment: dto.comment,
      },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
      },
    });

    // If rejected, set obligation status back to IN_PROGRESS
    if (dto.status === ReviewStatus.REJECTED) {
      await this.prisma.obligation.update({
        where: { id: dto.obligationId },
        data: { status: ObligationStatus.IN_PROGRESS },
      });
    }

    const action =
      dto.status === ReviewStatus.APPROVED
        ? AuditActions.REVIEW_APPROVED
        : dto.status === ReviewStatus.REJECTED
          ? AuditActions.REVIEW_REJECTED
          : AuditActions.REVIEW_SUBMITTED;

    await this.auditService.log(
      organizationId,
      action,
      'Review',
      review.id,
      reviewerUserId,
      {
        obligationId: dto.obligationId,
        status: dto.status,
        comment: dto.comment ?? undefined,
      },
    );

    return this.enrichReview(review);
  }

  async findByObligation(
    organizationId: string,
    obligationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<ReviewResponseDto>> {
    // Verify obligation belongs to organization
    const obligation = await this.prisma.obligation.findFirst({
      where: { id: obligationId, organizationId },
    });

    if (!obligation) {
      throw new NotFoundException('Obligación no encontrada');
    }

    const where = { obligationId };

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, fullName: true, email: true } },
          obligation: { select: { id: true, title: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    const enrichedReviews = reviews.map((r) => this.enrichReview(r));

    return createPaginatedResponse(enrichedReviews, total, pagination.page!, pagination.limit!);
  }

  async findPendingReviews(
    organizationId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<ReviewResponseDto>> {
    // Find obligations that require review but don't have an approved review
    const obligationsWithPendingReview = await this.prisma.obligation.findMany({
      where: {
        organizationId,
        requiresReview: true,
        status: { notIn: [ObligationStatus.COMPLETED, ObligationStatus.NOT_APPLICABLE] },
        reviews: {
          none: { status: ReviewStatus.APPROVED },
        },
      },
      select: { id: true },
    });

    const obligationIds = obligationsWithPendingReview.map((o) => o.id);

    if (obligationIds.length === 0) {
      return createPaginatedResponse([], 0, pagination.page!, pagination.limit!);
    }

    // Get the latest review for each obligation (if any)
    const reviews = await this.prisma.review.findMany({
      where: { obligationId: { in: obligationIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
      },
    });

    // Group by obligation and get latest
    const latestByObligation = new Map<string, typeof reviews[0]>();
    for (const review of reviews) {
      if (!latestByObligation.has(review.obligationId)) {
        latestByObligation.set(review.obligationId, review);
      }
    }

    const enrichedReviews = Array.from(latestByObligation.values()).map((r) => this.enrichReview(r));

    return createPaginatedResponse(
      enrichedReviews.slice(pagination.skip, pagination.skip + pagination.take),
      enrichedReviews.length,
      pagination.page!,
      pagination.limit!,
    );
  }

  async getLatestApprovedReview(obligationId: string): Promise<ReviewResponseDto | null> {
    const review = await this.prisma.review.findFirst({
      where: {
        obligationId,
        status: ReviewStatus.APPROVED,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        reviewer: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
      },
    });

    return review ? this.enrichReview(review) : null;
  }

  private enrichReview(review: any): ReviewResponseDto {
    return {
      id: review.id,
      obligationId: review.obligationId,
      reviewerUserId: review.reviewerUserId,
      status: review.status,
      comment: review.comment ?? undefined,
      createdAt: review.createdAt,
      reviewer: review.reviewer ?? undefined,
      obligation: review.obligation ?? undefined,
    };
  }
}
