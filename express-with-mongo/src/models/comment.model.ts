import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IComment extends Document {
  taskId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    taskId: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true },
);

export const Comment: Model<IComment> = mongoose.model<IComment>(
  "Comment",
  commentSchema,
);
