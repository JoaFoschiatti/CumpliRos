import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObligationsService } from './obligations.service';
import { TrafficLight } from './dto/obligation.dto';

// Mock PrismaService
const mockPrismaService = {
  organization: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  obligation: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  location: {
    findFirst: vi.fn(),
  },
  userOrg: {
    findFirst: vi.fn(),
  },
};

describe('ObligationsService', () => {
  let service: ObligationsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ObligationsService(mockPrismaService as any);
  });

  describe('calculateTrafficLight', () => {
    const thresholdYellow = 15;
    const thresholdRed = 7;

    it('should return GREEN for COMPLETED status', () => {
      const dueDate = new Date();
      const result = service.calculateTrafficLight(dueDate, 'COMPLETED' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.GREEN);
      expect(result.daysUntilDue).toBe(0);
    });

    it('should return GREEN for NOT_APPLICABLE status', () => {
      const dueDate = new Date();
      const result = service.calculateTrafficLight(dueDate, 'NOT_APPLICABLE' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.GREEN);
      expect(result.daysUntilDue).toBe(0);
    });

    it('should return RED for OVERDUE status', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 5); // 5 days ago
      const result = service.calculateTrafficLight(dueDate, 'OVERDUE' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.RED);
    });

    it('should return RED when due date is within red threshold', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5); // 5 days from now (within 7 day red threshold)
      const result = service.calculateTrafficLight(dueDate, 'PENDING' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.RED);
      expect(result.daysUntilDue).toBeLessThanOrEqual(thresholdRed);
    });

    it('should return YELLOW when due date is within yellow threshold but outside red', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 10); // 10 days from now (within 15, outside 7)
      const result = service.calculateTrafficLight(dueDate, 'PENDING' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.YELLOW);
      expect(result.daysUntilDue).toBeGreaterThan(thresholdRed);
      expect(result.daysUntilDue).toBeLessThanOrEqual(thresholdYellow);
    });

    it('should return GREEN when due date is beyond yellow threshold', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30); // 30 days from now
      const result = service.calculateTrafficLight(dueDate, 'PENDING' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.GREEN);
      expect(result.daysUntilDue).toBeGreaterThan(thresholdYellow);
    });

    it('should return RED for past due dates regardless of status', () => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() - 1); // Yesterday
      const result = service.calculateTrafficLight(dueDate, 'PENDING' as any, thresholdYellow, thresholdRed);

      expect(result.trafficLight).toBe(TrafficLight.RED);
      expect(result.daysUntilDue).toBeLessThan(0);
    });
  });

  describe('create', () => {
    const organizationId = 'org-123';
    const createDto = {
      title: 'Test Obligation',
      description: 'Test Description',
      type: 'TAX' as any,
      dueDate: new Date('2024-12-31'),
      ownerUserId: 'user-123',
    };

    it('should create an obligation successfully', async () => {
      const mockOrganization = {
        id: organizationId,
        thresholdYellowDays: 15,
        thresholdRedDays: 7,
      };
      const mockObligation = {
        id: 'obl-123',
        organizationId,
        ...createDto,
        status: 'PENDING',
        createdAt: new Date(),
        location: null,
        owner: { id: 'user-123', fullName: 'Test User', email: 'test@test.com' },
        _count: { documents: 0, tasks: 0, reviews: 0 },
      };

      mockPrismaService.userOrg.findFirst.mockResolvedValue({ userId: 'user-123', organizationId });
      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrismaService.obligation.create.mockResolvedValue(mockObligation);

      const result = await service.create(organizationId, createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('obl-123');
      expect(result.title).toBe(createDto.title);
      expect(mockPrismaService.obligation.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if owner does not belong to organization', async () => {
      mockPrismaService.userOrg.findFirst.mockResolvedValue(null);

      await expect(service.create(organizationId, createDto)).rejects.toThrow(
        'El usuario responsable no pertenece a esta organización',
      );
    });

    it('should throw BadRequestException if location does not belong to organization', async () => {
      const dtoWithLocation = { ...createDto, locationId: 'loc-123' };
      mockPrismaService.location.findFirst.mockResolvedValue(null);

      await expect(service.create(organizationId, dtoWithLocation)).rejects.toThrow(
        'Local no encontrado o no pertenece a esta organización',
      );
    });
  });

  describe('updateStatus', () => {
    const organizationId = 'org-123';
    const obligationId = 'obl-123';

    it('should throw BadRequestException when completing without required evidence', async () => {
      const mockOrganization = { id: organizationId, thresholdYellowDays: 15, thresholdRedDays: 7 };
      const mockObligation = {
        id: obligationId,
        requiredEvidenceCount: 2,
        requiresReview: false,
        documents: [{ id: 'doc-1' }], // Only 1 document, need 2
        reviews: [],
      };

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrismaService.obligation.findFirst.mockResolvedValue(mockObligation);

      await expect(service.updateStatus(organizationId, obligationId, 'COMPLETED' as any)).rejects.toThrow(
        'Se requieren al menos 2 evidencias para completar esta obligación',
      );
    });

    it('should throw BadRequestException when completing without required review', async () => {
      const mockOrganization = { id: organizationId, thresholdYellowDays: 15, thresholdRedDays: 7 };
      const mockObligation = {
        id: obligationId,
        requiredEvidenceCount: 0,
        requiresReview: true,
        documents: [],
        reviews: [], // No approved reviews
      };

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrismaService.obligation.findFirst.mockResolvedValue(mockObligation);

      await expect(service.updateStatus(organizationId, obligationId, 'COMPLETED' as any)).rejects.toThrow(
        'Esta obligación requiere aprobación antes de poder ser completada',
      );
    });
  });

  describe('updateOverdueObligations', () => {
    it('should update pending/in_progress obligations past due date to overdue', async () => {
      mockPrismaService.obligation.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.updateOverdueObligations();

      expect(result).toBe(5);
      expect(mockPrismaService.obligation.updateMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: expect.any(Date) },
        },
        data: { status: 'OVERDUE' },
      });
    });
  });

  describe('getDashboard', () => {
    it('should return dashboard statistics', async () => {
      const organizationId = 'org-123';
      const mockOrganization = { id: organizationId, thresholdYellowDays: 15, thresholdRedDays: 7 };
      const mockObligations = [
        { id: '1', status: 'COMPLETED', dueDate: new Date(), organizationId },
        { id: '2', status: 'PENDING', dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), organizationId },
        { id: '3', status: 'OVERDUE', dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), organizationId },
      ];

      mockPrismaService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockPrismaService.obligation.findMany.mockResolvedValue(mockObligations);

      const result = await service.getDashboard(organizationId);

      expect(result).toBeDefined();
      expect(result.total).toBe(3);
      expect(result.completed).toBe(1);
    });
  });
});
