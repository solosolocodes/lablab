import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Scenario from '@/models/Scenario';
import Wallet from '@/models/Wallet';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get prices for a specific scenario
export async function GET(request: NextRequest) {
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId');
    
    if (!scenarioId) {
      return NextResponse.json(
        { message: 'Scenario ID is required' },
        { status: 400 }
      );
    }
    
    // Find the scenario
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { message: 'Scenario not found' },
        { status: 404 }
      );
    }
    
    // Get the wallet to get asset information
    const wallet = await Wallet.findById(scenario.walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Associated wallet not found' },
        { status: 404 }
      );
    }
    
    // Format price data for the UI
    // Create a structure with assets as columns and rounds as rows
    const assets = wallet.assets.map(asset => ({
      id: asset._id,
      name: asset.name,
      symbol: asset.symbol,
      type: asset.type
    }));
    
    // Get price data for each asset
    const priceData = scenario.assetPrices.map(assetPrice => {
      const asset = wallet.assets.find(a => a._id.toString() === assetPrice.assetId.toString());
      return {
        assetId: assetPrice.assetId,
        symbol: assetPrice.symbol,
        name: asset ? asset.name : 'Unknown Asset',
        prices: assetPrice.prices
      };
    });
    
    // Format response
    const response = {
      id: scenario._id,
      name: scenario.name,
      description: scenario.description,
      rounds: scenario.rounds,
      roundDuration: scenario.roundDuration,
      assets,
      priceData
    };
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching scenario prices:', error);
    return NextResponse.json(
      { message: 'Error fetching scenario prices', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update prices for a specific scenario
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
    
    const { scenarioId, assetPrices } = await request.json();

    if (!scenarioId || !assetPrices) {
      return NextResponse.json(
        { message: 'Scenario ID and asset prices are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the scenario
    const scenario = await Scenario.findById(scenarioId);
    if (!scenario) {
      return NextResponse.json(
        { message: 'Scenario not found' },
        { status: 404 }
      );
    }
    
    // Update the asset prices
    scenario.assetPrices = assetPrices;
    await scenario.save();
    
    return NextResponse.json({
      message: 'Asset prices updated successfully',
      scenario: {
        id: scenario._id,
        name: scenario.name,
        assetPrices: scenario.assetPrices
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating scenario prices:', error);
    return NextResponse.json(
      { message: 'Error updating scenario prices', error: errorMessage },
      { status: 500 }
    );
  }
}