import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { DocumentResponseDto, DocumentFilterDto } from './dto/document.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

// Allowed MIME types for document upload
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  async create(
    organizationId: string,
    userId: string,
    file: { fileName: string; mimeType: string; sizeBytes: number; fileKey: string },
    obligationId?: string,
    taskId?: string,
  ): Promise<DocumentResponseDto> {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimeType)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    // Validate file size
    if (file.sizeBytes > MAX_FILE_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo permitido (10 MB)');
    }

    // Verify obligation belongs to organization if provided
    if (obligationId) {
      const obligation = await this.prisma.obligation.findFirst({
        where: { id: obligationId, organizationId },
      });
      if (!obligation) {
        throw new BadRequestException('Obligación no encontrada');
      }
    }

    // Verify task belongs to organization if provided
    if (taskId) {
      const task = await this.prisma.task.findFirst({
        where: { id: taskId, obligation: { organizationId } },
      });
      if (!task) {
        throw new BadRequestException('Tarea no encontrada');
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
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
      },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return this.enrichDocument(document);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters: DocumentFilterDto,
  ): Promise<PaginatedResponse<DocumentResponseDto>> {
    const where: any = { organizationId };

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

    const enrichedDocs = documents.map((d) => this.enrichDocument(d));

    return createPaginatedResponse(enrichedDocs, total, pagination.page!, pagination.limit!);
  }

  async findOne(organizationId: string, documentId: string): Promise<DocumentResponseDto> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
      include: {
        uploadedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    return this.enrichDocument(document, true);
  }

  async delete(organizationId: string, documentId: string): Promise<void> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, organizationId },
    });

    if (!document) {
      throw new NotFoundException('Documento no encontrado');
    }

    // TODO: Delete file from S3

    await this.prisma.document.delete({
      where: { id: documentId },
    });
  }

  async getUploadUrl(
    organizationId: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    // Generate unique file key
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileKey = `org/${organizationId}/docs/${timestamp}_${sanitizedFileName}`;

    // TODO: Generate pre-signed URL from S3
    const uploadUrl = `https://storage.example.com/${fileKey}`;

    return { uploadUrl, fileKey };
  }

  private enrichDocument(document: any, includeSignedUrl = false): DocumentResponseDto {
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
      // TODO: Generate signed URL for download
      result.signedUrl = `https://storage.example.com/${document.fileKey}`;
    }

    return result;
  }
}
