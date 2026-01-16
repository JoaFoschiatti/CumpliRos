import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService } from './storage.service';

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
  GetObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  CreateBucketCommand: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const mockConfigService = {
  get: vi.fn((key: string) => {
    const config: Record<string, string> = {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'testkey',
      S3_SECRET_KEY: 'testsecret',
      S3_BUCKET: 'test-bucket',
    };
    return config[key];
  }),
};

describe('StorageService', () => {
  let service: StorageService;
  let mockS3Send: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Send = vi.fn();
    vi.mocked(S3Client).mockImplementation(() => ({
      send: mockS3Send,
    }) as any);

    service = new StorageService(mockConfigService as any);
  });

  describe('generateFileKey', () => {
    it('should generate a unique file key with organization prefix', () => {
      const organizationId = 'org-123';
      const fileName = 'test document.pdf';

      const result = service.generateFileKey(organizationId, fileName);

      expect(result).toMatch(/^org\/org-123\/docs\/\d+_test_document\.pdf$/);
    });

    it('should sanitize special characters in file name', () => {
      const organizationId = 'org-123';
      const fileName = 'test@#$%^&*()document.pdf';

      const result = service.generateFileKey(organizationId, fileName);

      expect(result).not.toContain('@');
      expect(result).not.toContain('#');
      expect(result).not.toContain('$');
    });
  });

  describe('getUploadUrl', () => {
    it('should generate pre-signed upload URL', async () => {
      const fileKey = 'org/org-123/docs/test.pdf';
      const mimeType = 'application/pdf';
      const expectedUrl = 'https://s3.example.com/presigned-upload';

      vi.mocked(getSignedUrl).mockResolvedValue(expectedUrl);

      const result = await service.getUploadUrl(fileKey, mimeType);

      expect(result).toBe(expectedUrl);
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it('should use default expiration time of 3600 seconds', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://url');

      await service.getUploadUrl('test-key', 'application/pdf');

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 },
      );
    });

    it('should allow custom expiration time', async () => {
      vi.mocked(getSignedUrl).mockResolvedValue('https://url');

      await service.getUploadUrl('test-key', 'application/pdf', 7200);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 },
      );
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate pre-signed download URL', async () => {
      const fileKey = 'org/org-123/docs/test.pdf';
      const expectedUrl = 'https://s3.example.com/presigned-download';

      vi.mocked(getSignedUrl).mockResolvedValue(expectedUrl);

      const result = await service.getDownloadUrl(fileKey);

      expect(result).toBe(expectedUrl);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3', async () => {
      const fileKey = 'org/org-123/docs/test.pdf';
      mockS3Send.mockResolvedValue({});

      await expect(service.deleteFile(fileKey)).resolves.not.toThrow();
      expect(mockS3Send).toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should check if bucket exists on module init', async () => {
      mockS3Send.mockResolvedValue({});

      await service.onModuleInit();

      expect(mockS3Send).toHaveBeenCalled();
    });

    it('should create bucket if it does not exist', async () => {
      mockS3Send
        .mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } })
        .mockResolvedValueOnce({});

      await service.onModuleInit();

      expect(mockS3Send).toHaveBeenCalledTimes(2);
    });
  });
});
