import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import connectDB from '@/lib/dbConnect';
import Experiment from '@/models/Experiment';
import User from '@/models/User';
import UserGroup from '@/models/UserGroup';
import ParticipantProgress from '@/models/ParticipantProgress';
import mongoose from 'mongoose';

// GET /api/participant/experiments
// Fetches all experiments available to the current participant
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    // Check for authentication
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    // Connect to database
    await connectDB();
    
    // Get user details
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    // Check if user is a participant
    if (user.role !== 'participant') {
      return NextResponse.json({ message: 'Unauthorized. Only participants can access this endpoint' }, { status: 403 });
    }
    
    // Find all user groups that include this participant
    const userGroups = await UserGroup.find({
      users: user._id
    }).select('_id');
    
    const userGroupIds = userGroups.map(group => group._id);
    
    // Query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const filterStatus = status === 'all' ? undefined : status;
    
    // Find all active experiments associated with the user's groups
    const experimentQuery: any = {
      status: 'active', // Only include active experiments
      'userGroups.userGroupId': { $in: userGroupIds } // Filter by user's group membership
    };
    
    // Get all the experiments
    const experiments = await Experiment.find(experimentQuery)
      .select('_id name description status userGroups createdAt')
      .lean();
    
    // Get the participant's progress for all these experiments
    const participantProgress = await ParticipantProgress.find({
      userId: user._id,
      experimentId: { $in: experiments.map(exp => exp._id) }
    }).lean();
    
    // Create a map for quick lookups
    const progressMap = new Map();
    participantProgress.forEach(progress => {
      progressMap.set(progress.experimentId.toString(), progress);
    });
    
    // Combine experiment data with participant progress
    const experimentsWithProgress = experiments.map(experiment => {
      const progress = progressMap.get(experiment._id.toString());
      
      // If we're filtering by status and this experiment doesn't match, return null
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
    }).filter(Boolean); // Remove null entries (filtered out)
    
    return NextResponse.json(experimentsWithProgress);
  } catch (error) {
    console.error('Error fetching participant experiments:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch experiments', 
        error: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}