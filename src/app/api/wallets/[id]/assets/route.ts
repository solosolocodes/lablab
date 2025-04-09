import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { withDatabaseConnection } from '@/lib/dbConnect';
import Wallet from '@/models/Wallet';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to generate fallback assets
function generateFallbackAssets(walletId: string) {
  return [
    {
      id: `${walletId}-asset1`,
      type: 'cryptocurrency',
      name: 'Bitcoin',
      symbol: 'BTC',
      amount: 0.5,
      initialAmount: 0.5
    },
    {
      id: `${walletId}-asset2`,
      type: 'stock',
      name: 'Apple Inc.',
      symbol: 'AAPL',
      amount: 10,
      initialAmount: 10
    },
    {
      id: `${walletId}-asset3`,
      type: 'cryptocurrency',
      name: 'Ethereum',
      symbol: 'ETH',
      amount: 5,
      initialAmount: 5
    }
  ];
}

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
    
    // Validate wallet ID
    const walletId = params.id;
    if (!walletId || !mongoose.Types.ObjectId.isValid(walletId)) {
      return NextResponse.json(
        { message: 'Invalid wallet ID' },
        { status: 400 }
      );
    }
    
    // Use the withDatabaseConnection helper for more robust DB access with fallback
    return await withDatabaseConnection(
      async () => {
        // Find the wallet
        const wallet = await Wallet.findById(walletId);
        if (!wallet) {
          // If wallet not found, but we're in preview mode, return fallback data
          if (isPreviewMode) {
            console.log(`Wallet ${walletId} not found, but in preview mode. Using fallback assets.`);
            return NextResponse.json(generateFallbackAssets(walletId));
          }
          
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
      },
      // Fallback value if database operation fails
      NextResponse.json(
        isPreviewMode ? generateFallbackAssets(walletId) : { error: 'Database unavailable' }, 
        { status: isPreviewMode ? 200 : 503 }
      ),
      'fetch wallet assets'
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching wallet assets:', error);
    
    // For preview mode, return fallback data instead of error
    if (request.nextUrl.searchParams.get('preview') === 'true') {
      console.log('Preview mode enabled - returning fallback assets instead of error');
      return NextResponse.json(generateFallbackAssets(params.id));
    }
    
    return NextResponse.json(
      { message: 'Error fetching wallet assets', error: errorMessage },
      { status: 500 }
    );
  }
}