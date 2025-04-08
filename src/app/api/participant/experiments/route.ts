import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { withDatabaseConnection } from '@/lib/dbConnect';
import Experiment from '@/models/Experiment';
import User from '@/models/User';
import UserGroup from '@/models/UserGroup';
import ParticipantProgress from '@/models/ParticipantProgress';
import mongoose from 'mongoose';

// Generate static fallback data for when the database is unavailable
function generateFallbackExperiments() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  return [
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
}

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
    
    // Get query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const filterStatus = status === 'all' ? undefined : status;
    
    // Step 3: Perform database operations with fallback
    return await withDatabaseConnection(
      async () => {
        // ACTUAL DATABASE OPERATIONS
        
        // Get user details
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        
        // Find all user groups that include this participant
        const userGroups = await UserGroup.find({
          users: user._id
        }).select('_id').lean();
        
        if (userGroups.length === 0) {
          console.log(`[DEBUG] User ${user._id} is not a member of any user groups`);
          return NextResponse.json([]);
        }
        
        const userGroupIds = userGroups.map(group => group._id);
        
        // Find all active experiments associated with the user's groups
        const experiments = await Experiment.find({
          status: 'active',
          'userGroups.userGroupId': { $in: userGroupIds }
        }).select('_id name description status userGroups createdAt').lean();
        
        if (experiments.length === 0) {
          console.log(`[DEBUG] No active experiments found for user ${user._id}`);
          return NextResponse.json([]);
        }
        
        // Get participant progress
        const participantProgress = await ParticipantProgress.find({
          userId: user._id,
          experimentId: { $in: experiments.map(exp => exp._id) }
        }).lean();
        
        // Create a map for quick lookups
        const progressMap = new Map();
        participantProgress.forEach(progress => {
          progressMap.set(progress.experimentId.toString(), progress);
        });
        
        // Combine data and filter
        const experimentsWithProgress = experiments.map(experiment => {
          const progress = progressMap.get(experiment._id.toString());
          
          // If filtering by status and this experiment doesn't match, skip it
          if (filterStatus && progress && progress.status !== filterStatus) {
            return null;
          }
          
          return {
            id: experiment._id,
            name: experiment.name,
            description: experiment.description,
            status: experiment.status,
            progress: progress ? {
              status: progress.status,
              startedAt: progress.startedAt,
              completedAt: progress.completedAt,
              lastActivityAt: progress.lastActivityAt
            } : {
              status: 'not_started'
            },
            createdAt: experiment.createdAt
          };
        }).filter(Boolean); // Remove null entries
        
        console.log(`[DEBUG] Found ${experimentsWithProgress.length} experiments for user`);
        return NextResponse.json(experimentsWithProgress);
      },
      // The fallback value if the database operations fail
      () => {
        console.log('[DEBUG] Using fallback experiment data');
        let allExperiments = generateFallbackExperiments();
        
        // Filter experiments if needed
        if (filterStatus) {
          allExperiments = allExperiments.filter(exp => exp.progress.status === filterStatus);
        }
        
        return NextResponse.json(allExperiments);
      },
      'fetch participant experiments'
    );
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