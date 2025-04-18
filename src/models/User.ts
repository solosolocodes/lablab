import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends mongoose.Document {
  name: string;
  email: string;
  password?: string; // Optional password - only admins will have passwords
  role: 'participant' | 'admin';
  createdAt: Date;
  updatedAt: Date;
  comparePassword?(candidatePassword: string): Promise<boolean>; // Optional password comparison method
}

const UserSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
    },
    password: {
      type: String,
      required: function() {
        // Only require password for admin users
        return this.role === 'admin';
      },
      minlength: [6, 'Password should be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['participant', 'admin'],
      default: 'participant',
      required: true,
    },
  },
  { timestamps: true }
);

// Hash password before saving (only for admin users)
UserSchema.pre('save', async function (next) {
  // Skip if password is not modified or if it's not present (for participants)
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: unknown) {
    next(error instanceof Error ? error : new Error('Unknown error during password hashing'));
  }
});

// Method to compare passwords (only used for admin users)
UserSchema.methods.comparePassword = async function (candidatePassword: string) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if model exists before creating a new one (for Next.js hot reloading)
const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;