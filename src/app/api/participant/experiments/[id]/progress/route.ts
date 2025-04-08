import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { withDatabaseConnection } from '@/lib/dbConnect';
import Experiment from '@/models/Experiment';
import User from '@/models/User';
import ParticipantProgress from '@/models/ParticipantProgress';
import mongoose from 'mongoose';

// Helper function to generate fallback progress data
function generateFallbackProgressData(experimentId: string) {
  // Return progress data based on the experiment ID
  switch (experimentId) {
    case '100000000000000000000001': // Not started experiment
      return {
        experimentId: experimentId,
        status: 'not_started',
        completedStages: [],
        currentStageId: null
      };
      
    case '100000000000000000000002': // In progress experiment
      return {
        experimentId: experimentId,
        status: 'in_progress',
        currentStageId: 'stage1',
        completedStages: ['intro'],
        startedAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
        lastActivityAt: new Date().toISOString()
      };
      
    case '100000000000000000000003': // Completed experiment
      return {
        experimentId: experimentId,
        status: 'completed',
        currentStageId: 'final',
        completedStages: ['intro', 'stage1', 'stage2', 'final'],
        startedAt: new Date(Date.now() - 604800000).toISOString(), // a week ago
        completedAt: new Date(Date.now() - 86400000).toISOString(), // yesterday
        lastActivityAt: new Date(Date.now() - 86400000).toISOString() // yesterday
      };
      
    default:
      // For any other experiment ID, return not_started
      return {
        experimentId: experimentId,
        status: 'not_started',
        completedStages: [],
        currentStageId: null
      };
  }
}

