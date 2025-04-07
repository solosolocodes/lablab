import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Wallet from '@/models/Wallet';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get a single wallet by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if in preview mode
    const isPreviewMode = request.nextUrl.searchParams.get('preview') === 'true';
    
    // Only check authentication if not in preview mode
    if (!isPreviewMode) {
      const session = await getServerSession(authOptions);
      
      // Check if user is authenticated and is admin
      if (!session || session.user.role !== 'admin') {
        return NextResponse.json(
          { message: 'Unauthorized' },
          { status: 401 }
        );
      }
    }
    
    await connectDB();
    
    // Validate wallet ID
    const walletId = params.id;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return NextResponse.json(
        { message: 'Invalid wallet ID' },
        { status: 400 }
      );
    }
    
    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Format the response
    const formattedWallet = {
      id: wallet._id,
      name: wallet.name,
      description: wallet.description,
      assets: wallet.assets.map(asset => ({
        id: asset._id.toString(),
        type: asset.type,
        name: asset.name,
        symbol: asset.symbol,
        amount: asset.amount,
        initialAmount: asset.initialAmount,
      })),
      scenarioId: wallet.scenarioId,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
    
    return NextResponse.json(formattedWallet);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { message: 'Error fetching wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update a single wallet by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const walletId = params.id;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return NextResponse.json(
        { message: 'Invalid wallet ID' },
        { status: 400 }
      );
    }
    
    const { name, description, assets, scenarioId } = await request.json();
    
    if (!name || !description) {
      return NextResponse.json(
        { message: 'Name and description are required' },
        { status: 400 }
      );
    }
    
    // Find the wallet
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    wallet.name = name;
    wallet.description = description;
    if (assets) wallet.assets = assets;
    wallet.scenarioId = scenarioId ? new mongoose.Types.ObjectId(scenarioId) : undefined;
    
    // Save changes
    await wallet.save();
    
    // Return successful response
    return NextResponse.json({
      message: 'Wallet updated successfully',
      wallet: {
        id: wallet._id,
        name: wallet.name,
        description: wallet.description,
        assets: wallet.assets,
        scenarioId: wallet.scenarioId,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating wallet:', error);
    return NextResponse.json(
      { message: 'Error updating wallet', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a wallet by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    await connectDB();
    
    const walletId = params.id;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return NextResponse.json(
        { message: 'Invalid wallet ID' },
        { status: 400 }
      );
    }
    
    // Find and delete the wallet
    const result = await Wallet.findByIdAndDelete(walletId);
    
    if (!result) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Wallet deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting wallet:', error);
    return NextResponse.json(
      { message: 'Error deleting wallet', error: errorMessage },
      { status: 500 }
    );
  }
}