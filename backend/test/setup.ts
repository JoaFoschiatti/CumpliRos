import { vi } from "vitest";

// Mock environment variables for testing
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret";
process.env.JWT_EXPIRES_IN = "1d";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.S3_ENDPOINT = "http://localhost:9000";
process.env.S3_ACCESS_KEY = "testkey";
process.env.S3_SECRET_KEY = "testsecret";
process.env.S3_BUCKET = "test-bucket";
process.env.RESEND_API_KEY = "re_test_key";
process.env.EMAIL_FROM = "Test <test@test.com>";
process.env.CORS_ORIGINS = "http://localhost:3000";

// Global test utilities
vi.mock("@prisma/client", () => {
  return {
    PrismaClient: vi.fn(),
    Role: {
      OWNER: "OWNER",
      ADMIN: "ADMIN",
      ACCOUNTANT: "ACCOUNTANT",
      MANAGER: "MANAGER",
    },
    Plan: {
      BASIC: "BASIC",
      PROFESSIONAL: "PROFESSIONAL",
      STUDIO: "STUDIO",
    },
    ObligationStatus: {
      PENDING: "PENDING",
      IN_PROGRESS: "IN_PROGRESS",
      COMPLETED: "COMPLETED",
      OVERDUE: "OVERDUE",
      NOT_APPLICABLE: "NOT_APPLICABLE",
    },
    ObligationType: {
      TAX: "TAX",
      PERMIT: "PERMIT",
      INSURANCE: "INSURANCE",
      INSPECTION: "INSPECTION",
      DECLARATION: "DECLARATION",
      RENEWAL: "RENEWAL",
      OTHER: "OTHER",
    },
    TaskStatus: {
      OPEN: "OPEN",
      IN_PROGRESS: "IN_PROGRESS",
      BLOCKED: "BLOCKED",
      COMPLETED: "COMPLETED",
      CANCELLED: "CANCELLED",
    },
    ReviewStatus: {
      PENDING: "PENDING",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    },
    InvitationStatus: {
      PENDING: "PENDING",
      ACCEPTED: "ACCEPTED",
      EXPIRED: "EXPIRED",
      CANCELLED: "CANCELLED",
    },
  };
});
