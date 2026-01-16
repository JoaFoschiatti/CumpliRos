import { Module } from "@nestjs/common";
import {
  TemplatesController,
  OrganizationTemplatesController,
} from "./templates.controller";
import { TemplatesService } from "./templates.service";
import { JurisdictionsModule } from "../jurisdictions/jurisdictions.module";

@Module({
  imports: [JurisdictionsModule],
  controllers: [TemplatesController, OrganizationTemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
