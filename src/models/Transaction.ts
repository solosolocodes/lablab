import mongoose from 'mongoose';

export interface ITransaction extends mongoose.Document {
  experimentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  assetId: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;
  roundNumber: number;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new mongoose.Schema<ITransaction>(
  {
    experimentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment ID is required'],
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    assetId: {
      type: String,
      required: [true, 'Asset ID is required']
    },
    symbol: {
      type: String,
      required: [true, 'Asset symbol is required'],
      index: true
    },
    type: {
      type: String,
      enum: ['buy', 'sell'],
      required: [true, 'Transaction type is required'],
      index: true
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0.000001, 'Quantity must be greater than 0']
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    totalValue: {
      type: Number,
      required: [true, 'Total value is required']
    },
    roundNumber: {
      type: Number,
      required: [true, 'Round number is required'],
      min: [1, 'Round number must be at least 1'],
      index: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { 
    timestamps: true,
    // Add indices for common queries
    indexes: [
      { experimentId: 1, userId: 1, timestamp: -1 },
      { experimentId: 1, roundNumber: 1 },
      { userId: 1, type: 1 }
    ]
  }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const Transaction = mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);

export default Transaction;