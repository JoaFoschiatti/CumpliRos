import { Request } from 'express';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
}

export interface OrganizationContext {
  organizationId: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  organization?: OrganizationContext;
}
