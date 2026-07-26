import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
    role: 'admin',
  };

  const mockSafeUser = {
    id: mockUser.id,
    fullName: 'John Doe',
    username: 'johndoe',
    email: mockUser.email,
    role: 'admin' as const,
    mustChangePassword: false,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            getUser: jest.fn(),
            updateUser: jest.fn(),
            findAllUsers: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAllUsers', () => {
    it('returns the full user list wrapped in the standard response shape', async () => {
      usersService.findAllUsers.mockResolvedValue([mockSafeUser]);

      const result = await controller.getAllUsers();

      expect(usersService.findAllUsers).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'success',
        data: { users: [mockSafeUser] },
      });
    });
  });

  describe('getUser', () => {
    it('returns the current user profile wrapped in the standard response shape', async () => {
      usersService.getUser.mockResolvedValue(mockSafeUser);

      const result = await controller.getUser(mockUser);

      expect(usersService.getUser).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual({
        status: 'success',
        data: { user: mockSafeUser },
      });
    });
  });

  describe('patchUser', () => {
    it('calls updateUser with the current user id and dto, and returns the standard response shape', async () => {
      const dto: UpdateUserDto = { fullName: 'Jane Doe' };
      const updated = { ...mockSafeUser, fullName: 'Jane Doe' };
      usersService.updateUser.mockResolvedValue(updated);

      const result = await controller.patchUser(mockUser, dto);

      expect(usersService.updateUser).toHaveBeenCalledWith(mockUser.id, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Profile updated successfully',
        data: { user: updated },
      });
    });
  });
});
