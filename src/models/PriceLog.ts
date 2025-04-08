import mongoose from 'mongoose';

export interface IPriceLog extends mongoose.Document {
  experimentId: mongoose.Types.ObjectId;
  assetId: string;
  symbol: string;
  roundNumber: number;
  price: number;
  previousPrice: number | null;
  percentChange: number | null;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PriceLogSchema = new mongoose.Schema<IPriceLog>(
  {
    experimentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment ID is required'],
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
    roundNumber: {
      type: Number,
      required: [true, 'Round number is required'],
      min: [1, 'Round number must be at least 1'],
      index: true
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative']
    },
    previousPrice: {
      type: Number,
      default: null
    },
    percentChange: {
      type: Number,
      default: null
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
      { experimentId: 1, roundNumber: 1 },
      { experimentId: 1, assetId: 1, roundNumber: 1 },
      { experimentId: 1, timestamp: -1 }
    ]
  }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const PriceLog = mongoose.models.PriceLog || mongoose.model<IPriceLog>('PriceLog', PriceLogSchema);

export default PriceLog;