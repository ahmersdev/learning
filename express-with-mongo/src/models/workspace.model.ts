import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IWorkspace extends Document {
  ownerId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // most queries will be "find all workspaces for this owner"
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
  },
  { timestamps: true },
);

export const Workspace: Model<IWorkspace> = mongoose.model<IWorkspace>(
  "Workspace",
  workspaceSchema,
);
