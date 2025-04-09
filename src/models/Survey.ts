import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
  id: string;
  text: string;
  type: 'text' | 'multipleChoice' | 'checkboxes' | 'scale' | 'rating';
  required: boolean;
  options?: string[];
  minValue?: number; // For scale questions (1-10)
  maxValue?: number; // For scale questions
  maxRating?: number; // For rating questions (1-5 stars)
  order: number;
}

export interface ISurvey extends Document {
  title: string;
  description: string;
  questions: IQuestion[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'published' | 'archived';
  responsesCount: number;
}

const QuestionSchema = new Schema({
  id: { 
    type: String, 
    required: true 
  },
  text: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['text', 'multipleChoice', 'checkboxes', 'scale', 'rating'],
    required: true 
  },
  required: { 
    type: Boolean, 
    default: false 
  },
  // Options for multiple choice/checkboxes
  options: { 
    type: [String] 
  },
  // Fields for scale questions
  minValue: {
    type: Number,
    default: 1
  },
  maxValue: {
    type: Number,
    default: 10
  },
  // Field for rating questions
  maxRating: {
    type: Number,
    default: 5
  },
  // Order for display
  order: { 
    type: Number, 
    default: 0 
  }
});

const SurveySchema: Schema = new Schema({
  title: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  questions: [QuestionSchema],
  createdBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User',
    required: true
  },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  responsesCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.models.Survey || 
  mongoose.model<ISurvey>('Survey', SurveySchema);