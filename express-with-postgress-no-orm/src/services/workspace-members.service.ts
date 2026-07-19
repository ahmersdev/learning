import crypto from "crypto";
import type {
  WorkspaceMembersPostInput,
  WorkspaceMembersPatchInput,
} from "../schemas/workspace-members.schema.ts";
import { ForbiddenError } from "../utils/app-errors.ts";

// TODO: once DB is wired up:
// - getRequesterRoleService should look up the requesting user's actual role
//   in this workspace (throw AppError 404 if they aren't a member at all)
// - all other functions should perform real membership queries/writes,
//   scoped to workspaceId

export const getRequesterRoleService = async (
  workspaceId: string,
  userId: string,
): Promise<"admin" | "member"> => {
  // TODO: look up real role; for now stub every requester as admin
  // so the rest of the flow can be exercised/tested
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

  const { email, role } = memberData;

  // TODO: check if a user with this email exists and isn't already a member
  // -> throw new AppError("User is already a member", 409)

  return {
    id: crypto.randomUUID(),
    workspaceId,
    email,
    role,
  };
};

export const getWorkspaceMembersService = async (workspaceId: string) => {
  // TODO: return all members where workspaceId matches
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

  // TODO: find member by workspaceId + targetUserId -> if not found,
  // throw new AppError("Member not found", 404)

  return {
    id: targetUserId,
    workspaceId,
    email: "stub-member@example.com",
    role: updates.role ?? "member",
  };
};

export const deleteWorkspaceMembersByIdService = async (
  requesterRole: "admin" | "member",
  workspaceId: string,
  targetUserId: string,
) => {
  assertIsAdmin(requesterRole);

  // TODO: find member by workspaceId + targetUserId -> if not found,
  // throw new AppError("Member not found", 404)
  // delete from DB

  return;
};
