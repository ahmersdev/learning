import bcrypt from "bcrypt";
import crypto from "crypto";
import type {
  WorkspaceMembersPostInput,
  WorkspaceMembersPatchInput,
} from "../schemas/workspace-members.schema.ts";
import { ForbiddenError } from "../utils/app-errors.ts";
import { User } from "../models/user.model.ts";
import {
  generateUsernameFromEmail,
  generateTempPassword,
} from "../utils/user-provisioning.ts";

const SALT_ROUNDS = 10;

// TODO: once a WorkspaceMember model exists, getRequesterRoleService should
// look up the requesting user's actual role in this workspace (throw
// AppError 404 if they aren't a member at all)
export const getRequesterRoleService = async (
  workspaceId: string,
  userId: string,
): Promise<"admin" | "member"> => {
  return "admin";
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
      role: "user", // global platform role — distinct from the workspace-scoped role below
      mustChangePassword: true,
    });

    // Fallback delivery channel since no email service is wired up yet
    console.log(
      `[workspace-members] Temporary password for new member ${email}: ${temporaryPassword}`,
    );
  }

  // TODO: once a WorkspaceMember model exists, check if this user is
  // already a member of this workspace -> throw ConflictError instead of
  // silently allowing duplicate membership

  return {
    member: {
      id: crypto.randomUUID(), // TODO: replace with the real WorkspaceMember _id once that model exists
      workspaceId,
      userId: user.id,
      email: user.email,
      username: user.username,
      role,
    },
    ...(temporaryPassword ? { temporaryPassword } : {}),
  };
};

export const getWorkspaceMembersService = async (workspaceId: string) => {
  return [
    {
      id: crypto.randomUUID(),
      workspaceId,
      email: "stub-member@example.com",
      role: "member" as const,
    },
  ];
};

export const patchWorkspaceMembersByIdService = async (
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
  updates: WorkspaceMembersPatchInput,
) => {
  assertIsAdmin(requesterRole);

  return {
    id: targetUserId,
    workspaceId,
    email: "stub-member@example.com",
    role: updates.role,
  };
};

export const deleteWorkspaceMembersByIdService = async (
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
) => {
  assertIsAdmin(requesterRole);
  return;
};
