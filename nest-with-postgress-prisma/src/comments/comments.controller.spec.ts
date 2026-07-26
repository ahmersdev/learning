import { Test, TestingModule } from '@nestjs/testing';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentsController', () => {
  let controller: CommentsController;
  let service: jest.Mocked<CommentsService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
    role: 'admin',
  };
  const taskId = 'task-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        {
          provide: CommentsService,
          useValue: {
            assertCanAccessTask: jest.fn(),
            assertIsCommentAuthor: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<CommentsController>(CommentsController);
    service = module.get(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('checks task access, then creates the comment', async () => {
      const dto: CreateCommentDto = { content: 'Looks good, ready to ship.' };
      const comment = {
        id: 'c-1',
        taskId,
        content: dto.content,
        createdAt: new Date(),
        updatedAt: new Date(),
        author: { id: mockUser.id, fullName: 'John Doe', username: 'johndoe' },
      };

      service.assertCanAccessTask.mockResolvedValue(undefined);
      service.create.mockResolvedValue(comment);

      const result = await controller.create(taskId, mockUser, dto);

      expect(service.assertCanAccessTask).toHaveBeenCalledWith(
        taskId,
        mockUser.id,
      );
      expect(service.create).toHaveBeenCalledWith(taskId, mockUser.id, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Comment added successfully',
        data: { comment },
      });
    });
  });

  describe('findAll', () => {
    it('checks task access, then lists comments', async () => {
      const comments = [
        {
          id: 'c-1',
          taskId,
          content: 'Stub comment',
          createdAt: new Date(),
          updatedAt: new Date(),
          author: {
            id: mockUser.id,
            fullName: 'John Doe',
            username: 'johndoe',
          },
        },
      ];

      service.assertCanAccessTask.mockResolvedValue(undefined);
      service.findAll.mockResolvedValue(comments);

      const result = await controller.findAll(taskId, mockUser);

      expect(service.assertCanAccessTask).toHaveBeenCalledWith(
        taskId,
        mockUser.id,
      );
      expect(service.findAll).toHaveBeenCalledWith(taskId);
      expect(result).toEqual({ status: 'success', data: { comments } });
    });
  });

  describe('update', () => {
    it('checks task access and comment authorship, then updates the comment', async () => {
      const dto: UpdateCommentDto = { content: 'Edited comment' };
      const comment = {
        id: 'c-1',
        taskId,
        authorId: mockUser.id,
        content: 'Edited comment',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.assertCanAccessTask.mockResolvedValue(undefined);
      service.assertIsCommentAuthor.mockResolvedValue(undefined);
      service.update.mockResolvedValue(comment);

      const result = await controller.update(taskId, 'c-1', mockUser, dto);

      expect(service.assertCanAccessTask).toHaveBeenCalledWith(
        taskId,
        mockUser.id,
      );
      expect(service.assertIsCommentAuthor).toHaveBeenCalledWith(
        'c-1',
        mockUser.id,
      );
      expect(service.update).toHaveBeenCalledWith(taskId, 'c-1', dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Comment updated successfully',
        data: { comment },
      });
    });
  });

  describe('remove', () => {
    it('checks task access and comment authorship, then removes the comment', async () => {
      service.assertCanAccessTask.mockResolvedValue(undefined);
      service.assertIsCommentAuthor.mockResolvedValue(undefined);
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(taskId, 'c-1', mockUser);

      expect(service.assertCanAccessTask).toHaveBeenCalledWith(
        taskId,
        mockUser.id,
      );
      expect(service.assertIsCommentAuthor).toHaveBeenCalledWith(
        'c-1',
        mockUser.id,
      );
      expect(service.remove).toHaveBeenCalledWith(taskId, 'c-1');
      expect(result).toEqual({
        status: 'success',
        message: 'Comment deleted successfully',
      });
    });
  });
});
