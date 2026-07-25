import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceMembersController } from './workspace-members.controller';
import { WorkspaceMembersService } from './workspace-members.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../common/guards/jwt-auth.guard';
import { CreateWorkspaceMemberDto } from './dto/create-workspace-member.dto';
import { UpdateWorkspaceMemberDto } from './dto/update-workspace-member.dto';

describe('WorkspaceMembersController', () => {
  let controller: WorkspaceMembersController;
  let service: jest.Mocked<WorkspaceMembersService>;

  const mockUser: AuthenticatedUser = {
    id: 'user-123',
    email: 'john@example.com',
  };
  const workspaceId = 'workspace-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspaceMembersController],
      providers: [
        {
          provide: WorkspaceMembersService,
          useValue: {
            getRequesterRole: jest.fn(),
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

    controller = module.get<WorkspaceMembersController>(
      WorkspaceMembersController,
    );
    service = module.get(WorkspaceMembersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('resolves the requester role, then creates the member', async () => {
      const dto: CreateWorkspaceMemberDto = {
        email: 'member@example.com',
        role: 'member',
      };
      const member = {
        id: 'm-1',
        workspaceId,
        email: dto.email,
        role: dto.role,
      };

      service.getRequesterRole.mockResolvedValue('admin');
      service.create.mockResolvedValue(member);

      const result = await controller.create(workspaceId, mockUser, dto);

      expect(service.getRequesterRole).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.create).toHaveBeenCalledWith('admin', workspaceId, dto);
      expect(result).toEqual({
        status: 'success',
        message: 'Member added successfully',
        data: { member },
      });
    });
  });

  describe('findAll', () => {
    it('resolves the requester role, then lists members', async () => {
      const members = [
        {
          id: 'm-1',
          workspaceId,
          email: 'a@example.com',
          role: 'member' as const,
        },
      ];

      service.getRequesterRole.mockResolvedValue('member');
      service.findAll.mockResolvedValue(members);

      const result = await controller.findAll(workspaceId, mockUser);

      expect(service.getRequesterRole).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.findAll).toHaveBeenCalledWith(workspaceId);
      expect(result).toEqual({ status: 'success', data: { members } });
    });
  });

  describe('update', () => {
    it('resolves the requester role, then updates the member', async () => {
      const dto: UpdateWorkspaceMemberDto = { role: 'admin' };
      const member = {
        id: 'user-456',
        workspaceId,
        email: 'a@example.com',
        role: 'admin' as const,
      };

      service.getRequesterRole.mockResolvedValue('admin');
      service.update.mockResolvedValue(member);

      const result = await controller.update(
        workspaceId,
        'user-456',
        mockUser,
        dto,
      );

      expect(service.getRequesterRole).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.update).toHaveBeenCalledWith(
        'admin',
        workspaceId,
        'user-456',
        dto,
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Member updated successfully',
        data: { member },
      });
    });
  });

  describe('remove', () => {
    it('resolves the requester role, then removes the member', async () => {
      service.getRequesterRole.mockResolvedValue('admin');
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(workspaceId, 'user-456', mockUser);

      expect(service.getRequesterRole).toHaveBeenCalledWith(
        workspaceId,
        mockUser.id,
      );
      expect(service.remove).toHaveBeenCalledWith(
        'admin',
        workspaceId,
        'user-456',
      );
      expect(result).toEqual({
        status: 'success',
        message: 'Member removed successfully',
      });
    });
  });
});
