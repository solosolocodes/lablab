import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Wallet from '@/models/Wallet';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all assets for a specific wallet by ID
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
    
    // Format asset data with correct id field
    const assets = wallet.assets.map(asset => ({
      id: asset._id.toString(),
      type: asset.type,
      name: asset.name,
      symbol: asset.symbol,
      amount: asset.amount,
      initialAmount: asset.initialAmount,
    }));
    
    // Return the assets
    return NextResponse.json(assets);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching wallet assets:', error);
    return NextResponse.json(
      { message: 'Error fetching wallet assets', error: errorMessage },
      { status: 500 }
    );
  }
}