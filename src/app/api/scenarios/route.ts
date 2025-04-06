import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Scenario from '@/models/Scenario';
import Wallet, { IAsset } from '@/models/Wallet';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all scenarios with optional filtering
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
    const walletId = searchParams.get('walletId');
    const isActive = searchParams.get('isActive');
    
    // Create filter based on query parameters
    const filter: { walletId?: string; isActive?: boolean } = {};
    if (walletId) filter.walletId = walletId;
    if (isActive !== null) filter.isActive = isActive === 'true';
    
    // Find scenarios
    const scenarios = await Scenario.find(filter)
      .sort({ createdAt: -1 });
    
    // Format the response
    const formattedScenarios = scenarios.map(scenario => ({
      id: scenario._id,
      name: scenario.name,
      description: scenario.description,
      walletId: scenario.walletId,
      rounds: scenario.rounds,
      roundDuration: scenario.roundDuration,
      assetPrices: scenario.assetPrices,
      isActive: scenario.isActive,
      createdAt: scenario.createdAt,
    }));
    
    return NextResponse.json(formattedScenarios);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching scenarios:', error);
    return NextResponse.json(
      { message: 'Error fetching scenarios', error: errorMessage },
      { status: 500 }
    );
  }
}

// Create a new scenario
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
    
    const { name, description, walletId, rounds, roundDuration } = await request.json();

    if (!name || !description || !walletId || !rounds || !roundDuration) {
      return NextResponse.json(
        { message: 'All fields are required: name, description, walletId, rounds, roundDuration' },
        { status: 400 }
      );
    }

    // Validate rounds and roundDuration
    if (rounds < 1 || rounds > 50) {
      return NextResponse.json(
        { message: 'Number of rounds must be between 1 and 50' },
        { status: 400 }
      );
    }

    if (roundDuration < 5 || roundDuration > 300) {
      return NextResponse.json(
        { message: 'Round duration must be between 5 and 300 seconds' },
        { status: 400 }
      );
    }

    await connectDB();

    // Check if the wallet exists
    const wallet = await Wallet.findById(walletId);
    if (!wallet) {
      return NextResponse.json(
        { message: 'Wallet not found' },
        { status: 404 }
      );
    }

    // Generate initial price data for all assets in the wallet
    const assetPrices = wallet.assets.map((asset: IAsset) => {
      // For each asset, generate a price for each round
      // Initial prices are based on current amount with random fluctuation
      const prices: number[] = [];
      
      // Initialize prices array
      for (let i = 0; i < rounds; i++) {
        // Generate a price that fluctuates around the initial amount
        // For the first round, use the current amount
        if (i === 0) {
          prices.push(asset.amount);
        } else {
          // For subsequent rounds, fluctuate by -20% to +20%
          const fluctuation = 0.8 + (Math.random() * 0.4); // 0.8 to 1.2
          const previousPrice = prices[i-1];
          prices.push(previousPrice * fluctuation);
        }
      }

      return {
        assetId: asset._id,
        symbol: asset.symbol,
        prices
      };
    });
    
    // Create scenario
    const scenario = await Scenario.create({
      name,
      description,
      walletId: new mongoose.Types.ObjectId(walletId),
      rounds,
      roundDuration,
      assetPrices,
      isActive: true
    });
    
    // Return successful response
    return NextResponse.json({
      message: 'Scenario created successfully',
      scenario: {
        id: scenario._id,
        name: scenario.name,
        description: scenario.description,
        walletId: scenario.walletId,
        rounds: scenario.rounds,
        roundDuration: scenario.roundDuration,
        assetPrices: scenario.assetPrices,
        isActive: scenario.isActive,
        createdAt: scenario.createdAt,
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating scenario:', error);
    return NextResponse.json(
      { message: 'Error creating scenario', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update a scenario
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
    
    const { id, name, description, walletId, rounds, roundDuration, assetPrices, isActive } = await request.json();

    if (!id || !name || !description) {
      return NextResponse.json(
        { message: 'ID, name, and description are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if scenario exists
    const scenario = await Scenario.findById(id);
    if (!scenario) {
      return NextResponse.json(
        { message: 'Scenario not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    scenario.name = name;
    scenario.description = description;
    
    // Only update optional fields if provided
    if (walletId) scenario.walletId = new mongoose.Types.ObjectId(walletId);
    if (rounds) scenario.rounds = rounds;
    if (roundDuration) scenario.roundDuration = roundDuration;
    if (assetPrices) scenario.assetPrices = assetPrices;
    if (isActive !== undefined) scenario.isActive = isActive;
    
    // Save changes
    await scenario.save();
    
    // Return successful response
    return NextResponse.json({
      message: 'Scenario updated successfully',
      scenario: {
        id: scenario._id,
        name: scenario.name,
        description: scenario.description,
        walletId: scenario.walletId,
        rounds: scenario.rounds,
        roundDuration: scenario.roundDuration,
        assetPrices: scenario.assetPrices,
        isActive: scenario.isActive,
        createdAt: scenario.createdAt,
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating scenario:', error);
    return NextResponse.json(
      { message: 'Error updating scenario', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a scenario
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Scenario ID is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find and delete the scenario
    const result = await Scenario.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json(
        { message: 'Scenario not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Scenario deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting scenario:', error);
    return NextResponse.json(
      { message: 'Error deleting scenario', error: errorMessage },
      { status: 500 }
    );
  }
}