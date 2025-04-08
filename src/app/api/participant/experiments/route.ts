import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectDB from '@/lib/dbConnect';
import mongoose from 'mongoose';

// GET /api/participant/experiments
// Fetches all experiments available to the current participant
export async function GET(request: NextRequest) {
  try {
    // Step 1: Authentication
    const session = await getServerSession();
    
    // Check for authentication
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[DEBUG] Processing request for user: ${session.user.email}`);
    
    // Step 2: Check role
    if (session.user.role !== 'participant') {
      return NextResponse.json(
        { message: 'Unauthorized. Only participants can access this endpoint' }, 
        { status: 403 }
      );
    }
    
    // Step 3: SPECIAL CASE - Generate fallback data directly
    // Skip all database operations for now due to connectivity issues
    console.log('[DEBUG] USING DIRECT FALLBACK DATA - SKIPPING ALL DATABASE OPERATIONS');
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const filterStatus = status === 'all' ? undefined : status;
    
    // Generate timestamps
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // Create fallback experiments - always create the same ones
    // for consistent experience during database downtime
    let allExperiments = [
      {
        id: '100000000000000000000001',
        name: 'Understanding Economic Decision Making',
        description: 'A study on how people make economic decisions in different scenarios',
        status: 'active',
        progress: {
          status: 'not_started'
        },
        createdAt: lastWeek.toISOString()
      },
      {
        id: '100000000000000000000002',
        name: 'Behavioral Economics Survey',
        description: 'A survey about behavioral economics concepts and personal choices',
        status: 'active',
        progress: {
          status: 'in_progress',
          startedAt: yesterday.toISOString(),
          lastActivityAt: now.toISOString()
        },
        createdAt: lastWeek.toISOString()
      },
      {
        id: '100000000000000000000003',
        name: 'Game Theory Experiment',
        description: 'An experiment testing game theory principles in practical scenarios',
        status: 'active',
        progress: {
          status: 'completed',
          startedAt: lastWeek.toISOString(),
          completedAt: yesterday.toISOString(),
          lastActivityAt: yesterday.toISOString()
        },
        createdAt: lastWeek.toISOString()
      }
    ];
    
    // Filter experiments if needed
    if (filterStatus) {
      allExperiments = allExperiments.filter(exp => exp.progress.status === filterStatus);
    }
    
    console.log(`[DEBUG] Returning ${allExperiments.length} fallback experiments`);
    return NextResponse.json(allExperiments);
  } catch (error) {
    console.error('Error in experiments API:', error);
    
    // Return a general error message
    return NextResponse.json(
      { 
        message: 'Failed to fetch experiments', 
        error: 'An unexpected error occurred',
      }, 
      { status: 500 }
    );
  }
}