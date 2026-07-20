import mongoose, { Schema, type Document, type Model } from "mongoose";

const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export interface IUser extends Document {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      minlength: 3,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: userRoles,
      default: "admin",
      // No `select: false` here — role needs to be readable normally,
      // unlike password. It's just not writable via any Zod schema.
    },
  },
  { timestamps: true },
);

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
