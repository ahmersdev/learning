import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

describe('CommentsService', () => {
  let service: CommentsService;
  const taskId = 'task-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CommentsService],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('assertCanAccessTask', () => {
    it('resolves without throwing (stub behavior)', async () => {
      await expect(
        service.assertCanAccessTask(taskId, 'user-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('assertIsCommentAuthor', () => {
    it('resolves without throwing (stub behavior)', async () => {
      await expect(
        service.assertIsCommentAuthor('comment-456', 'user-123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('creates a comment with the given taskId, authorId, and content', async () => {
      const dto: CreateCommentDto = { content: 'Looks good, ready to ship.' };

      const result = await service.create(taskId, 'user-123', dto);

      expect(result).toEqual({
        id: expect.any(String),
        taskId,
        authorId: 'user-123',
        content: dto.content,
        createdAt: expect.any(String),
      });
    });
  });

  describe('findAll', () => {
    it('returns an array of comments for the given taskId', async () => {
      const result = await service.findAll(taskId);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toEqual(
        expect.objectContaining({ taskId, content: expect.any(String) }),
      );
    });
  });

  describe('update', () => {
    it('updates the comment content', async () => {
      const dto: UpdateCommentDto = { content: 'Updated comment text' };

      const result = await service.update(taskId, 'comment-456', dto);

      expect(result).toEqual(
        expect.objectContaining({
          id: 'comment-456',
          taskId,
          content: 'Updated comment text',
        }),
      );
    });
  });

  describe('remove', () => {
    it('resolves without throwing', async () => {
      await expect(
        service.remove(taskId, 'comment-456'),
      ).resolves.toBeUndefined();
    });
  });
});
