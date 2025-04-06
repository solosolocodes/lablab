import mongoose from 'mongoose';

export interface IAsset {
  _id?: mongoose.Types.ObjectId;
  type: string;
  name: string;
  symbol: string;
  amount: number;
  initialAmount: number;
  toString?: () => string;
}

const AssetSchema = new mongoose.Schema<IAsset>({
  type: {
    type: String,
    required: [true, 'Asset type is required'],
  },
  name: {
    type: String,
    required: [true, 'Asset name is required'],
    trim: true,
  },
  symbol: {
    type: String,
    required: [true, 'Asset symbol is required'],
    trim: true,
  },
  amount: {
    type: Number,
    required: [true, 'Asset amount is required'],
    default: 0,
  },
  initialAmount: {
    type: Number,
    required: [true, 'Initial amount is required'],
    default: 0,
  },
});

export interface IWallet extends mongoose.Document {
  name: string;
  description: string;
  assets: IAsset[];
  scenarioId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new mongoose.Schema<IWallet>(
  {
    name: {
      type: String,
      required: [true, 'Please provide a wallet name'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
      trim: true,
    },
    assets: [AssetSchema],
    scenarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Scenario',
      required: false,
    },
  },
  { timestamps: true }
);

// Check if model exists before creating a new one (for Next.js hot reloading)
const Wallet = mongoose.models.Wallet || mongoose.model<IWallet>('Wallet', WalletSchema);

export default Wallet;