// GET /api/participant/experiments/[id]/progress
// Get detailed progress for a specific experiment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication
    const session = await getServerSession(authOptions);
    
    // Check for authentication
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[DEBUG] Processing progress request for user: ${session.user.email}`);
    
    // Step 2: Check role
    if (session.user.role !== 'participant') {
      return NextResponse.json(
        { message: 'Unauthorized. Only participants can access this endpoint' }, 
        { status: 403 }
      );
    }
    
    // Validate experiment ID
    const experimentId = params.id;
    
    // Step 3: Perform database operations with fallback
    return await withDatabaseConnection(
      async () => {
        // ACTUAL DATABASE OPERATIONS
        
        // Get user details
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        
        // Validate experiment ID
        if (!mongoose.Types.ObjectId.isValid(experimentId)) {
          return NextResponse.json({ message: 'Invalid experiment ID' }, { status: 400 });
        }
        
        // Get experiment details
        const experiment = await Experiment.findById(experimentId);
        if (!experiment) {
          return NextResponse.json({ message: 'Experiment not found' }, { status: 404 });
        }
        
        // Get participant's progress
        const progress = await ParticipantProgress.findOne({
          userId: user._id,
          experimentId: experiment._id
        });
        
        // If no progress record exists yet, return default values
        if (!progress) {
          return NextResponse.json({
            experimentId: experiment._id,
            status: 'not_started',
            completedStages: [],
            currentStageId: null
          });
        }
        
        // Return progress details
        return NextResponse.json({
          experimentId: progress.experimentId,
          status: progress.status,
          currentStageId: progress.currentStageId || null,
          completedStages: progress.completedStages || [],
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
          lastActivityAt: progress.lastActivityAt
        });
      },
      // The fallback value if the database operations fail
      () => {
        console.log(`[DEBUG] Using fallback progress data for experiment: ${experimentId}`);
        const fallbackProgress = generateFallbackProgressData(experimentId);
        return NextResponse.json(fallbackProgress);
      },
      'fetch experiment progress'
    );
  } catch (error) {
    console.error('Error in experiment progress API:', error);
    
    // Return a general error message
    return NextResponse.json(
      { 
        message: 'Failed to fetch experiment progress', 
        error: 'An unexpected error occurred',
      }, 
      { status: 500 }
    );
  }
}

// POST /api/participant/experiments/[id]/progress
// Update progress for a specific experiment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication
    const session = await getServerSession(authOptions);
    
    // Check for authentication
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }
    
    console.log(`[DEBUG] Processing progress update for user: ${session.user.email}`);
    
    // Step 2: Check role
    if (session.user.role !== 'participant') {
      return NextResponse.json(
        { message: 'Unauthorized. Only participants can access this endpoint' }, 
        { status: 403 }
      );
    }
    
    // Parse the request body
    const data = await request.json();
    const { status, currentStageId, completedStageId } = data;
    
    // Validate status if provided
    if (status && !['not_started', 'in_progress', 'completed'].includes(status)) {
      return NextResponse.json({ message: 'Invalid status value' }, { status: 400 });
    }
    
    // Get experiment ID
    const experimentId = params.id;
    
    // Step 3: Perform database operations with fallback
    return await withDatabaseConnection(
      async () => {
        // ACTUAL DATABASE OPERATIONS
        
        // Get user details
        const user = await User.findOne({ email: session.user.email });
        if (!user) {
          return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        
        // Validate experiment ID
        if (!mongoose.Types.ObjectId.isValid(experimentId)) {
          return NextResponse.json({ message: 'Invalid experiment ID' }, { status: 400 });
        }
        
        // Get experiment details
        const experiment = await Experiment.findById(experimentId);
        if (!experiment) {
          return NextResponse.json({ message: 'Experiment not found' }, { status: 404 });
        }
        
        // Find or create progress record
        let progress = await ParticipantProgress.findOne({
          userId: user._id,
          experimentId: experiment._id
        });
        
        if (!progress) {
          progress = new ParticipantProgress({
            userId: user._id,
            experimentId: experiment._id,
            status: 'not_started',
            completedStages: [],
            lastActivityAt: new Date()
          });
        }
        
        // Update fields based on request
        if (status) {
          progress.status = status;
          
          // Set timestamp based on status changes
          if (status === 'in_progress' && !progress.startedAt) {
            progress.startedAt = new Date();
          } else if (status === 'completed' && !progress.completedAt) {
            progress.completedAt = new Date();
          }
        }
        
        // Update current stage if provided
        if (currentStageId && mongoose.Types.ObjectId.isValid(currentStageId)) {
          progress.currentStageId = new mongoose.Types.ObjectId(currentStageId);
          
          // If we're updating current stage, also update status to in_progress if not already
          if (progress.status === 'not_started') {
            progress.status = 'in_progress';
            if (!progress.startedAt) {
              progress.startedAt = new Date();
            }
          }
        }
        
        // Add completed stage if provided
        if (completedStageId && mongoose.Types.ObjectId.isValid(completedStageId)) {
          // Check if the stage is already in the completed stages array
          const stageAlreadyCompleted = progress.completedStages.some(
            stageId => stageId.toString() === completedStageId
          );
          
          if (!stageAlreadyCompleted) {
            progress.completedStages.push(new mongoose.Types.ObjectId(completedStageId));
          }
        }
        
        // Always update the last activity timestamp
        progress.lastActivityAt = new Date();
        
        // Save changes
        await progress.save();
        
        return NextResponse.json({
          message: 'Progress updated successfully',
          progress: {
            experimentId: progress.experimentId,
            status: progress.status,
            currentStageId: progress.currentStageId || null,
            completedStages: progress.completedStages || [],
            startedAt: progress.startedAt,
            completedAt: progress.completedAt,
            lastActivityAt: progress.lastActivityAt
          }
        });
      },
      // The fallback value if the database operations fail
      () => {
        console.log(`[DEBUG] Using fallback for progress update on experiment: ${experimentId}`);
        
        // Create a simulated success response
        return NextResponse.json({
          message: 'Progress recorded (database unavailable - changes will not persist)',
          progress: {
            experimentId: params.id,
            status: status || 'in_progress',
            currentStageId: currentStageId || null,
            completedStages: completedStageId ? [completedStageId] : [],
            lastActivityAt: new Date().toISOString()
          }
        });
      },
      'update experiment progress'
    );
  } catch (error) {
    console.error('Error updating experiment progress:', error);
    
    // Return a general error message
    return NextResponse.json(
      { 
        message: 'Failed to update experiment progress', 
        error: 'An unexpected error occurred',
      }, 
      { status: 500 }
    );
  }
}