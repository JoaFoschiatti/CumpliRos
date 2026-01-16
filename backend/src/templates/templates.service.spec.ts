import { describe, it, expect, beforeEach, vi } from "vitest";
import { TemplatesService } from "./templates.service";
import { NotFoundException, BadRequestException } from "@nestjs/common";

const mockPrismaService = {
  obligationTemplate: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    deleteMany: vi.fn(),
  },
  checklistTemplateItem: {
    createMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  organization: {
    findUnique: vi.fn(),
  },
  obligation: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  task: {
    create: vi.fn(),
  },
  taskItem: {
    createMany: vi.fn(),
  },
};

const mockJurisdictionsService = {
  findOne: vi.fn(),
  findByCode: vi.fn(),
};

describe("TemplatesService", () => {
  let service: TemplatesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TemplatesService(
      mockPrismaService as any,
      mockJurisdictionsService as any,
    );
  });

  describe("findOne", () => {
    it("should return template by id", async () => {
      const mockTemplate = {
        id: "template-123",
        jurisdictionId: "juris-123",
        templateKey: "rosario.gastronomia.habilitacion",
        rubric: "gastronomia",
        title: "Habilitacion Comercial",
        type: "PERMIT",
        defaultPeriodicity: "ANNUAL",
        severity: "CRITICAL",
        isActive: true,
        version: 1,
        checklistItems: [
          { id: "1", description: "Item 1", order: 0, isRequired: true },
        ],
      };

      mockPrismaService.obligationTemplate.findUnique.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.findOne("template-123");

      expect(result).toHaveProperty("id", "template-123");
      expect(result).toHaveProperty(
        "templateKey",
        "rosario.gastronomia.habilitacion",
      );
      expect(result.checklistItems).toHaveLength(1);
    });

    it("should throw NotFoundException if template not found", async () => {
      mockPrismaService.obligationTemplate.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("findByKey", () => {
    it("should return template by templateKey", async () => {
      const mockTemplate = {
        id: "template-123",
        templateKey: "rosario.gastronomia.habilitacion",
        rubric: "gastronomia",
        title: "Habilitacion Comercial",
        checklistItems: [],
      };

      mockPrismaService.obligationTemplate.findUnique.mockResolvedValue(
        mockTemplate,
      );

      const result = await service.findByKey(
        "rosario.gastronomia.habilitacion",
      );

      expect(result).toHaveProperty(
        "templateKey",
        "rosario.gastronomia.habilitacion",
      );
    });
  });

  describe("findByJurisdictionAndRubric", () => {
    it("should return templates for jurisdiction and rubric", async () => {
      const mockTemplates = [
        {
          id: "1",
          templateKey: "rosario.gastronomia.habilitacion",
          title: "Habilitacion",
          rubric: "gastronomia",
          type: "PERMIT",
          defaultPeriodicity: "ANNUAL",
          severity: "CRITICAL",
          _count: { checklistItems: 5 },
        },
        {
          id: "2",
          templateKey: "rosario.gastronomia.bromatologia",
          title: "Inspeccion Bromatologica",
          rubric: "gastronomia",
          type: "INSPECTION",
          defaultPeriodicity: "SEMIANNUAL",
          severity: "HIGH",
          _count: { checklistItems: 3 },
        },
      ];

      mockPrismaService.obligationTemplate.findMany.mockResolvedValue(
        mockTemplates,
      );

      const result = await service.findByJurisdictionAndRubric(
        "juris-123",
        "gastronomia",
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("checklistItemCount", 5);
    });
  });

  describe("getRubrics", () => {
    it("should return available rubrics with counts", async () => {
      mockPrismaService.obligationTemplate.groupBy.mockResolvedValue([
        { rubric: "gastronomia", _count: { id: 6 } },
        { rubric: "comercio", _count: { id: 4 } },
        { rubric: "estetica", _count: { id: 4 } },
      ]);

      const result = await service.getRubrics();

      expect(result).toHaveLength(3);
      expect(result[0]).toHaveProperty("rubric", "gastronomia");
      expect(result[0]).toHaveProperty("displayName", "Gastronomia");
      expect(result[0]).toHaveProperty("templateCount", 6);
    });
  });

  describe("applyToOrganization", () => {
    const organizationId = "org-123";
    const userId = "user-123";

    beforeEach(() => {
      mockPrismaService.organization.findUnique.mockResolvedValue({
        id: organizationId,
        jurisdictionId: "juris-rosario",
        jurisdiction: { code: "ar-sf-rosario" },
        userOrgs: [{ userId }],
      });
    });

    it("should apply templates and create obligations", async () => {
      const templates = [
        {
          id: "t1",
          title: "Habilitacion",
          type: "PERMIT",
          defaultPeriodicity: "ANNUAL",
          requiresReview: true,
          requiredEvidenceCount: 1,
          checklistItems: [{ id: "c1", description: "Item 1", order: 0 }],
        },
      ];

      mockPrismaService.obligationTemplate.findMany.mockResolvedValue(
        templates,
      );
      mockPrismaService.obligation.findMany.mockResolvedValue([]);
      mockPrismaService.obligation.create.mockResolvedValue({ id: "obl-1" });
      mockPrismaService.task.create.mockResolvedValue({ id: "task-1" });
      mockPrismaService.taskItem.createMany.mockResolvedValue({ count: 1 });

      const result = await service.applyToOrganization(
        organizationId,
        { rubric: "gastronomia" },
        userId,
      );

      expect(result.obligationsCreated).toBe(1);
      expect(result.tasksCreated).toBe(1);
      expect(result.obligationIds).toContain("obl-1");
    });

    it("should not duplicate existing obligations", async () => {
      const templates = [
        {
          id: "t1",
          title: "Habilitacion",
          type: "PERMIT",
          defaultPeriodicity: "ANNUAL",
          requiresReview: false,
          requiredEvidenceCount: 0,
          checklistItems: [],
        },
      ];

      // Ya existe una obligacion con el mismo titulo
      mockPrismaService.obligationTemplate.findMany.mockResolvedValue(
        templates,
      );
      mockPrismaService.obligation.findMany.mockResolvedValue([
        { title: "Habilitacion" },
      ]);

      const result = await service.applyToOrganization(
        organizationId,
        { rubric: "gastronomia" },
        userId,
      );

      expect(result.obligationsCreated).toBe(0);
      expect(mockPrismaService.obligation.create).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException if no templates found", async () => {
      mockPrismaService.obligationTemplate.findMany.mockResolvedValue([]);

      await expect(
        service.applyToOrganization(
          organizationId,
          { rubric: "unknown" },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException if organization not found", async () => {
      mockPrismaService.organization.findUnique.mockResolvedValue(null);

      await expect(
        service.applyToOrganization(
          "non-existent",
          { rubric: "gastronomia" },
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("create", () => {
    it("should create a new template with checklist", async () => {
      mockJurisdictionsService.findOne.mockResolvedValue({ id: "juris-123" });

      const mockCreatedTemplate = {
        id: "template-new",
        jurisdictionId: "juris-123",
        templateKey: "rosario.gastronomia.nueva",
        rubric: "gastronomia",
        title: "Nueva Obligacion",
        type: "PERMIT",
        isActive: true,
        checklistItems: [],
      };

      mockPrismaService.obligationTemplate.create.mockResolvedValue(
        mockCreatedTemplate,
      );
      mockPrismaService.obligationTemplate.findUnique.mockResolvedValue({
        ...mockCreatedTemplate,
        checklistItems: [
          { id: "1", description: "Item", order: 0, isRequired: true },
        ],
      });
      mockPrismaService.checklistTemplateItem.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.create({
        jurisdictionId: "juris-123",
        templateKey: "rosario.gastronomia.nueva",
        rubric: "gastronomia",
        title: "Nueva Obligacion",
        type: "PERMIT",
        defaultPeriodicity: "ANNUAL",
        requiresReview: true,
        requiredEvidenceCount: 1,
        severity: "HIGH",
        checklist: [{ description: "Item", isRequired: true }],
      });

      expect(result).toHaveProperty("id", "template-new");
      expect(
        mockPrismaService.checklistTemplateItem.createMany,
      ).toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("should deactivate template", async () => {
      mockPrismaService.obligationTemplate.findUnique.mockResolvedValue({
        id: "template-123",
        isActive: true,
        checklistItems: [],
      });
      mockPrismaService.obligationTemplate.update.mockResolvedValue({});

      await service.deactivate("template-123");

      expect(mockPrismaService.obligationTemplate.update).toHaveBeenCalledWith({
        where: { id: "template-123" },
        data: { isActive: false },
      });
    });
  });
});
