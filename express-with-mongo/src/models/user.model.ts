import mongoose, { Schema, type Document, type Model } from "mongoose";

const userRoles = ["admin", "user"] as const;
export type UserRole = (typeof userRoles)[number];

export interface IUser extends Document {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
  mustChangePassword: boolean;
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
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export const User: Model<IUser> = mongoose.model<IUser>("User", userSchema);
