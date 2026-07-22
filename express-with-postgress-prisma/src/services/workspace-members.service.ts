import { prisma } from "../config/db.ts";
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../utils/app-errors.ts";
import {
  findOrCreateInvitedUser,
  deriveDisplayNameFromEmail,
} from "../utils/user-provisioning.ts";
import type {
  WorkspaceMembersPostInput,
  WorkspaceMembersPatchInput,
} from "../schemas/workspace-members.schema.ts";
import { Prisma } from "../../generated/prisma/client.ts";

const MEMBER_USER_FIELDS = {
  id: true,
  fullName: true,
  username: true,
  email: true,
};

export const getRequesterRoleService = async (
  workspaceId: string,
  userId: string,
): Promise<"admin" | "member"> => {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (!membership) {
    throw new NotFoundError("Workspace not found");
  }

  return membership.role;
};

const assertIsAdmin = (role: "admin" | "member") => {
  if (role !== "admin") {
    throw new ForbiddenError("Only workspace admins can manage members");
  }
};

export const postWorkspaceMembersService = async (
  requesterRole: "admin" | "member",
  workspaceId: string,
  memberData: WorkspaceMembersPostInput,
) => {
  assertIsAdmin(requesterRole);

  const { email, role } = memberData;

  const { user, isNewUser, tempPassword } = await findOrCreateInvitedUser(
    email,
    deriveDisplayNameFromEmail(email),
  );

  try {
    const member = await prisma.workspaceMember.create({
      data: { workspaceId, userId: user.id, role },
      include: { user: { select: MEMBER_USER_FIELDS } },
    });

    return {
      id: member.id,
      workspaceId: member.workspaceId,
      role: member.role,
      user: member.user,
      ...(isNewUser ? { tempPassword } : {}),
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("User is already a member of this workspace");
    }
    throw error;
  }
};

export const getWorkspaceMembersService = async (workspaceId: string) => {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: MEMBER_USER_FIELDS } },
    orderBy: { joinedAt: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    workspaceId: m.workspaceId,
    role: m.role,
    user: m.user,
  }));
};

export const patchWorkspaceMembersByIdService = async (
  requesterId: string,
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
  updates: WorkspaceMembersPatchInput,
) => {
  assertIsAdmin(requesterRole);

  if (targetUserId === requesterId) {
    throw new ForbiddenError("You cannot change your own role");
  }

  const { count } = await prisma.workspaceMember.updateMany({
    where: { workspaceId, userId: targetUserId },
    data: { role: updates.role },
  });

  if (count === 0) {
    throw new NotFoundError("Member not found");
  }

  const member = await prisma.workspaceMember.findUniqueOrThrow({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    include: { user: { select: MEMBER_USER_FIELDS } },
  });

  return {
    id: member.id,
    workspaceId: member.workspaceId,
    role: member.role,
    user: member.user,
  };
};

export const deleteWorkspaceMembersByIdService = async (
  requesterId: string,
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
) => {
  assertIsAdmin(requesterRole);

  if (targetUserId === requesterId) {
    throw new ForbiddenError("You cannot remove yourself from the workspace");
  }

  const { count } = await prisma.workspaceMember.deleteMany({
    where: { workspaceId, userId: targetUserId },
  });

  if (count === 0) {
    throw new NotFoundError("Member not found");
  }
};
