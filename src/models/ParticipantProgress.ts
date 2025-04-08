import mongoose from 'mongoose';

export interface IParticipantProgress extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  experimentId: mongoose.Types.ObjectId;
  status: 'not_started' | 'in_progress' | 'completed';
  currentStageId?: mongoose.Types.ObjectId;
  completedStages: mongoose.Types.ObjectId[];
  startedAt?: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantProgressSchema = new mongoose.Schema<IParticipantProgress>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    experimentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment ID is required'],
      index: true
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
      required: true,
      index: true
    },
    currentStageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment.stages',
    },
    completedStages: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment.stages',
    }],
    startedAt: {
      type: Date
    },
    completedAt: {
      type: Date
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  { 
    timestamps: true,
    indexes: [
      { userId: 1, experimentId: 1 }, // Compound index for quick lookups of a user's progress on a specific experiment
      { experimentId: 1, status: 1 }, // Index for querying experiment completion statistics
      { userId: 1, status: 1 } // Index for querying a user's experiment status
    ]
  }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const ParticipantProgress = mongoose.models.ParticipantProgress || 
  mongoose.model<IParticipantProgress>('ParticipantProgress', ParticipantProgressSchema);

export default ParticipantProgress;