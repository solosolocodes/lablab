import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Wallet, { IAsset } from '@/models/Wallet';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Add an asset to a wallet
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { walletId, asset } = await request.json();

    if (!walletId || !asset || !asset.type || !asset.name || !asset.symbol || asset.amount === undefined) {
      return NextResponse.json(
        { message: 'Wallet ID and asset details are required' },
        { status: 400 }
      );
    }

    // Validate asset type
    if (!['share', 'cryptocurrency', 'fiat'].includes(asset.type)) {
      return NextResponse.json(
        { message: 'Asset type must be one of: share, cryptocurrency, fiat' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Add initialAmount if not provided
    if (asset.initialAmount === undefined) {
      asset.initialAmount = asset.amount;
    }
    
    // Add the asset to the wallet
    wallet.assets.push(asset);
    
    // Save changes
    await wallet.save();
    
    // Populate owner for the response
    await wallet.populate('owner', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'Asset added successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        description: wallet.description,
        owner: {
          id: wallet.owner._id,
          name: wallet.owner.name,
          email: wallet.owner.email,
          role: wallet.owner.role,
        },
        assets: wallet.assets,
        scenarioId: wallet.scenarioId,
        createdAt: wallet.createdAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error adding asset to wallet:', error);
    return NextResponse.json(
      { message: 'Error adding asset to wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update an asset in a wallet
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { walletId, assetId, asset } = await request.json();

    if (!walletId || !assetId || !asset) {
      return NextResponse.json(
        { message: 'Wallet ID, asset ID, and updated asset details are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Find the index of the asset to update
    const assetIndex = wallet.assets.findIndex((a: IAsset) => a._id && a._id.toString() === assetId);
    if (assetIndex === -1) {
      return NextResponse.json(
        { message: 'Asset not found in wallet' },
        { status: 404 }
      );
    }
    
    // Update the asset properties
    if (asset.type) wallet.assets[assetIndex].type = asset.type;
    if (asset.name) wallet.assets[assetIndex].name = asset.name;
    if (asset.symbol) wallet.assets[assetIndex].symbol = asset.symbol;
    if (asset.amount !== undefined) wallet.assets[assetIndex].amount = asset.amount;
    if (asset.initialAmount !== undefined) wallet.assets[assetIndex].initialAmount = asset.initialAmount;
    
    // Save changes
    await wallet.save();
    
    // Populate owner for the response
    await wallet.populate('owner', '_id name email role');
    
    // Return successful response
    return NextResponse.json({
      message: 'Asset updated successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        description: wallet.description,
        owner: {
          id: wallet.owner._id,
          name: wallet.owner.name,
          email: wallet.owner.email,
          role: wallet.owner.role,
        },
        assets: wallet.assets,
        scenarioId: wallet.scenarioId,
        createdAt: wallet.createdAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating asset in wallet:', error);
    return NextResponse.json(
      { message: 'Error updating asset in wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete an asset from a wallet
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const walletId = searchParams.get('walletId');
    const assetId = searchParams.get('assetId');

    if (!walletId || !assetId) {
      return NextResponse.json(
        { message: 'Wallet ID and asset ID are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Find the index of the asset to remove
    const assetIndex = wallet.assets.findIndex((a: IAsset) => a._id && a._id.toString() === assetId);
    if (assetIndex === -1) {
      return NextResponse.json(
        { message: 'Asset not found in wallet' },
        { status: 404 }
      );
    }
    
    // Remove the asset
    wallet.assets.splice(assetIndex, 1);
    
    // Save changes
    await wallet.save();
    
    return NextResponse.json({
      message: 'Asset removed successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error removing asset from wallet:', error);
    return NextResponse.json(
      { message: 'Error removing asset from wallet', error: errorMessage },
      { status: 500 }
    );
  }
}