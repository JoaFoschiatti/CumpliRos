import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JurisdictionsService, ROSARIO_JURISDICTION_CODE } from './jurisdictions.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  jurisdiction: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  organization: {
    updateMany: vi.fn(),
  },
};

describe('JurisdictionsService', () => {
  let service: JurisdictionsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new JurisdictionsService(mockPrismaService as any);
  });

  describe('create', () => {
    const createDto = {
      code: 'ar-sf-santa-fe',
      name: 'Santa Fe',
      country: 'AR',
      province: 'Santa Fe',
    };

    it('should create a new jurisdiction', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(null);
      mockPrismaService.jurisdiction.create.mockResolvedValue({
        id: 'juris-123',
        ...createDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id', 'juris-123');
      expect(result).toHaveProperty('code', createDto.code);
      expect(result).toHaveProperty('name', createDto.name);
      expect(mockPrismaService.jurisdiction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: createDto.code,
          name: createDto.name,
          country: 'AR',
          province: createDto.province,
          isActive: true,
        }),
      });
    });

    it('should throw ConflictException if code already exists', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue({
        id: 'existing-juris',
        code: createDto.code,
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllActive', () => {
    it('should return only active jurisdictions', async () => {
      const mockJurisdictions = [
        { id: '1', code: 'ar-sf-rosario', name: 'Rosario', province: 'Santa Fe' },
        { id: '2', code: 'ar-sf-santa-fe', name: 'Santa Fe', province: 'Santa Fe' },
      ];

      mockPrismaService.jurisdiction.findMany.mockResolvedValue(mockJurisdictions);

      const result = await service.findAllActive();

      expect(result).toHaveLength(2);
      expect(mockPrismaService.jurisdiction.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          province: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return jurisdiction by id', async () => {
      const mockJurisdiction = {
        id: 'juris-123',
        code: 'ar-sf-rosario',
        name: 'Rosario',
        country: 'AR',
        province: 'Santa Fe',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { obligationTemplates: 5, organizations: 10 },
      };

      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(mockJurisdiction);

      const result = await service.findOne('juris-123');

      expect(result).toHaveProperty('id', 'juris-123');
      expect(result).toHaveProperty('templateCount', 5);
      expect(result).toHaveProperty('organizationCount', 10);
    });

    it('should throw NotFoundException if jurisdiction not found', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return jurisdiction by code', async () => {
      const mockJurisdiction = {
        id: 'juris-123',
        code: ROSARIO_JURISDICTION_CODE,
        name: 'Rosario',
        country: 'AR',
        province: 'Santa Fe',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { obligationTemplates: 5, organizations: 10 },
      };

      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(mockJurisdiction);

      const result = await service.findByCode(ROSARIO_JURISDICTION_CODE);

      expect(result).toHaveProperty('code', ROSARIO_JURISDICTION_CODE);
    });

    it('should throw NotFoundException if code not found', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(null);

      await expect(service.findByCode('non-existent-code')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update jurisdiction', async () => {
      const existingJurisdiction = {
        id: 'juris-123',
        code: 'ar-sf-rosario',
        name: 'Rosario',
        _count: { obligationTemplates: 0, organizations: 0 },
      };

      mockPrismaService.jurisdiction.findUnique
        .mockResolvedValueOnce(existingJurisdiction) // findOne check
        .mockResolvedValueOnce(existingJurisdiction); // update return

      mockPrismaService.jurisdiction.update.mockResolvedValue({
        ...existingJurisdiction,
        name: 'Rosario Updated',
        _count: { obligationTemplates: 0, organizations: 0 },
      });

      const result = await service.update('juris-123', { name: 'Rosario Updated' });

      expect(result).toHaveProperty('name', 'Rosario Updated');
    });
  });

  describe('deactivate', () => {
    it('should deactivate jurisdiction', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue({
        id: 'juris-123',
        isActive: true,
        _count: { obligationTemplates: 0, organizations: 0 },
      });
      mockPrismaService.jurisdiction.update.mockResolvedValue({});

      await service.deactivate('juris-123');

      expect(mockPrismaService.jurisdiction.update).toHaveBeenCalledWith({
        where: { id: 'juris-123' },
        data: { isActive: false },
      });
    });
  });

  describe('getDefaultJurisdiction', () => {
    it('should return Rosario as default jurisdiction', async () => {
      const rosario = {
        id: '00000000-0000-0000-0000-000000000001',
        code: ROSARIO_JURISDICTION_CODE,
        name: 'Rosario',
        _count: { obligationTemplates: 10, organizations: 5 },
      };

      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(rosario);

      const result = await service.getDefaultJurisdiction();

      expect(result).toHaveProperty('code', ROSARIO_JURISDICTION_CODE);
      expect(mockPrismaService.jurisdiction.findUnique).toHaveBeenCalledWith({
        where: { code: ROSARIO_JURISDICTION_CODE },
        include: expect.any(Object),
      });
    });

    it('should return null if Rosario not found', async () => {
      mockPrismaService.jurisdiction.findUnique.mockResolvedValue(null);

      const result = await service.getDefaultJurisdiction();

      expect(result).toBeNull();
    });
  });
});
