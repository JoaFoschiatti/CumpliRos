import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service';
import { ObligationStatus } from '@prisma/client';

interface EmailNotification {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async sendEmail(notification: EmailNotification): Promise<void> {
    // TODO: Implement actual email sending with Resend/Postmark/SendGrid
    console.log(`[EMAIL] To: ${notification.to}`);
    console.log(`[EMAIL] Subject: ${notification.subject}`);
    console.log(`[EMAIL] Body: ${notification.body}`);
  }

  async notifyUpcomingObligations(): Promise<number> {
    // Get all organizations
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
          status: { in: [ObligationStatus.PENDING, ObligationStatus.IN_PROGRESS] },
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
        const daysUntilDue = obligations.map((o) => {
          const due = new Date(o.dueDate);
          return Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        });

        const urgentCount = obligations.filter(
          (_, i) => daysUntilDue[i] <= org.thresholdRedDays,
        ).length;

        const subject = urgentCount > 0
          ? `[URGENTE] ${urgentCount} obligaciones próximas a vencer - ${org.name}`
          : `${obligations.length} obligaciones próximas a vencer - ${org.name}`;

        const obligationsList = obligations
          .map((o, i) => `- ${o.title} (vence en ${daysUntilDue[i]} días)`)
          .join('\n');

        const body = `Hola ${owner.fullName},

Tienes ${obligations.length} obligación(es) próxima(s) a vencer en ${org.name}:

${obligationsList}

Por favor, revisa el panel de cumplimiento para más detalles.

Saludos,
CumpliRos`;

        await this.sendEmail({ to: email, subject, body });
        notificationsSent++;
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

      // Also get owners
      const owners = await this.prisma.userOrg.findMany({
        where: {
          organizationId: org.id,
          role: 'OWNER',
        },
        include: {
          user: { select: { email: true, fullName: true } },
        },
      });

      if (overdueObligations.length > 0 && owners.length > 0) {
        const obligationsList = overdueObligations
          .map((o) => `- ${o.title} (responsable: ${o.owner.fullName})`)
          .join('\n');

        const subject = `[VENCIDO] ${overdueObligations.length} obligaciones vencidas - ${org.name}`;

        const body = `Alerta: Hay ${overdueObligations.length} obligación(es) vencida(s) en ${org.name}:

${obligationsList}

Por favor, tome acción inmediata.

Saludos,
CumpliRos`;

        for (const ownerMembership of owners) {
          await this.sendEmail({
            to: ownerMembership.user.email,
            subject,
            body,
          });
          notificationsSent++;
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
    const subject = `Revisión requerida: ${obligationTitle} - ${organizationName}`;

    const body = `Hola ${reviewerName},

Se requiere tu revisión para la siguiente obligación:

Obligación: ${obligationTitle}
Organización: ${organizationName}

Por favor, accede al panel de cumplimiento para revisar y aprobar o rechazar.

Saludos,
CumpliRos`;

    await this.sendEmail({ to: reviewerEmail, subject, body });
  }

  async notifyReviewRejected(
    ownerEmail: string,
    ownerName: string,
    organizationName: string,
    obligationTitle: string,
    reviewerName: string,
    comment: string,
  ): Promise<void> {
    const subject = `Revisión rechazada: ${obligationTitle} - ${organizationName}`;

    const body = `Hola ${ownerName},

La revisión de la siguiente obligación ha sido rechazada:

Obligación: ${obligationTitle}
Revisado por: ${reviewerName}
Observaciones: ${comment}

Por favor, corrige las observaciones y vuelve a enviar para revisión.

Saludos,
CumpliRos`;

    await this.sendEmail({ to: ownerEmail, subject, body });
  }
}
