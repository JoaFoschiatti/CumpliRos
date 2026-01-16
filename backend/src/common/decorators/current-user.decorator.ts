import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "../interfaces/request.interface";

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
