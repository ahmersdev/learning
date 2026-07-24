import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthService', () => {
  let service: AuthService;
  let jwtService: jest.Mocked<JwtService>;

  const mockConfig: Record<string, string> = {
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mocked.jwt.token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfig[key]),
          },
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

    it('returns user data with access and refresh tokens', async () => {
      const result = await service.register(dto);

      expect(result.user).toEqual({
        fullName: dto.fullName,
        username: dto.username,
        email: dto.email,
      });
      expect(result.accessToken).toBe('mocked.jwt.token');
      expect(result.refreshToken).toBe('mocked.jwt.token');
    });

    it('signs the access token with JWT_ACCESS_SECRET and JWT_ACCESS_EXPIRY', async () => {
      await service.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email }),
        { secret: 'access-secret', expiresIn: '15m' },
      );
    });

    it('signs the refresh token with JWT_REFRESH_SECRET and JWT_REFRESH_EXPIRY', async () => {
      await service.register(dto);

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email }),
        { secret: 'refresh-secret', expiresIn: '7d' },
      );
    });

    it('does not return the raw password in the response', async () => {
      const result = await service.register(dto);

      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('login', () => {
    it('resolves email from dto.email when provided', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'Password1!',
      };

      const result = await service.login(dto);

      expect(result.user.email).toBe('john@example.com');
    });

    it('falls back to stub email when only username is provided', async () => {
      const dto: LoginDto = {
        username: 'johndoe',
        password: 'Password1!',
      };

      const result = await service.login(dto);

      expect(result.user.email).toBe('stub@example.com');
    });

    it('returns access and refresh tokens', async () => {
      const dto: LoginDto = {
        email: 'john@example.com',
        password: 'Password1!',
      };

      const result = await service.login(dto);

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
