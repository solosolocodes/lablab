import mongoose, { Schema, Document } from 'mongoose';

export interface ISurveyResponse extends Document {
  experimentId: string;
  stageId: string;
  userId: string;
  responses: Record<string, any>; // Map of questionId -> answer
  submittedAt: Date;
}

const SurveyResponseSchema: Schema = new Schema({
  experimentId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Experiment',
    required: true
  },
  stageId: { 
    type: String,
    required: true
  },
  userId: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  responses: { 
    type: Map,
    of: Schema.Types.Mixed,
    required: true
  },
  submittedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Create a compound index for quick lookups of unique responses
SurveyResponseSchema.index({ experimentId: 1, stageId: 1, userId: 1 }, { unique: true });

export default mongoose.models.SurveyResponse || 
  mongoose.model<ISurveyResponse>('SurveyResponse', SurveyResponseSchema);