import mongoose from 'mongoose';

// Base interface for all stage types
export interface IStageBase {
  type: string;
  title: string;
  description: string;
  durationSeconds: number;
  required: boolean;
  order: number;
}

// Instructions stage
export interface IInstructionsStage extends IStageBase {
  type: 'instructions';
  content: string;
  format: 'text' | 'markdown' | 'html';
}

// Scenario stage
export interface IScenarioStage extends IStageBase {
  type: 'scenario';
  scenarioId: mongoose.Types.ObjectId;
}

// Survey stage
export interface ISurveyStage extends IStageBase {
  type: 'survey';
  questions: {
    id: string;
    text: string;
    type: 'text' | 'multipleChoice' | 'rating' | 'checkboxes';
    options?: string[];
    required: boolean;
  }[];
}

// Break stage
export interface IBreakStage extends IStageBase {
  type: 'break';
  message: string;
}

// Define a type that combines all stage types
export type IStage = IInstructionsStage | IScenarioStage | ISurveyStage | IBreakStage;

// Base schema for all stages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StageBaseSchema: Record<string, any> = {
  type: {
    type: String,
    required: [true, 'Stage type is required'],
    enum: ['instructions', 'scenario', 'survey', 'break'],
  },
  title: {
    type: String,
    required: [true, 'Stage title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Stage description is required'],
    trim: true,
  },
  durationSeconds: {
    type: Number,
    required: [true, 'Duration is required'],
    min: [0, 'Duration cannot be negative'],
  },
  required: {
    type: Boolean,
    default: true,
  },
  order: {
    type: Number,
    required: [true, 'Order is required'],
    min: [0, 'Order must be a non-negative number'],
  },
};

// Instructions stage schema
export const InstructionsStageSchema = new mongoose.Schema({
  ...StageBaseSchema,
  content: {
    type: String,
    required: [true, 'Content is required for instructions'],
  },
  format: {
    type: String,
    enum: ['text', 'markdown', 'html'],
    default: 'markdown',
  },
});

// Scenario stage schema
export const ScenarioStageSchema = new mongoose.Schema({
  ...StageBaseSchema,
  scenarioId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Scenario',
    required: [true, 'Scenario ID is required'],
  },
});

// Survey question schema
const QuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: [true, 'Question ID is required'],
  },
  text: {
    type: String,
    required: [true, 'Question text is required'],
  },
  type: {
    type: String,
    enum: ['text', 'multipleChoice', 'rating', 'checkboxes'],
    required: [true, 'Question type is required'],
  },
  options: {
    type: [String],
    default: [],
  },
  required: {
    type: Boolean,
    default: true,
  },
});

// Survey stage schema
export const SurveyStageSchema = new mongoose.Schema({
  ...StageBaseSchema,
  questions: {
    type: [QuestionSchema],
    required: [true, 'Questions are required for a survey'],
    validate: {
      validator: function(questions: mongoose.Types.DocumentArray<mongoose.Document> | Array<Record<string, unknown>>) {
        return questions.length > 0;
      },
      message: 'Survey must have at least one question',
    },
  },
});

// Break stage schema
export const BreakStageSchema = new mongoose.Schema({
  ...StageBaseSchema,
  message: {
    type: String,
    required: [true, 'Message is required for a break'],
  },
});

// Use discriminator pattern for stage types (will be used in the Experiment model)