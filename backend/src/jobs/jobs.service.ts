import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { ObligationsService } from "../obligations/obligations.service";
import { NotificationsService } from "../notifications/notifications.service";
import { DocumentsService } from "../documents/documents.service";

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly obligationsService: ObligationsService,
    private readonly notificationsService: NotificationsService,
    private readonly documentsService: DocumentsService,
    private readonly configService: ConfigService,
  ) {}

  // Daily maintenance: update overdue status and send notifications.
  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyComplianceJobs(): Promise<void> {
    if (!this.isJobsEnabled()) {
      return;
    }

    try {
      const updated = await this.obligationsService.updateOverdueObligations();
      this.logger.log(`Overdue obligations updated: ${updated}`);
    } catch (error) {
      this.logger.error(
        `Failed to update overdue obligations: ${this.formatErrorMessage(error)}`,
      );
    }

    try {
      const upcoming =
        await this.notificationsService.notifyUpcomingObligations();
      this.logger.log(`Upcoming notifications sent: ${upcoming}`);
    } catch (error) {
      this.logger.error(
        `Failed to send upcoming notifications: ${this.formatErrorMessage(error)}`,
      );
    }

    try {
      const overdue =
        await this.notificationsService.notifyOverdueObligations();
      this.logger.log(`Overdue notifications sent: ${overdue}`);
    } catch (error) {
      this.logger.error(
        `Failed to send overdue notifications: ${this.formatErrorMessage(error)}`,
      );
    }
  }

  // Monthly retention cleanup (1st day at 03:00).
  @Cron("0 3 1 * *")
  async runMonthlyRetentionJob(): Promise<void> {
    if (!this.isJobsEnabled() || !this.isRetentionEnabled()) {
      return;
    }

    try {
      const purged = await this.documentsService.purgeExpiredDocuments();
      this.logger.log(`Retention cleanup removed ${purged} documents`);
    } catch (error) {
      this.logger.error(
        `Retention cleanup failed: ${this.formatErrorMessage(error)}`,
      );
    }
  }

  private isJobsEnabled(): boolean {
    const value = this.configService.get<string>("JOBS_ENABLED");
    return value !== "false";
  }

  private isRetentionEnabled(): boolean {
    const value = this.configService.get<string>("DOCUMENT_RETENTION_ENABLED");
    return value !== "false";
  }

  private formatErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
