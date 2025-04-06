import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Scenario from '@/models/Scenario';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to get scenario ID from URL
function getScenarioId(request: NextRequest): string {
  const pathParts = request.nextUrl.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

// Get a specific scenario by ID
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
    
    const scenarioId = getScenarioId(request);
    
    // Find the scenario
    const scenario = await Scenario.findById(scenarioId);
    
    if (!scenario) {
      return NextResponse.json(
        { message: 'Scenario not found' },
        { status: 404 }
      );
    }
    
    // Format response
    const formattedScenario = {
      id: scenario._id,
      name: scenario.name,
      description: scenario.description,
      walletId: scenario.walletId,
      rounds: scenario.rounds,
      roundDuration: scenario.roundDuration,
      assetPrices: scenario.assetPrices,
      isActive: scenario.isActive,
      createdAt: scenario.createdAt,
    };
    
    return NextResponse.json(formattedScenario);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching scenario:', error);
    return NextResponse.json(
      { message: 'Error fetching scenario', error: errorMessage },
      { status: 500 }
    );
  }
}