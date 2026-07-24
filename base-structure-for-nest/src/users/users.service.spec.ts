import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getUser', () => {
    it('returns a user profile for the given userId', async () => {
      const result = await service.getUser('user-123');

      expect(result).toEqual({
        id: 'user-123',
        fullName: 'Stub User',
        username: 'stubuser',
        email: 'stub@example.com',
      });
    });
  });

  describe('updateUser', () => {
    it('throws BadRequestException when neither fullName nor username is provided', async () => {
      const dto: UpdateUserDto = {};

      await expect(service.updateUser('user-123', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates fullName when only fullName is provided', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };

      const result = await service.updateUser('user-123', dto);

      expect(result).toEqual({
        id: 'user-123',
        fullName: 'Jane Doe',
        username: 'stubuser',
      });
    });

    it('updates username when only username is provided', async () => {
      const dto: UpdateUserDto = { username: 'janedoe' };

      const result = await service.updateUser('user-123', dto);

      expect(result).toEqual({
        id: 'user-123',
        fullName: 'Stub User',
        username: 'janedoe',
      });
    });

    it('updates both fields when both are provided', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe', username: 'janedoe' };

      const result = await service.updateUser('user-123', dto);

      expect(result).toEqual({
        id: 'user-123',
        fullName: 'Jane Doe',
        username: 'janedoe',
      });
    });
  });
});
