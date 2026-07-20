import mongoose, { Schema, type Document, type Model } from "mongoose";

const taskStatuses = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "done",
] as const;
const taskPriorities = ["low", "medium", "high", "urgent"] as const;

export type TaskStatus = (typeof taskStatuses)[number];
export type TaskPriority = (typeof taskPriorities)[number];

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: taskStatuses,
      default: "backlog",
    },
    priority: {
      type: String,
      enum: taskPriorities,
      default: "medium",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export const Task: Model<ITask> = mongoose.model<ITask>("Task", taskSchema);
