import mongoose from 'mongoose';
import { 
  InstructionsStageSchema, 
  ScenarioStageSchema, 
  SurveyStageSchema, 
  BreakStageSchema 
} from './experiment-components/ExperimentStage';
import { BranchSchema } from './experiment-components/ExperimentBranch';

export interface IUserGroupAssignment {
  userGroupId: mongoose.Types.ObjectId;
  condition: string; // e.g., "control", "experimental-a", "experimental-b"
  maxParticipants?: number;
}

export interface IExperiment extends mongoose.Document {
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  createdBy: mongoose.Types.ObjectId;
  userGroups: IUserGroupAssignment[];
  stages: mongoose.Types.DocumentArray<any>; // Will contain different stage types
  branches: {
    fromStageId: mongoose.Types.ObjectId;
    conditions: {
      type: string;
      sourceStageId?: mongoose.Types.ObjectId;
      targetStageId: mongoose.Types.ObjectId;
      questionId?: string;
      expectedResponse?: string;
      operator?: string;
      threshold?: number;
      probability?: number;
    }[];
    defaultTargetStageId: mongoose.Types.ObjectId;
  }[];
  startStageId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastEditedAt: Date;
}

const UserGroupAssignmentSchema = new mongoose.Schema({
  userGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserGroup',
    required: [true, 'User group ID is required'],
  },
  condition: {
    type: String,
    required: [true, 'Condition is required'],
    trim: true,
  },
  maxParticipants: {
    type: Number,
    min: [1, 'Maximum participants must be at least 1'],
  },
}, { _id: false });

// Create a discriminator key for the different stage types
const StageSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Stage type is required'],
    enum: ['instructions', 'scenario', 'survey', 'break'],
  },
}, { discriminatorKey: 'type' });

const ExperimentSchema = new mongoose.Schema<IExperiment>({
  name: {
    type: String,
    required: [true, 'Please provide an experiment name'],
    trim: true,
    maxlength: [100, 'Name cannot be more than 100 characters'],
  },
  description: {
    type: String,
    required: [true, 'Please provide a description'],
    trim: true,
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['draft', 'active', 'paused', 'completed', 'archived'],
    default: 'draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Creator is required'],
  },
  userGroups: {
    type: [UserGroupAssignmentSchema],
    default: [],
  },
  stages: {
    type: [StageSchema],
    default: [],
  },
  branches: {
    type: [BranchSchema],
    default: [],
  },
  startStageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stage',
  },
  lastEditedAt: {
    type: Date,
    default: Date.now,
  }
}, { timestamps: true });

// Set up discriminators for different stage types
ExperimentSchema.path('stages').discriminator('instructions', InstructionsStageSchema);
ExperimentSchema.path('stages').discriminator('scenario', ScenarioStageSchema);
ExperimentSchema.path('stages').discriminator('survey', SurveyStageSchema);
ExperimentSchema.path('stages').discriminator('break', BreakStageSchema);

// Check if model exists before creating a new one (for Next.js hot reloading)
const Experiment = mongoose.models.Experiment || mongoose.model<IExperiment>('Experiment', ExperimentSchema);

export default Experiment;