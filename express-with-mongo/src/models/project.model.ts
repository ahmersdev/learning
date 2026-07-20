import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IProject extends Document {
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
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

export const Project: Model<IProject> = mongoose.model<IProject>(
  "Project",
  projectSchema,
);
