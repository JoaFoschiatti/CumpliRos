import { describe, it, expect, beforeEach, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

const mockPrismaService = {
  organization: {
    findMany: vi.fn(),
  },
  obligation: {
    findMany: vi.fn(),
  },
  userOrg: {
    findMany: vi.fn(),
  },
};

const mockEmailService = {
  sendUpcomingObligationsEmail: vi.fn(),
  sendOverdueObligationsEmail: vi.fn(),
  sendReviewRequiredEmail: vi.fn(),
  sendReviewRejectedEmail: vi.fn(),
};

describe("NotificationsService", () => {
  let service: NotificationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationsService(
      mockPrismaService as any,
      mockEmailService as any,
    );
  });

  describe("notifyUpcomingObligations", () => {
    it("should send notifications to obligation owners", async () => {
      const mockOrganizations = [
        {
          id: "org-1",
          name: "Org 1",
          active: true,
          thresholdYellowDays: 15,
          thresholdRedDays: 7,
        },
      ];
      const mockObligations = [
        {
          id: "obl-1",
          title: "Tax Payment",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
          owner: { email: "owner@test.com", fullName: "Owner Name" },
        },
        {
          id: "obl-2",
          title: "Permit Renewal",
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days
          owner: { email: "owner@test.com", fullName: "Owner Name" },
        },
      ];

      mockPrismaService.organization.findMany.mockResolvedValue(
        mockOrganizations,
      );
      mockPrismaService.obligation.findMany.mockResolvedValue(mockObligations);
      mockEmailService.sendUpcomingObligationsEmail.mockResolvedValue(true);

      const result = await service.notifyUpcomingObligations();

      expect(result).toBe(1); // One notification sent (grouped by owner)
      expect(
        mockEmailService.sendUpcomingObligationsEmail,
      ).toHaveBeenCalledWith(
        "owner@test.com",
        "Owner Name",
        "Org 1",
        expect.any(Array),
        expect.any(Number),
      );
    });

    it("should group obligations by owner", async () => {
      const mockOrganizations = [
        {
          id: "org-1",
          name: "Org 1",
          active: true,
          thresholdYellowDays: 15,
          thresholdRedDays: 7,
        },
      ];
      const mockObligations = [
        {
          id: "obl-1",
          title: "Tax Payment",
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          owner: { email: "owner1@test.com", fullName: "Owner 1" },
        },
        {
          id: "obl-2",
          title: "Permit Renewal",
          dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          owner: { email: "owner2@test.com", fullName: "Owner 2" },
        },
      ];

      mockPrismaService.organization.findMany.mockResolvedValue(
        mockOrganizations,
      );
      mockPrismaService.obligation.findMany.mockResolvedValue(mockObligations);
      mockEmailService.sendUpcomingObligationsEmail.mockResolvedValue(true);

      const result = await service.notifyUpcomingObligations();

      expect(result).toBe(2); // Two notifications (one per owner)
    });

    it("should return 0 when no upcoming obligations", async () => {
      mockPrismaService.organization.findMany.mockResolvedValue([
        { id: "org-1", thresholdYellowDays: 15, thresholdRedDays: 7 },
      ]);
      mockPrismaService.obligation.findMany.mockResolvedValue([]);

      const result = await service.notifyUpcomingObligations();

      expect(result).toBe(0);
    });
  });

  describe("notifyOverdueObligations", () => {
    it("should send notifications to organization owners", async () => {
      const mockOrganizations = [{ id: "org-1", name: "Org 1", active: true }];
      const mockOverdueObligations = [
        {
          id: "obl-1",
          title: "Overdue Tax",
          owner: { fullName: "Owner Name", email: "owner@test.com" },
        },
      ];
      const mockOwners = [
        { user: { email: "admin@test.com", fullName: "Admin" } },
      ];

      mockPrismaService.organization.findMany.mockResolvedValue(
        mockOrganizations,
      );
      mockPrismaService.obligation.findMany.mockResolvedValue(
        mockOverdueObligations,
      );
      mockPrismaService.userOrg.findMany.mockResolvedValue(mockOwners);
      mockEmailService.sendOverdueObligationsEmail.mockResolvedValue(true);

      const result = await service.notifyOverdueObligations();

      expect(result).toBe(1);
      expect(mockEmailService.sendOverdueObligationsEmail).toHaveBeenCalledWith(
        "admin@test.com",
        "Org 1",
        [{ title: "Overdue Tax", ownerName: "Owner Name" }],
      );
    });

    it("should skip organizations with no overdue obligations", async () => {
      mockPrismaService.organization.findMany.mockResolvedValue([
        { id: "org-1", name: "Org 1", active: true },
      ]);
      mockPrismaService.obligation.findMany.mockResolvedValue([]);

      const result = await service.notifyOverdueObligations();

      expect(result).toBe(0);
      expect(
        mockEmailService.sendOverdueObligationsEmail,
      ).not.toHaveBeenCalled();
    });
  });

  describe("notifyReviewRequired", () => {
    it("should send review required notification", async () => {
      mockEmailService.sendReviewRequiredEmail.mockResolvedValue(true);

      await service.notifyReviewRequired(
        "obl-123",
        "reviewer@test.com",
        "Reviewer Name",
        "Test Org",
        "Tax Payment Q1",
      );

      expect(mockEmailService.sendReviewRequiredEmail).toHaveBeenCalledWith(
        "reviewer@test.com",
        "Reviewer Name",
        "Test Org",
        "Tax Payment Q1",
      );
    });
  });

  describe("notifyReviewRejected", () => {
    it("should send review rejected notification", async () => {
      mockEmailService.sendReviewRejectedEmail.mockResolvedValue(true);

      await service.notifyReviewRejected(
        "owner@test.com",
        "Owner Name",
        "Test Org",
        "Tax Payment Q1",
        "Reviewer Name",
        "Missing documents",
      );

      expect(mockEmailService.sendReviewRejectedEmail).toHaveBeenCalledWith(
        "owner@test.com",
        "Owner Name",
        "Test Org",
        "Tax Payment Q1",
        "Reviewer Name",
        "Missing documents",
      );
    });
  });
});
