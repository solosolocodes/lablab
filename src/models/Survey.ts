import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
  id: string;
  text: string;
  type: 'text' | 'multipleChoice' | 'checkboxes' | 'scale' | 'rating';
  required: boolean;
  options?: string[];
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
  options: { 
    type: [String] 
  },
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