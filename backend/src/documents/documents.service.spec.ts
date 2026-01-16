import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentsService } from './documents.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockPrismaService = {
  document: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  obligation: {
    findFirst: vi.fn(),
  },
  task: {
    findFirst: vi.fn(),
  },
};

const mockStorageService = {
  getUploadUrl: vi.fn(),
  getDownloadUrl: vi.fn(),
  getObjectMetadata: vi.fn(),
  deleteFile: vi.fn(),
  generateFileKey: vi.fn(),
};

const mockAuditService = {
  log: vi.fn(),
};

describe('DocumentsService', () => {
  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(
      mockPrismaService as any,
      mockStorageService as any,
      mockAuditService as any,
    );
  });

  describe('create', () => {
    const organizationId = 'org-123';
    const userId = 'user-123';
    const validFile = {
      fileName: 'test.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      fileKey: 'org/org-123/docs/test.pdf',
    };

    it('should create a document successfully', async () => {
      const mockDocument = {
        id: 'doc-123',
        organizationId,
        uploadedByUserId: userId,
        ...validFile,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedAt: new Date(),
        uploadedBy: { id: userId, fullName: 'Test User', email: 'test@test.com' },
      };

      mockStorageService.getObjectMetadata.mockResolvedValue({ sizeBytes: 1024, mimeType: 'application/pdf' });
      mockPrismaService.document.create.mockResolvedValue(mockDocument);

      const result = await service.create(organizationId, userId, validFile);

      expect(result.id).toBe('doc-123');
      expect(result.fileName).toBe(validFile.fileName);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const invalidFile = { ...validFile, mimeType: 'application/exe' };

      mockStorageService.getObjectMetadata.mockResolvedValue({ sizeBytes: 1024, mimeType: 'application/exe' });
      await expect(service.create(organizationId, userId, invalidFile)).rejects.toThrow(
        'Tipo de archivo no permitido',
      );
    });

    it('should throw BadRequestException for file exceeding max size', async () => {
      const largeFile = { ...validFile, sizeBytes: 20 * 1024 * 1024 }; // 20MB

      mockStorageService.getObjectMetadata.mockResolvedValue({ sizeBytes: 20 * 1024 * 1024, mimeType: 'application/pdf' });
      await expect(service.create(organizationId, userId, largeFile)).rejects.toThrow(
        'El archivo excede el tamaño máximo permitido (10 MB)',
      );
    });

    it('should validate obligation belongs to organization', async () => {
      mockStorageService.getObjectMetadata.mockResolvedValue({ sizeBytes: 1024, mimeType: 'application/pdf' });
      mockPrismaService.obligation.findFirst.mockResolvedValue(null);

      await expect(
        service.create(organizationId, userId, validFile, 'obl-123'),
      ).rejects.toThrow('Obligación no encontrada');
    });

    it('should validate task belongs to organization', async () => {
      mockStorageService.getObjectMetadata.mockResolvedValue({ sizeBytes: 1024, mimeType: 'application/pdf' });
      mockPrismaService.task.findFirst.mockResolvedValue(null);

      await expect(
        service.create(organizationId, userId, validFile, undefined, 'task-123'),
      ).rejects.toThrow('Tarea no encontrada');
    });
  });

  describe('findOne', () => {
    it('should return document with signed URL', async () => {
      const mockDocument = {
        id: 'doc-123',
        organizationId: 'org-123',
        fileName: 'test.pdf',
        fileKey: 'org/org-123/docs/test.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedAt: new Date(),
        uploadedBy: { id: 'user-123', fullName: 'Test User', email: 'test@test.com' },
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);
      mockStorageService.getDownloadUrl.mockResolvedValue('https://signed-url.com/test.pdf');

      const result = await service.findOne('org-123', 'doc-123');

      expect(result.signedUrl).toBe('https://signed-url.com/test.pdf');
    });

    it('should throw NotFoundException if document not found', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'doc-123')).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete document and file from S3', async () => {
      const mockDocument = {
        id: 'doc-123',
        organizationId: 'org-123',
        fileKey: 'org/org-123/docs/test.pdf',
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);
      mockStorageService.deleteFile.mockResolvedValue(undefined);
      mockPrismaService.document.delete.mockResolvedValue({});

      await service.delete('org-123', 'doc-123');

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockDocument.fileKey);
      expect(mockPrismaService.document.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException if document not found', async () => {
      mockPrismaService.document.findFirst.mockResolvedValue(null);

      await expect(service.delete('org-123', 'doc-123')).rejects.toThrow(NotFoundException);
    });

    it('should continue with database deletion even if S3 deletion fails', async () => {
      const mockDocument = {
        id: 'doc-123',
        organizationId: 'org-123',
        fileKey: 'org/org-123/docs/test.pdf',
      };

      mockPrismaService.document.findFirst.mockResolvedValue(mockDocument);
      mockStorageService.deleteFile.mockRejectedValue(new Error('S3 error'));
      mockPrismaService.document.delete.mockResolvedValue({});

      await expect(service.delete('org-123', 'doc-123')).resolves.not.toThrow();
      expect(mockPrismaService.document.delete).toHaveBeenCalled();
    });
  });

  describe('getUploadUrl', () => {
    it('should generate upload URL for valid MIME type', async () => {
      const fileKey = 'org/org-123/docs/123_test.pdf';
      const uploadUrl = 'https://s3.example.com/upload';

      mockStorageService.generateFileKey.mockReturnValue(fileKey);
      mockStorageService.getUploadUrl.mockResolvedValue(uploadUrl);

      const result = await service.getUploadUrl('org-123', 'test.pdf', 'application/pdf');

      expect(result.uploadUrl).toBe(uploadUrl);
      expect(result.fileKey).toBe(fileKey);
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      await expect(
        service.getUploadUrl('org-123', 'test.exe', 'application/exe'),
      ).rejects.toThrow('Tipo de archivo no permitido');
    });
  });

  describe('findAll', () => {
    it('should return paginated documents', async () => {
      const mockDocuments = [
        { id: 'doc-1', fileName: 'file1.pdf', uploadedAt: new Date() },
        { id: 'doc-2', fileName: 'file2.pdf', uploadedAt: new Date() },
      ];

      mockPrismaService.document.findMany.mockResolvedValue(mockDocuments);
      mockPrismaService.document.count.mockResolvedValue(2);

      const result = await service.findAll(
        'org-123',
        { page: 1, limit: 10, skip: 0, take: 10, sortOrder: 'desc' },
        {},
      );

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by obligationId', async () => {
      mockPrismaService.document.findMany.mockResolvedValue([]);
      mockPrismaService.document.count.mockResolvedValue(0);

      await service.findAll(
        'org-123',
        { page: 1, limit: 10, skip: 0, take: 10, sortOrder: 'desc' },
        { obligationId: 'obl-123' },
      );

      expect(mockPrismaService.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-123', obligationId: 'obl-123' },
        }),
      );
    });
  });
});
