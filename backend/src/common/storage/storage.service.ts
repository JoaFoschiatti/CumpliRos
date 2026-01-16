import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const region = this.configService.get<string>('S3_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');
    this.bucket = this.configService.get<string>('S3_BUCKET') || 'cumpliros-docs';

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
      forcePathStyle: true, // Required for MinIO compatibility
    });
  }

  async onModuleInit() {
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket '${this.bucket}' exists and is accessible`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
          this.logger.log(`Bucket '${this.bucket}' created successfully`);
        } catch (createError: any) {
          this.logger.warn(`Could not create bucket: ${createError.message}`);
        }
      } else {
        this.logger.warn(`Could not check bucket existence: ${error.message}`);
      }
    }
  }

  /**
   * Generate a pre-signed URL for uploading a file
   */
  async getUploadUrl(
    fileKey: string,
    mimeType: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: mimeType,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return signedUrl;
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  async getDownloadUrl(
    fileKey: string,
    expiresInSeconds: number = 3600,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: expiresInSeconds,
    });

    return signedUrl;
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(fileKey: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    await this.s3Client.send(command);
    this.logger.debug(`File deleted: ${fileKey}`);
  }

  /**
   * Read object metadata (size/type) from S3.
   * Useful to validate uploads instead of trusting client-provided values.
   */
  async getObjectMetadata(fileKey: string): Promise<{ sizeBytes: number; mimeType?: string }> {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    const result = await this.s3Client.send(command);

    return {
      sizeBytes: result.ContentLength ?? 0,
      mimeType: result.ContentType,
    };
  }

  /**
   * Generate a unique file key for storage
   */
  generateFileKey(organizationId: string, fileName: string): string {
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `org/${organizationId}/docs/${timestamp}_${sanitizedFileName}`;
  }
}
