import { Module } from "@nestjs/common";
import { JobsService } from "./jobs.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { ObligationsModule } from "../obligations/obligations.module";
import { DocumentsModule } from "../documents/documents.module";

@Module({
  imports: [NotificationsModule, ObligationsModule, DocumentsModule],
  providers: [JobsService],
})
export class JobsModule {}
