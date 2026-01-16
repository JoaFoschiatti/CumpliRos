import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../common/prisma/prisma.service";
import { StorageService } from "../common/storage/storage.service";
import { AuditService } from "../audit/audit.service";
import { AuditActions } from "../audit/dto/audit.dto";
import { DocumentResponseDto, DocumentFilterDto } from "./dto/document.dto";
import {
  PaginationDto,
  createPaginatedResponse,
  PaginatedResponse,
} from "../common/dto/pagination.dto";

// Allowed MIME types for document upload with their valid extensions
const MIME_TYPE_EXTENSIONS: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
};

const ALLOWED_MIME_TYPES = Object.keys(MIME_TYPE_EXTENSIONS);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

type DocumentWithUploader = Prisma.DocumentGetPayload<{
  include: {
    uploadedBy: { select: { id: true; fullName: true; email: true } };
  };
}>;

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    userId: string,
    file: {
      fileName: string;
      fileKey: string;
      mimeType?: string;
      sizeBytes?: number;
    },
    obligationId?: string,
    taskId?: string,
  ): Promise<DocumentResponseDto> {
    // SECURITY: Validate fileKey belongs to this organization
    const expectedPrefix = `org/${organizationId}/`;
    if (!file.fileKey.startsWith(expectedPrefix)) {
      this.logger.warn(
        `Security: Invalid fileKey attempted. Expected prefix: ${expectedPrefix}, got: ${file.fileKey}`,
      );
      throw new ForbiddenException(
        "El archivo no pertenece a esta organización",
      );
    }

    // Verify uploaded object exists and validate against real metadata (do not trust client values)
    let objectMeta: { sizeBytes: number; mimeType?: string };
    try {
      objectMeta = await this.storageService.getObjectMetadata(file.fileKey);
    } catch (error) {
      this.logger.warn(
        `Could not read object metadata for ${file.fileKey}: ${this.formatErrorMessage(error)}`,
      );
      throw new BadRequestException(
        "No se encontró el archivo subido o no es accesible",
      );
    }

    const actualMimeType = objectMeta.mimeType || file.mimeType;
    if (!actualMimeType) {
      throw new BadRequestException("No se pudo determinar el tipo de archivo");
    }

    // Validate MIME type (based on actual object metadata when possible)
    if (!ALLOWED_MIME_TYPES.includes(actualMimeType)) {
      // Best-effort cleanup: remove invalid upload
      try {
        await this.storageService.deleteFile(file.fileKey);
      } catch (cleanupError) {
        this.logger.warn(
          `Could not cleanup invalid upload ${file.fileKey}: ${this.formatErrorMessage(cleanupError)}`,
        );
      }
      throw new BadRequestException("Tipo de archivo no permitido");
    }

    // If client declared a MIME type, ensure it matches the stored object metadata
    if (
      file.mimeType &&
      objectMeta.mimeType &&
      file.mimeType !== objectMeta.mimeType
    ) {
      this.logger.warn(
        `Security: MIME type mismatch. Declared: ${file.mimeType}, Stored: ${objectMeta.mimeType}, Key: ${file.fileKey}`,
      );
      throw new BadRequestException(
        "El tipo de archivo no coincide con el declarado",
      );
    }

    // SECURITY: Validate file extension matches declared MIME type
    const fileExtension = this.getFileExtension(file.fileName);
    const allowedExtensions = MIME_TYPE_EXTENSIONS[actualMimeType] || [];
    if (!allowedExtensions.includes(fileExtension)) {
      this.logger.warn(
        `Security: File extension mismatch. MIME: ${actualMimeType}, Extension: ${fileExtension}, File: ${file.fileName}`,
      );
      throw new BadRequestException(
        "La extensión del archivo no coincide con el tipo declarado",
      );
    }

    // Validate file size
    const actualSize = objectMeta.sizeBytes;
    if (actualSize > MAX_FILE_SIZE) {
      // Best-effort cleanup: remove oversized upload
      try {
        await this.storageService.deleteFile(file.fileKey);
      } catch (cleanupError) {
        this.logger.warn(
          `Could not cleanup oversized upload ${file.fileKey}: ${this.formatErrorMessage(cleanupError)}`,
        );
      }
      throw new BadRequestException(
        "El archivo excede el tamaño máximo permitido (10 MB)",
      );
    }

    // Verify obligation belongs to organization if provided
    if (obligationId) {
      const obligation = await this.prisma.obligation.findFirst({
        where: { id: obligationId, organizationId },
      });
      if (!obligation) {
        throw new BadRequestException("Obligación no encontrada");
      }
    }

    // Verify task belongs to organization if provided
    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, obligation: { organizationId } },
      });
      if (!task) {
        throw new BadRequestException("Tarea no encontrada");
      }
    }

    const document = await this.prisma.document.create({
      data: {
        organizationId,
        obligationId,
        taskId,
        uploadedByUserId: userId,
        fileName: file.fileName,
        fileKey: file.fileKey,
        mimeType: actualMimeType,
        sizeBytes: actualSize,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.DOCUMENT_UPLOADED,
      "Document",
      document.id,
      userId,
      {
        fileName: document.fileName,
        fileKey: document.fileKey,
        mimeType: document.mimeType,
        sizeBytes: document.sizeBytes,
        obligationId: document.obligationId ?? undefined,
        taskId: document.taskId ?? undefined,
      },
    );

    return this.enrichDocument(document);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters: DocumentFilterDto,
  ): Promise<PaginatedResponse<DocumentResponseDto>> {
    const where: Prisma.DocumentWhereInput = { organizationId };

    if (filters.obligationId) {
      where.obligationId = filters.obligationId;
    }
    if (filters.taskId) {
      where.taskId = filters.taskId;
    }

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { uploadedAt: pagination.sortOrder },
        include: {
          uploadedBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    const enrichedDocs = await Promise.all(
      documents.map((d) => this.enrichDocument(d)),
    );

    return createPaginatedResponse(
      enrichedDocs,
      total,
      pagination.page!,
      pagination.limit!,
    );
  }

  async findOne(
    organizationId: string,
    documentId: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!document) {
      throw new NotFoundException("Documento no encontrado");
    }

    return this.enrichDocument(document, true);
  }

  async delete(
    organizationId: string,
    documentId: string,
    userId?: string,
  ): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException("Documento no encontrado");
    }

    // Delete file from S3
    try {
      await this.storageService.deleteFile(document.fileKey);
      this.logger.log(`File deleted from S3: ${document.fileKey}`);
    } catch (error) {
      this.logger.warn(
        `Could not delete file from S3: ${this.formatErrorMessage(error)}`,
      );
      // Continue with database deletion even if S3 deletion fails
    }

    await this.prisma.document.delete({
      where: { id: documentId },
    });

    await this.auditService.log(
      organizationId,
      AuditActions.DOCUMENT_DELETED,
      "Document",
      documentId,
      userId,
      { fileName: document.fileName, fileKey: document.fileKey },
    );
  }

  async getUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException("Tipo de archivo no permitido");
    }

    // SECURITY: Validate file extension matches declared MIME type early
    const fileExtension = this.getFileExtension(fileName);
    const allowedExtensions = MIME_TYPE_EXTENSIONS[mimeType] || [];
    if (!allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        "La extensión del archivo no coincide con el tipo declarado",
      );
    }

    // Generate unique file key
    const fileKey = this.storageService.generateFileKey(
      organizationId,
      fileName,
    );

    // Generate pre-signed URL from S3
    const uploadUrl = await this.storageService.getUploadUrl(fileKey, mimeType);

    this.logger.debug(`Generated upload URL for file: ${fileKey}`);

    return { uploadUrl, fileKey };
  }

  async purgeExpiredDocuments(): Promise<number> {
    // Enforce per-organization retention windows and clean up storage + DB.
    const organizations = await this.prisma.organization.findMany({
      where: { active: true },
      select: { id: true, retentionMonths: true },
    });

    let totalDeleted = 0;

    for (const organization of organizations) {
      if (!organization.retentionMonths || organization.retentionMonths <= 0) {
        continue;
      }

      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - organization.retentionMonths);

      const documents = await this.prisma.document.findMany({
        where: {
          organizationId: organization.id,
          uploadedAt: { lt: cutoff },
        },
      });

      if (documents.length === 0) {
        continue;
      }

      for (const document of documents) {
        try {
          await this.storageService.deleteFile(document.fileKey);
        } catch (error) {
          this.logger.warn(
            `Could not delete file ${document.fileKey}: ${this.formatErrorMessage(error)}`,
          );
        }

        // Log deletions so audits reflect automated retention cleanup.
        await this.auditService.log(
          organization.id,
          AuditActions.DOCUMENT_DELETED,
          "Document",
          document.id,
          undefined,
          {
            fileName: document.fileName,
            fileKey: document.fileKey,
            reason: "retention_policy",
          },
        );
      }

      await this.prisma.document.deleteMany({
        where: { id: { in: documents.map((doc) => doc.id) } },
      });

      totalDeleted += documents.length;
    }

    return totalDeleted;
  }

  private async enrichDocument(
    document: DocumentWithUploader,
    includeSignedUrl = false,
  ): Promise<DocumentResponseDto> {
    const result: DocumentResponseDto = {
      id: document.id,
      organizationId: document.organizationId,
      obligationId: document.obligationId ?? undefined,
      taskId: document.taskId ?? undefined,
      uploadedByUserId: document.uploadedByUserId,
      fileName: document.fileName,
      fileKey: document.fileKey,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy ?? undefined,
    };

    if (includeSignedUrl) {
      // Generate signed URL for download
      try {
        result.signedUrl = await this.storageService.getDownloadUrl(
          document.fileKey,
        );
      } catch (error) {
        this.logger.warn(
          `Could not generate signed URL: ${this.formatErrorMessage(error)}`,
        );
        result.signedUrl = undefined;
      }
    }

    return result;
  }

  /**
   * Extract file extension from filename (lowercase)
   */
  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
      return "";
    }
    return fileName.slice(lastDotIndex).toLowerCase();
  }

  private formatErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
