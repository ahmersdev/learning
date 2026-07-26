import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import type { Comment } from '../generated/prisma/client';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: {
    task: { findUnique: jest.Mock };
    workspaceMember: { findUnique: jest.Mock };
    comment: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  const workspaceId = 'workspace-123';
  const taskId = 'task-456';
  const userId = 'user-789';
  const authorId = 'user-789';

  const mockTaskWithProject = {
    id: taskId,
    projectId: 'project-1',
    project: {
      id: 'project-1',
      workspaceId,
      name: 'Website',
      description: null,
    },
  };

  const mockMembership = {
    id: 'membership-1',
    workspaceId,
    userId,
    role: 'member' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockComment: Comment = {
    id: 'comment-1',
    taskId,
    authorId,
    content: 'Looks good, ready to ship.',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      task: { findUnique: jest.fn() },
      workspaceMember: { findUnique: jest.fn() },
      comment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assertCanAccessTask', () => {
    it('resolves without throwing when the task exists and the user is a workspace member', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTaskWithProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(mockMembership);

      await expect(
        service.assertCanAccessTask(taskId, userId),
      ).resolves.toBeUndefined();
      expect(prisma.task.findUnique).toHaveBeenCalledWith({
        where: { id: taskId },
        include: { project: true },
      });
    });

    it('throws NotFoundException when the task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(service.assertCanAccessTask(taskId, userId)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.workspaceMember.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the user is not a member of the workspace', async () => {
      prisma.task.findUnique.mockResolvedValue(mockTaskWithProject);
      prisma.workspaceMember.findUnique.mockResolvedValue(null);

      await expect(service.assertCanAccessTask(taskId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('assertIsCommentAuthor', () => {
    it('resolves without throwing when the requester is the author', async () => {
      prisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(
        service.assertIsCommentAuthor(mockComment.id, authorId),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the comment does not exist', async () => {
      prisma.comment.findUnique.mockResolvedValue(null);

      await expect(
        service.assertIsCommentAuthor('missing', userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when the requester is not the author', async () => {
      prisma.comment.findUnique.mockResolvedValue(mockComment);

      await expect(
        service.assertIsCommentAuthor(mockComment.id, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when the author has been deleted (authorId is null)', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        authorId: null,
      });

      await expect(
        service.assertIsCommentAuthor(mockComment.id, authorId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates a comment with the given taskId, authorId, and content', async () => {
      const dto: CreateCommentDto = { content: 'Looks good, ready to ship.' };
      prisma.comment.create.mockResolvedValue(mockComment);

      const result = await service.create(taskId, authorId, dto);

      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: { taskId, authorId, content: dto.content },
      });
      expect(result).toEqual(mockComment);
    });
  });

  describe('findAll', () => {
    it('returns comments scoped to the given taskId, ordered oldest first', async () => {
      prisma.comment.findMany.mockResolvedValue([mockComment]);

      const result = await service.findAll(taskId);

      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual([mockComment]);
    });
  });

  describe('update', () => {
    const dto: UpdateCommentDto = { content: 'Edited comment' };

    it('throws NotFoundException when the comment does not exist in this task', async () => {
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(service.update(taskId, mockComment.id, dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.comment.update).not.toHaveBeenCalled();
    });

    it('updates the content when the comment exists in this task', async () => {
      prisma.comment.findFirst.mockResolvedValue(mockComment);
      prisma.comment.update.mockResolvedValue({
        ...mockComment,
        content: 'Edited comment',
      });

      const result = await service.update(taskId, mockComment.id, dto);

      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: mockComment.id },
        data: { content: dto.content },
      });
      expect(result.content).toBe('Edited comment');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the comment does not exist in this task', async () => {
      prisma.comment.findFirst.mockResolvedValue(null);

      await expect(service.remove(taskId, mockComment.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.comment.delete).not.toHaveBeenCalled();
    });

    it('deletes the comment when it exists in this task', async () => {
      prisma.comment.findFirst.mockResolvedValue(mockComment);
      prisma.comment.delete.mockResolvedValue(mockComment);

      await service.remove(taskId, mockComment.id);

      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: mockComment.id },
      });
    });
  });
});
