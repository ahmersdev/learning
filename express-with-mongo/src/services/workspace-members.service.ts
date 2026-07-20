import bcrypt from "bcrypt";
import type {
  WorkspaceMembersPostInput,
  WorkspaceMembersPatchInput,
} from "../schemas/workspace-members.schema.ts";
import {
  AppError,
  ConflictError,
  ForbiddenError,
} from "../utils/app-errors.ts";
import { User } from "../models/user.model.ts";
import { WorkspaceMember } from "../models/workspace-member.model.ts";
import {
  generateUsernameFromEmail,
  generateTempPassword,
} from "../utils/user-provisioning.ts";

const SALT_ROUNDS = 10;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code: unknown }).code === 11000;

// A user requesting info about a workspace they're not a member of gets
// the same 404 as a workspace that doesn't exist at all — this keeps
// getRequesterRoleService as the single gate every members-route passes
// through, so that leak-avoidance guarantee holds everywhere it's called
export const getRequesterRoleService = async (
  workspaceId: string,
  userId: string,
): Promise<"admin" | "member"> => {
  const membership = await WorkspaceMember.findOne({ workspaceId, userId });

  if (!membership) {
    throw new AppError("Workspace not found", 404);
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

  const { email, role, fullName } = memberData;

  let user = await User.findOne({ email });
  let temporaryPassword: string | undefined;

  if (!user) {
    const username = await generateUsernameFromEmail(email);
    temporaryPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);

    user = await User.create({
      fullName: fullName ?? email.split("@")[0],
      username,
      email,
      password: hashedPassword,
      role: "user",
      mustChangePassword: true,
    });

    console.log(
      `[workspace-members] Temporary password for new member ${email}: ${temporaryPassword}`,
    );
  } else {
    const existingMembership = await WorkspaceMember.findOne({
      workspaceId,
      userId: user.id,
    });

    if (existingMembership) {
      throw new ConflictError("User is already a member of this workspace");
    }
  }

  let membership;
  try {
    membership = await WorkspaceMember.create({
      workspaceId,
      userId: user.id,
      role,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ConflictError("User is already a member of this workspace");
    }
    throw error;
  }

  return {
    member: {
      id: membership.id,
      workspaceId,
      userId: user.id,
      username: user.username,
      email: user.email,
      role: membership.role,
    },
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };
};

export const getWorkspaceMembersService = async (workspaceId: string) => {
  const memberships = await WorkspaceMember.find({ workspaceId }).populate<{
    userId: {
      _id: string;
      username: string;
      email: string;
      mustChangePassword: boolean;
    };
  }>("userId", "username email mustChangePassword");

  return memberships.map((membership) => ({
    id: membership.id,
    workspaceId,
    userId: membership.userId._id.toString(),
    username: membership.userId.username,
    email: membership.userId.email,
    role: membership.role,
    mustChangePassword: membership.userId.mustChangePassword,
  }));
};

export const patchWorkspaceMembersByIdService = async (
  requesterRole: "admin" | "member",
  requesterId: string,
  workspaceId: string,
  targetUserId: string,
  updates: WorkspaceMembersPatchInput,
) => {
  assertIsAdmin(requesterRole);

  if (requesterId === targetUserId) {
    throw new ForbiddenError("You cannot change your own membership role");
  }

  const membership = await WorkspaceMember.findOneAndUpdate(
    { workspaceId, userId: targetUserId },
    { $set: updates },
    { new: true, runValidators: true },
  ).populate<{ userId: { username: string; email: string } }>(
    "userId",
    "username email",
  );

  if (!membership) {
    throw new AppError("Member not found", 404);
  }

  return {
    id: membership.id,
    workspaceId,
    userId: targetUserId,
    username: membership.userId.username,
    email: membership.userId.email,
    role: membership.role,
  };
};

export const deleteWorkspaceMembersByIdService = async (
  requesterRole: "admin" | "member",
  requesterId: string,
  workspaceId: string,
  targetUserId: string,
) => {
  assertIsAdmin(requesterRole);

  if (requesterId === targetUserId) {
    throw new ForbiddenError("You cannot remove yourself from the workspace");
  }

  const membership = await WorkspaceMember.findOneAndDelete({
    workspaceId,
    userId: targetUserId,
  });

  if (!membership) {
    throw new AppError("Member not found", 404);
  }

  return;
};

export const resetMemberPasswordService = async (
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
) => {
  assertIsAdmin(requesterRole);

  const membership = await WorkspaceMember.findOne({
    workspaceId,
    userId: targetUserId,
  });

  if (!membership) {
    throw new AppError("Member not found", 404);
  }

  const user = await User.findById(targetUserId);

  if (!user) {
    throw new AppError("Member not found", 404);
  }

  if (!user.mustChangePassword) {
    throw new ForbiddenError(
      "This member has already set their own password and cannot be reset this way",
    );
  }

  const temporaryPassword = generateTempPassword();
  user.password = await bcrypt.hash(temporaryPassword, SALT_ROUNDS);
  await user.save();

  console.log(
    `[workspace-members] Reset temporary password for ${user.email}: ${temporaryPassword}`,
  );

  return { temporaryPassword };
};
