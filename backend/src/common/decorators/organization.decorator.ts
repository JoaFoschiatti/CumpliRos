import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  AuthenticatedRequest,
  OrganizationContext,
} from "../interfaces/request.interface";

export const CurrentOrganization = createParamDecorator(
  (data: keyof OrganizationContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const organization = request.organization;

    return data ? organization?.[data] : organization;
  },
);
