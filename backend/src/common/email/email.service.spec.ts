import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailService } from "./email.service";

// Mock Resend
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(function () {
    return {
      emails: {
        send: vi.fn(),
      },
    };
  }),
}));

import { Resend } from "resend";

describe("EmailService", () => {
  let service: EmailService;
  let mockResendSend: any;

  describe("Development mode (no API key)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      const mockConfigService = {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            RESEND_API_KEY: "re_xxxx", // Placeholder key
            EMAIL_FROM: "Test <test@test.com>",
          };
          return config[key];
        }),
      };
      service = new EmailService(mockConfigService as any);
    });

    it("should log emails in development mode", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = await service.sendEmail({
        to: "recipient@test.com",
        subject: "Test Subject",
        text: "Test body",
      });

      expect(result).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe("Production mode (with API key)", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResendSend = vi.fn();
      vi.mocked(Resend).mockImplementation(function () {
        return {
          emails: { send: mockResendSend },
        } as any;
      });

      const mockConfigService = {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            RESEND_API_KEY: "re_valid_api_key_123",
            EMAIL_FROM: "CumpliRos <noreply@cumpliros.com>",
          };
          return config[key];
        }),
      };
      service = new EmailService(mockConfigService as any);
    });

    it("should send email successfully", async () => {
      mockResendSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      const result = await service.sendEmail({
        to: "recipient@test.com",
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });

      expect(result).toBe(true);
    });

    it("should return false on API error", async () => {
      mockResendSend.mockResolvedValue({
        data: null,
        error: { message: "API Error" },
      });

      const result = await service.sendEmail({
        to: "recipient@test.com",
        subject: "Test",
        text: "Test",
      });

      expect(result).toBe(false);
    });

    it("should handle send exceptions", async () => {
      mockResendSend.mockRejectedValue(new Error("Network error"));

      const result = await service.sendEmail({
        to: "recipient@test.com",
        subject: "Test",
        text: "Test",
      });

      expect(result).toBe(false);
    });

    it("should send to multiple recipients", async () => {
      mockResendSend.mockResolvedValue({
        data: { id: "email-123" },
        error: null,
      });

      const result = await service.sendEmail({
        to: ["user1@test.com", "user2@test.com"],
        subject: "Test",
        text: "Test",
      });

      expect(result).toBe(true);
      expect(mockResendSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ["user1@test.com", "user2@test.com"],
        }),
      );
    });
  });

  describe("Email template methods", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mockResendSend = vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null });
      vi.mocked(Resend).mockImplementation(function () {
        return {
          emails: { send: mockResendSend },
        } as any;
      });

      const mockConfigService = {
        get: vi.fn((key: string) => {
          const config: Record<string, string> = {
            RESEND_API_KEY: "re_valid_api_key_123",
            EMAIL_FROM: "CumpliRos <noreply@cumpliros.com>",
          };
          return config[key];
        }),
      };
      service = new EmailService(mockConfigService as any);
    });

    describe("sendUpcomingObligationsEmail", () => {
      it("should send upcoming obligations email with urgent count", async () => {
        const result = await service.sendUpcomingObligationsEmail(
          "user@test.com",
          "John Doe",
          "Test Organization",
          [
            { title: "Tax Payment", daysUntilDue: 3 },
            { title: "Permit Renewal", daysUntilDue: 10 },
          ],
          1,
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining("[URGENTE]"),
          }),
        );
      });

      it("should send non-urgent email when no urgent obligations", async () => {
        const result = await service.sendUpcomingObligationsEmail(
          "user@test.com",
          "John Doe",
          "Test Organization",
          [{ title: "Tax Payment", daysUntilDue: 15 }],
          0,
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.not.stringContaining("[URGENTE]"),
          }),
        );
      });
    });

    describe("sendOverdueObligationsEmail", () => {
      it("should send overdue obligations email", async () => {
        const result = await service.sendOverdueObligationsEmail(
          "owner@test.com",
          "Test Organization",
          [
            { title: "Tax Payment", ownerName: "John Doe" },
            { title: "Permit Renewal", ownerName: "Jane Smith" },
          ],
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining("[VENCIDO]"),
          }),
        );
      });
    });

    describe("sendReviewRequiredEmail", () => {
      it("should send review required email", async () => {
        const result = await service.sendReviewRequiredEmail(
          "reviewer@test.com",
          "Jane Reviewer",
          "Test Organization",
          "Tax Payment Q1",
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining("Revisión requerida"),
          }),
        );
      });
    });

    describe("sendReviewRejectedEmail", () => {
      it("should send review rejected email", async () => {
        const result = await service.sendReviewRejectedEmail(
          "owner@test.com",
          "John Owner",
          "Test Organization",
          "Tax Payment Q1",
          "Jane Reviewer",
          "Missing documentation",
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            subject: expect.stringContaining("Revisión rechazada"),
          }),
        );
      });
    });

    describe("sendInvitationEmail", () => {
      it("should send invitation email with correct URL", async () => {
        const result = await service.sendInvitationEmail(
          "newuser@test.com",
          "Test Organization",
          "John Admin",
          "ADMIN",
          "invite-token-123",
          "https://app.cumpliros.com",
        );

        expect(result).toBe(true);
        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            to: ["newuser@test.com"],
            subject: expect.stringContaining("Invitación"),
          }),
        );
      });

      it("should translate role to Spanish", async () => {
        await service.sendInvitationEmail(
          "newuser@test.com",
          "Test Organization",
          "John Admin",
          "ACCOUNTANT",
          "invite-token-123",
          "https://app.cumpliros.com",
        );

        expect(mockResendSend).toHaveBeenCalledWith(
          expect.objectContaining({
            html: expect.stringContaining("Contador"),
          }),
        );
      });
    });
  });
});
