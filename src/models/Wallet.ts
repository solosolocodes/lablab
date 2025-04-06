import mongoose from 'mongoose';
import { IUser } from './User';

export interface IAsset extends mongoose.Document {
  _id?: mongoose.Types.ObjectId;
  type: 'share' | 'cryptocurrency' | 'fiat';
  name: string;
  symbol: string;
  amount: number;
  initialAmount: number;
}

const AssetSchema = new mongoose.Schema<IAsset>({
  type: {
    type: String,
    enum: ['share', 'cryptocurrency', 'fiat'],
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
  owner: mongoose.Types.ObjectId | IUser;
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
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Wallet must have an owner'],
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