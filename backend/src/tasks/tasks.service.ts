import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { TaskStatus } from '@prisma/client';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskItemDto,
  UpdateTaskItemDto,
  TaskResponseDto,
  TaskItemResponseDto,
} from './dto/task.dto';
import { PaginationDto, createPaginatedResponse, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  private calculateProgress(items: { done: boolean }[]): number {
    if (items.length === 0) return 0;
    const completed = items.filter((i) => i.done).length;
    return Math.round((completed / items.length) * 100);
  }

  private enrichTask(task: any): TaskResponseDto {
    return {
      ...task,
      assignedToUserId: task.assignedToUserId ?? undefined,
      description: task.description ?? undefined,
      dueDate: task.dueDate ?? undefined,
      assignee: task.assignee ?? undefined,
      progress: this.calculateProgress(task.items || []),
    };
  }

  async create(organizationId: string, dto: CreateTaskDto): Promise<TaskResponseDto> {
    // Verify obligation belongs to organization
    const obligation = await this.prisma.obligation.findFirst({
      where: { id: dto.obligationId, organizationId },
    });

    if (!obligation) {
      throw new BadRequestException('Obligación no encontrada o no pertenece a esta organización');
    }

    // Verify assignee belongs to organization if provided
    if (dto.assignedToUserId) {
      const membership = await this.prisma.userOrg.findFirst({
        where: { userId: dto.assignedToUserId, organizationId },
      });
      if (!membership) {
        throw new BadRequestException('El usuario asignado no pertenece a esta organización');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        obligationId: dto.obligationId,
        title: dto.title,
        description: dto.description,
        assignedToUserId: dto.assignedToUserId,
        dueDate: dto.dueDate,
        items: dto.items
          ? {
              create: dto.items.map((item, index) => ({
                description: item.description,
                order: item.order ?? index,
              })),
            }
          : undefined,
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
        items: { orderBy: { order: 'asc' } },
      },
    });

    return this.enrichTask(task);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: {
      obligationId?: string;
      assignedToUserId?: string;
      status?: TaskStatus;
    },
  ): Promise<PaginatedResponse<TaskResponseDto>> {
    const where: any = {
      obligation: { organizationId },
    };

    if (filters?.obligationId) {
      where.obligationId = filters.obligationId;
    }
    if (filters?.assignedToUserId) {
      where.assignedToUserId = filters.assignedToUserId;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: pagination.sortOrder },
        include: {
          assignee: { select: { id: true, fullName: true, email: true } },
          obligation: { select: { id: true, title: true } },
          items: { orderBy: { order: 'asc' } },
        },
      }),
      this.prisma.task.count({ where }),
    ]);

    const enrichedTasks = tasks.map((t) => this.enrichTask(t));

    return createPaginatedResponse(enrichedTasks, total, pagination.page!, pagination.limit!);
  }

  async findOne(organizationId: string, taskId: string): Promise<TaskResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
        items: { orderBy: { order: 'asc' } },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    return this.enrichTask(task);
  }

  async update(organizationId: string, taskId: string, dto: UpdateTaskDto): Promise<TaskResponseDto> {
    const existing = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
    });

    if (!existing) {
      throw new NotFoundException('Tarea no encontrada');
    }

    // Verify assignee if being updated
    if (dto.assignedToUserId) {
      const membership = await this.prisma.userOrg.findFirst({
        where: { userId: dto.assignedToUserId, organizationId },
      });
      if (!membership) {
        throw new BadRequestException('El usuario asignado no pertenece a esta organización');
      }
    }

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: dto,
      include: {
        assignee: { select: { id: true, fullName: true, email: true } },
        obligation: { select: { id: true, title: true } },
        items: { orderBy: { order: 'asc' } },
      },
    });

    return this.enrichTask(task);
  }

  async delete(organizationId: string, taskId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });
  }

  // Task Items
  async addItem(organizationId: string, taskId: string, dto: CreateTaskItemDto): Promise<TaskItemResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
      include: { items: true },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    const maxOrder = task.items.reduce((max, item) => Math.max(max, item.order), -1);

    const item = await this.prisma.taskItem.create({
      data: {
        taskId,
        description: dto.description,
        order: dto.order ?? maxOrder + 1,
      },
    });

    return item;
  }

  async updateItem(
    organizationId: string,
    taskId: string,
    itemId: string,
    dto: UpdateTaskItemDto,
  ): Promise<TaskItemResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    const item = await this.prisma.taskItem.findFirst({
      where: { id: itemId, taskId },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    const updated = await this.prisma.taskItem.update({
      where: { id: itemId },
      data: dto,
    });

    return updated;
  }

  async deleteItem(organizationId: string, taskId: string, itemId: string): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    const item = await this.prisma.taskItem.findFirst({
      where: { id: itemId, taskId },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    await this.prisma.taskItem.delete({
      where: { id: itemId },
    });
  }

  async toggleItem(organizationId: string, taskId: string, itemId: string): Promise<TaskItemResponseDto> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        obligation: { organizationId },
      },
    });

    if (!task) {
      throw new NotFoundException('Tarea no encontrada');
    }

    const item = await this.prisma.taskItem.findFirst({
      where: { id: itemId, taskId },
    });

    if (!item) {
      throw new NotFoundException('Ítem no encontrado');
    }

    const updated = await this.prisma.taskItem.update({
      where: { id: itemId },
      data: { done: !item.done },
    });

    return updated;
  }
}
