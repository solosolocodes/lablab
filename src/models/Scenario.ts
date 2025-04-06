import mongoose from 'mongoose';

// Structure for storing price data for each asset in each round
export interface AssetPrice {
  assetId: mongoose.Types.ObjectId;
  symbol: string;
  prices: number[]; // Array of prices for each round
}

export interface IScenario extends mongoose.Document {
  name: string;
  description: string;
  walletId: mongoose.Types.ObjectId;
  rounds: number;
  roundDuration: number; // in seconds
  assetPrices: AssetPrice[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AssetPriceSchema = new mongoose.Schema({
  assetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  prices: [Number] // Array of prices for each round
});

const ScenarioSchema = new mongoose.Schema<IScenario>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a scenario name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: [true, 'Scenario must be associated with a wallet'],
    },
    rounds: {
      type: Number,
      required: [true, 'Number of rounds is required'],
      min: [1, 'Must have at least 1 round'],
      max: [50, 'Cannot have more than 50 rounds']
    },
    roundDuration: {
      type: Number,
      required: [true, 'Round duration is required'],
      min: [5, 'Round duration must be at least 5 seconds'],
      max: [300, 'Round duration cannot exceed 5 minutes (300 seconds)']
    },
    assetPrices: [AssetPriceSchema],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const Scenario = mongoose.models.Scenario || mongoose.model<IScenario>('Scenario', ScenarioSchema);

export default Scenario;