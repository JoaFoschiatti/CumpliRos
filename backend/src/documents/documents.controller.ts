import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { DocumentResponseDto, DocumentFilterDto } from './dto/document.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload-url')
  @ApiOperation({ summary: 'Obtener URL pre-firmada para subir documento' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 200, description: 'URL de subida generada' })
  async getUploadUrl(
    @Param('organizationId') organizationId: string,
    @Body() dto: { fileName: string; mimeType: string },
  ): Promise<{ uploadUrl: string; fileKey: string }> {
    return this.documentsService.getUploadUrl(organizationId, dto.fileName, dto.mimeType);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar documento subido' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Documento registrado', type: DocumentResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    dto: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      fileKey: string;
      obligationId?: string;
      taskId?: string;
    },
  ): Promise<DocumentResponseDto> {
    return this.documentsService.create(
      organizationId,
      user.id,
      {
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        fileKey: dto.fileKey,
      },
      dto.obligationId,
      dto.taskId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Listar documentos de la organización' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiQuery({ name: 'obligationId', required: false })
  @ApiQuery({ name: 'taskId', required: false })
  @ApiResponse({ status: 200, description: 'Lista de documentos' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query() filters: DocumentFilterDto,
  ): Promise<PaginatedResponse<DocumentResponseDto>> {
    return this.documentsService.findAll(organizationId, pagination, filters);
  }

  @Get(':documentId')
  @ApiOperation({ summary: 'Obtener documento con URL de descarga' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'documentId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Documento', type: DocumentResponseDto })
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ): Promise<DocumentResponseDto> {
    return this.documentsService.findOne(organizationId, documentId);
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar documento' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'documentId', type: 'string' })
  @ApiResponse({ status: 204, description: 'Documento eliminado' })
  async delete(
    @Param('organizationId') organizationId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.documentsService.delete(organizationId, documentId);
  }
}
