import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { User } from '../generated/prisma/client';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; update: jest.Mock } };

  const mockUser: User = {
    id: 'user-123',
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    password: 'hashed-password',
    role: 'user',
    mustChangePassword: false,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUser', () => {
    it('returns the user without the password field', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUser(mockUser.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(mockUser.email);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUser('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('throws BadRequestException when no updatable field is provided', async () => {
      await expect(service.updateUser(mockUser.id, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('updates the user and returns it without the password field', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };
      prisma.user.update.mockResolvedValue({
        ...mockUser,
        fullName: 'Jane Doe',
      });

      const result = await service.updateUser(mockUser.id, dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: dto,
      });
      expect(result).not.toHaveProperty('password');
      expect(result.fullName).toBe('Jane Doe');
    });

    it('throws NotFoundException when the user record no longer exists (P2025)', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Record to update not found.',
          {
            code: 'P2025',
            clientVersion: '7.9.0',
          },
        ),
      );

      await expect(service.updateUser(mockUser.id, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the new username is already taken (P2002)', async () => {
      const dto: UpdateUserDto = { username: 'taken' };
      prisma.user.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`username`)',
          { code: 'P2002', clientVersion: '7.9.0' },
        ),
      );

      await expect(service.updateUser(mockUser.id, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('re-throws unrecognized errors without converting them', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };
      prisma.user.update.mockRejectedValue(new Error('connection lost'));

      await expect(service.updateUser(mockUser.id, dto)).rejects.toThrow(
        'connection lost',
      );
    });
  });
});
