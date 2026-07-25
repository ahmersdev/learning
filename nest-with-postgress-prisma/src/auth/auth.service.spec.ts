import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Prisma } from '../generated/prisma/client';
import type { User, Session } from '../generated/prisma/client';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    session: {
      create: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
      deleteMany: jest.Mock;
    };
  };

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
    lastLogin: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUpdatedUser: User = { ...mockUser, lastLogin: new Date() };

  const mockSession: Session = {
    id: 'session-123',
    tokenId: 'token-abc',
    userId: mockUser.id,
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      session: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
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

    const setupHappyPath = () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUpdatedUser);
      prisma.session.create.mockResolvedValue(mockSession);
    };

    it('throws ConflictException when email or username is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('converts a P2002 unique-constraint error into ConflictException', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`email`)',
          { code: 'P2002', clientVersion: '7.9.0' },
        ),
      );

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('re-throws non-P2002 errors from create without converting them', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      prisma.user.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.register(dto)).rejects.toThrow('connection lost');
    });

    it('sets lastLogin and creates a session on success', async () => {
      setupHappyPath();

      await service.register(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) },
      });
      expect(prisma.session.create).toHaveBeenCalledWith({
        data: {
          tokenId: expect.any(String),
          userId: mockUser.id,
          expiresAt: expect.any(Date),
        },
      });
    });

    it('returns the created user without the password field', async () => {
      setupHappyPath();

      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('password');
      expect(result.user.email).toBe(mockUser.email);
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });

    it('signs the access token with user details and the refresh token with only tokenId', async () => {
      setupHappyPath();

      await service.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          userId: mockUpdatedUser.id,
          email: mockUpdatedUser.email,
          username: mockUpdatedUser.username,
          fullName: mockUpdatedUser.fullName,
        },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          userId: mockUpdatedUser.id,
          email: mockUpdatedUser.email,
          tokenId: expect.any(String),
        },
        { secret: 'refresh-secret', expiresIn: '7d' },
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

    it('updates lastLogin, creates a session, and returns tokens on success', async () => {
      prisma.user.findFirst.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      prisma.user.update.mockResolvedValue(mockUpdatedUser);
      prisma.session.create.mockResolvedValue(mockSession);

      const result = await service.login(dto);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { lastLogin: expect.any(Date) },
      });
      expect(prisma.session.create).toHaveBeenCalled();
      expect(result.user).not.toHaveProperty('password');
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

    it('throws UnauthorizedException when the token signature is invalid', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.refresh('bad.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the session no longer exists (revoked)', async () => {
      jwtService.verify.mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokenId: 'deleted-token-id',
      });
      prisma.session.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid.jwt.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the session has expired', async () => {
      jwtService.verify.mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokenId: mockSession.tokenId,
      });
      prisma.session.findUnique.mockResolvedValue({
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh('valid.jwt.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      jwtService.verify.mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokenId: mockSession.tokenId,
      });
      prisma.session.findUnique.mockResolvedValue(mockSession);
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('valid.jwt.token')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.session.delete).not.toHaveBeenCalled();
    });

    it('rotates the session and signs a new access token with current user details', async () => {
      jwtService.verify.mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokenId: mockSession.tokenId,
      });
      prisma.session.findUnique.mockResolvedValue(mockSession);
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.session.delete.mockResolvedValue(mockSession);
      prisma.session.create.mockResolvedValue({
        ...mockSession,
        id: 'session-456',
        tokenId: 'new-token-id',
      });

      const result = await service.refresh('valid.jwt.token');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
      expect(prisma.session.delete).toHaveBeenCalledWith({
        where: { id: mockSession.id },
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          userId: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          fullName: mockUser.fullName,
        },
        { secret: 'access-secret', expiresIn: '15m' },
      );
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });
  });

  describe('signout', () => {
    it('does nothing when no token is provided', async () => {
      await service.signout(undefined);

      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });

    it('deletes the session matching the tokenId from a valid token', async () => {
      jwtService.verify.mockReturnValue({
        userId: mockUser.id,
        email: mockUser.email,
        tokenId: mockSession.tokenId,
      });

      await service.signout('valid.jwt.token');

      expect(prisma.session.deleteMany).toHaveBeenCalledWith({
        where: { tokenId: mockSession.tokenId },
      });
    });

    it('does not throw when the token is invalid or expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(service.signout('bad.token')).resolves.toBeUndefined();
      expect(prisma.session.deleteMany).not.toHaveBeenCalled();
    });
  });
});
