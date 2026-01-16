import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskItemDto,
  UpdateTaskItemDto,
  TaskResponseDto,
  TaskItemResponseDto,
} from './dto/task.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/request.interface';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationGuard)
@Controller('organizations/:organizationId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @ApiOperation({ summary: 'Crear nueva tarea' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Tarea creada', type: TaskResponseDto })
  async create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.create(organizationId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar tareas de la organización' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiQuery({ name: 'obligationId', required: false })
  @ApiQuery({ name: 'assignedToUserId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: TaskStatus })
  @ApiResponse({ status: 200, description: 'Lista de tareas' })
  async findAll(
    @Param('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('obligationId') obligationId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('status') status?: TaskStatus,
  ): Promise<PaginatedResponse<TaskResponseDto>> {
    return this.tasksService.findAll(organizationId, pagination, {
      obligationId,
      assignedToUserId,
      status,
    });
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Obtener detalles de tarea' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Detalles de la tarea', type: TaskResponseDto })
  async findOne(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskResponseDto> {
    return this.tasksService.findOne(organizationId, taskId);
  }

  @Patch(':taskId')
  @ApiOperation({ summary: 'Actualizar tarea' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Tarea actualizada', type: TaskResponseDto })
  async update(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(organizationId, taskId, dto, user.id);
  }

  @Delete(':taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar tarea' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiResponse({ status: 204, description: 'Tarea eliminada' })
  async delete(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.tasksService.delete(organizationId, taskId, user.id);
  }

  // Task Items (Checklist)
  @Post(':taskId/items')
  @ApiOperation({ summary: 'Agregar ítem al checklist' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiResponse({ status: 201, description: 'Ítem creado', type: TaskItemResponseDto })
  async addItem(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskItemResponseDto> {
    return this.tasksService.addItem(organizationId, taskId, dto, user.id);
  }

  @Patch(':taskId/items/:itemId')
  @ApiOperation({ summary: 'Actualizar ítem del checklist' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'itemId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Ítem actualizado', type: TaskItemResponseDto })
  async updateItem(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateTaskItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskItemResponseDto> {
    return this.tasksService.updateItem(organizationId, taskId, itemId, dto, user.id);
  }

  @Post(':taskId/items/:itemId/toggle')
  @ApiOperation({ summary: 'Marcar/desmarcar ítem del checklist' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'itemId', type: 'string' })
  @ApiResponse({ status: 200, description: 'Ítem actualizado', type: TaskItemResponseDto })
  async toggleItem(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TaskItemResponseDto> {
    return this.tasksService.toggleItem(organizationId, taskId, itemId, user.id);
  }

  @Delete(':taskId/items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar ítem del checklist' })
  @ApiParam({ name: 'organizationId', type: 'string' })
  @ApiParam({ name: 'taskId', type: 'string' })
  @ApiParam({ name: 'itemId', type: 'string' })
  @ApiResponse({ status: 204, description: 'Ítem eliminado' })
  async deleteItem(
    @Param('organizationId') organizationId: string,
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.tasksService.deleteItem(organizationId, taskId, itemId, user.id);
  }
}
