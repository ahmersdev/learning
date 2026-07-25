import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma, type User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: { user: { findFirst: jest.Mock; create: jest.Mock } };

  const mockConfig: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  };

  const mockUser: User = {
    id: 'user-123',
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    password: 'hashed-password',
    role: 'user',
    mustChangePassword: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mocked.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => mockConfig[key]) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto: RegisterDto = {
      fullName: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('throws ConflictException when email or username is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before saving', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 10);
      const savedData = prisma.user.create.mock.calls[0][0].data;
      expect(savedData.password).toBe('hashed-password');
    });

    it('returns the created user without the password field', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('signs access and refresh tokens with the created user id', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { userId: mockUser.id, email: mockUser.email },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        { userId: mockUser.id, email: mockUser.email },
        { secret: 'refresh-secret', expiresIn: '7d' },
      );
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });

    it('converts a P2002 unique-constraint error into ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: '7.9.0' },
      );
      prisma.user.create.mockRejectedValue(p2002Error);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('re-throws non-P2002 errors from create without converting them', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const dbDownError = new Error('connection terminated unexpectedly');
      prisma.user.create.mockRejectedValue(dbDownError);

      await expect(service.register(dto)).rejects.toThrow(
        'connection terminated unexpectedly',
      );
      await expect(service.register(dto)).rejects.not.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('throws UnauthorizedException when the user is not found', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the password does not match', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns the user without the password field and both tokens on success', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login(dto);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when no token is provided', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the token is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('returns a new access token when the refresh token is valid', async () => {
      jwtService.verify.mockReturnValue({
        userId: 'user-123',
        email: 'john@example.com',
      });

      const result = await service.refresh('valid.refresh.token');

      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(jwtService.verify).toHaveBeenCalledWith('valid.refresh.token', {
        secret: 'refresh-secret',
      });
    });
  });
});
