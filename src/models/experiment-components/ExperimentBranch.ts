import mongoose from 'mongoose';

// Defines branching logic for experiment flows
export interface IBranchCondition {
  type: 'response' | 'completion' | 'time' | 'random' | 'always';
  sourceStageId?: mongoose.Types.ObjectId; // The stage that provides data for the condition
  targetStageId: mongoose.Types.ObjectId;  // The stage to go to if condition is met
  
  // Different condition parameters based on type
  questionId?: string;         // For 'response' type
  expectedResponse?: string;   // For 'response' type
  operator?: 'equals' | 'contains' | 'greaterThan' | 'lessThan'; // For numeric responses
  threshold?: number;          // For 'completion' or numeric comparisons
  probability?: number;        // For 'random' type (0-100)
}

export interface IBranch {
  _id?: mongoose.Types.ObjectId;
  fromStageId: mongoose.Types.ObjectId;
  conditions: IBranchCondition[];
  defaultTargetStageId: mongoose.Types.ObjectId; // If no conditions are met
}

const BranchConditionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: [true, 'Condition type is required'],
    enum: ['response', 'completion', 'time', 'random', 'always'],
  },
  sourceStageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stage',
  },
  targetStageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stage',
    required: [true, 'Target stage ID is required'],
  },
  questionId: String,
  expectedResponse: String,
  operator: {
    type: String,
    enum: ['equals', 'contains', 'greaterThan', 'lessThan'],
  },
  threshold: Number,
  probability: {
    type: Number,
    min: 0,
    max: 100,
  },
}, { _id: false });

export const BranchSchema = new mongoose.Schema({
  fromStageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stage',
    required: [true, 'From stage ID is required'],
  },
  conditions: {
    type: [BranchConditionSchema],
    default: [],
  },
  defaultTargetStageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stage',
    required: [true, 'Default target stage ID is required'],
  },
});