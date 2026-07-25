import { Test, TestingModule } from '@nestjs/testing';
import type { Response, Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockResponse = () => {
    const res = {} as Response;
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);
    return res;
  };

  const mockSafeUser = {
    id: 'user-123',
    fullName: 'John Doe',
    username: 'johndoe',
    email: 'john@example.com',
    role: 'user' as const,
    mustChangePassword: false,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            refresh: jest.fn(),
            signout: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('signup', () => {
    const dto: RegisterDto = {
      fullName: 'John Doe',
      username: 'johndoe',
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('sets the refreshToken cookie and returns user + accessToken', async () => {
      authService.register.mockResolvedValue({
        user: mockSafeUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();

      const result = await controller.signup(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(result).toEqual({
        status: 'success',
        message: 'User registered successfully',
        data: { user: mockSafeUser, accessToken: 'access-token' },
      });
    });
  });

  describe('signin', () => {
    const dto: LoginDto = {
      email: 'john@example.com',
      password: 'Password1!',
    };

    it('sets the refreshToken cookie and returns user + accessToken', async () => {
      authService.login.mockResolvedValue({
        user: mockSafeUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();

      const result = await controller.signin(dto, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Login successful',
        data: { user: mockSafeUser, accessToken: 'access-token' },
      });
    });
  });

  describe('refresh', () => {
    it('reads the refreshToken cookie, rotates it, and returns a new accessToken', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      const req = {
        cookies: { refreshToken: 'old-refresh-token' },
      } as unknown as Request;
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(res.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'new-refresh-token',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({
        status: 'success',
        data: { accessToken: 'new-access-token' },
      });
    });

    it('passes undefined to the service when no cookie is present', async () => {
      authService.refresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith(undefined);
    });
  });

  describe('signout', () => {
    it('revokes the session and clears the refreshToken cookie', async () => {
      const req = {
        cookies: { refreshToken: 'some-refresh-token' },
      } as unknown as Request;
      const res = mockResponse();

      const result = await controller.signout(req, res);

      expect(authService.signout).toHaveBeenCalledWith('some-refresh-token');
      expect(res.clearCookie).toHaveBeenCalledWith(
        'refreshToken',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Logged out successfully',
      });
    });

    it('still clears the cookie when no refreshToken cookie is present', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await controller.signout(req, res);

      expect(authService.signout).toHaveBeenCalledWith(undefined);
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });
});
