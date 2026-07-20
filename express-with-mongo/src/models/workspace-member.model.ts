import mongoose, { Schema, type Document, type Model } from "mongoose";

const workspaceRoles = ["admin", "member"] as const;
export type WorkspaceRole = (typeof workspaceRoles)[number];

export interface IWorkspaceMember extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: workspaceRoles,
      required: true,
    },
  },
  { timestamps: true },
);

// A user can only have one membership per workspace — this is what
// makes "already a member" a real DB-level guarantee, not just an
// app-level check that could race
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMember: Model<IWorkspaceMember> =
  mongoose.model<IWorkspaceMember>("WorkspaceMember", workspaceMemberSchema);
