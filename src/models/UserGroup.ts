import mongoose from 'mongoose';
import { IUser } from './User';

export interface IUserGroup extends mongoose.Document {
  name: string;
  description: string;
  users: mongoose.Types.ObjectId[] | IUser[];
  experimentsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserGroupSchema = new mongoose.Schema<IUserGroup>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a group name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    experimentsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const UserGroup = mongoose.models.UserGroup || mongoose.model<IUserGroup>('UserGroup', UserGroupSchema);

export default UserGroup;