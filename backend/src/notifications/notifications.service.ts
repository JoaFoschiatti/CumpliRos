import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../common/prisma/prisma.service";
import { EmailService } from "../common/email/email.service";
import { ObligationStatus } from "@prisma/client";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async notifyUpcomingObligations(): Promise<number> {
    // Get all active organizations
    const organizations = await this.prisma.organization.findMany({
      where: { active: true },
    });

    let notificationsSent = 0;

    for (const org of organizations) {
      const now = new Date();
      const yellowThreshold = new Date();
      yellowThreshold.setDate(now.getDate() + org.thresholdYellowDays);

      // Get obligations that are approaching due date
      const upcomingObligations = await this.prisma.obligation.findMany({
        where: {
          organizationId: org.id,
          status: {
            in: [ObligationStatus.PENDING, ObligationStatus.IN_PROGRESS],
          },
          dueDate: {
            gte: now,
            lte: yellowThreshold,
          },
        },
        include: {
          owner: { select: { email: true, fullName: true } },
        },
      });

      // Group by owner
      const byOwner = new Map<string, typeof upcomingObligations>();
      for (const obl of upcomingObligations) {
        const ownerEmail = obl.owner.email;
        if (!byOwner.has(ownerEmail)) {
          byOwner.set(ownerEmail, []);
        }
        byOwner.get(ownerEmail)!.push(obl);
      }

      // Send notification to each owner
      for (const [email, obligations] of byOwner) {
        const owner = obligations[0].owner;
        const obligationsWithDays = obligations.map((o) => {
          const due = new Date(o.dueDate);
          const daysUntilDue = Math.floor(
            (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          );
          return { title: o.title, daysUntilDue };
        });

        const urgentCount = obligationsWithDays.filter(
          (o) => o.daysUntilDue <= org.thresholdRedDays,
        ).length;

        const sent = await this.emailService.sendUpcomingObligationsEmail(
          email,
          owner.fullName,
          org.name,
          obligationsWithDays,
          urgentCount,
        );

        if (sent) {
          notificationsSent++;
          this.logger.log(`Sent upcoming obligations notification to ${email}`);
        }
      }
    }

    return notificationsSent;
  }

  async notifyOverdueObligations(): Promise<number> {
    const organizations = await this.prisma.organization.findMany({
      where: { active: true },
    });

    let notificationsSent = 0;

    for (const org of organizations) {
      // Get overdue obligations
      const overdueObligations = await this.prisma.obligation.findMany({
        where: {
          organizationId: org.id,
          status: ObligationStatus.OVERDUE,
        },
        include: {
          owner: { select: { email: true, fullName: true } },
        },
      });

      if (overdueObligations.length === 0) {
        continue;
      }

      // Get organization owners
      const owners = await this.prisma.userOrg.findMany({
        where: {
          organizationId: org.id,
          role: "OWNER",
        },
        include: {
          user: { select: { email: true, fullName: true } },
        },
      });

      if (owners.length > 0) {
        const obligationsData = overdueObligations.map((o) => ({
          title: o.title,
          ownerName: o.owner.fullName,
        }));

        // Send notification to each owner
        for (const ownerMembership of owners) {
          const sent = await this.emailService.sendOverdueObligationsEmail(
            ownerMembership.user.email,
            org.name,
            obligationsData,
          );

          if (sent) {
            notificationsSent++;
            this.logger.log(
              `Sent overdue obligations notification to ${ownerMembership.user.email}`,
            );
          }
        }
      }
    }

    return notificationsSent;
  }

  async notifyReviewRequired(
    obligationId: string,
    reviewerEmail: string,
    reviewerName: string,
    organizationName: string,
    obligationTitle: string,
  ): Promise<void> {
    await this.emailService.sendReviewRequiredEmail(
      reviewerEmail,
      reviewerName,
      organizationName,
      obligationTitle,
    );

    this.logger.log(
      `Sent review required notification to ${reviewerEmail} for obligation ${obligationId}`,
    );
  }

  async notifyReviewRejected(
    ownerEmail: string,
    ownerName: string,
    organizationName: string,
    obligationTitle: string,
    reviewerName: string,
    comment: string,
  ): Promise<void> {
    await this.emailService.sendReviewRejectedEmail(
      ownerEmail,
      ownerName,
      organizationName,
      obligationTitle,
      reviewerName,
      comment,
    );

    this.logger.log(`Sent review rejected notification to ${ownerEmail}`);
  }
}
