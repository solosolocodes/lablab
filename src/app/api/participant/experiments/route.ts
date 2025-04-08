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
    // Step 1: Authentication
    const session = await getServerSession();
    
    // TEMPORARILY REMOVED AUTHENTICATION CHECK FOR TESTING
    // WARNING: This is insecure and should be restored after testing
    console.log('[DEBUG] ⚠️ AUTHENTICATION CHECKS REMOVED - TEST MODE ONLY ⚠️');
    
    // Create a default session if none exists
    if (!session || !session.user) {
      console.log('[DEBUG] No session detected, using test session');
      session = {
        user: {
          email: 'test@example.com',
          id: '000000000000000000000000',
          role: 'participant'
        }
      } as any;
    }
    
    console.log(`[DEBUG] Processing request for user: ${session.user.email}`);
    
    // Log full session info for troubleshooting
    console.log('[DEBUG] Session info:', JSON.stringify({
      email: session.user.email,
      id: session.user.id,
      role: session.user.role
    }));
    
    // Step 2: Database connection
    try {
      await connectDB();
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ 
        message: 'Database connection failed', 
        error: dbError instanceof Error ? dbError.message : 'Unknown error' 
      }, { status: 500 });
    }
    
    // Step 3: Get user details
    let user;
    try {
      console.log('[DEBUG] ⚠️ USING TEST USER WITHOUT DATABASE LOOKUP - TEST MODE ONLY ⚠️');
      
      // Create a test user without database lookup for testing
      user = {
        _id: new mongoose.Types.ObjectId('000000000000000000000000'), // Use a known test ID
        email: session.user?.email || 'test@example.com',
        name: session.user?.name || 'Test Participant',
        role: 'participant'
      };
      console.log(`[DEBUG] Using test user with ID: ${user._id}`);
      
      // Original user lookup code (commented out for testing)
      /*
      // Try to find user by ID first (from session)
      if (session.user.id) {
        try {
          const userId = new mongoose.Types.ObjectId(session.user.id);
          user = await User.findById(userId);
          if (user) {
            console.log(`[DEBUG] Found user by ID: ${user._id}, name: ${user.name}, role: ${user.role}`);
          }
        } catch (idError) {
          console.log(`[DEBUG] Error finding user by ID: ${idError instanceof Error ? idError.message : 'Unknown error'}`);
          // Continue to email lookup if ID lookup fails
        }
      }
      
      // If not found by ID, try by email
      if (!user) {
        user = await User.findOne({ email: session.user.email });
        if (user) {
          console.log(`[DEBUG] Found user by email: ${user._id}, name: ${user.name}, role: ${user.role}`);
        }
      }
      
      // If still no user found
      if (!user) {
        console.error(`[DEBUG] User not found for email: ${session.user.email} and id: ${session.user.id}`);
        
        // Create a session-based user object for queries if no database record exists
        user = {
          _id: session.user.id ? new mongoose.Types.ObjectId(session.user.id) : new mongoose.Types.ObjectId(),
          email: session.user.email,
          name: session.user.name || 'Participant',
          role: session.user.role || 'participant'
        };
        console.log(`[DEBUG] Created session-based user object with ID: ${user._id}`);
      }
      */
    } catch (userError) {
      console.error('Error creating test user:', userError);
      // Create a fallback test user even if there's an error
      user = {
        _id: new mongoose.Types.ObjectId('000000000000000000000000'),
        email: 'fallback@example.com',
        name: 'Fallback Test User',
        role: 'participant'
      };
    }
    
    // TEMPORARILY REMOVED ROLE CHECK FOR TESTING
    // WARNING: This is insecure and should be restored after testing
    console.log('[DEBUG] ⚠️ ROLE CHECK REMOVED - TEST MODE ONLY ⚠️');
    // Original code:
    // if (user.role !== 'participant') {
    //   return NextResponse.json({ message: 'Unauthorized. Only participants can access this endpoint' }, { status: 403 });
    // }
    
    // Step 4: Find user groups
    let userGroups;
    try {
      console.log('[DEBUG] ⚠️ USING TEST USER GROUPS WITHOUT DATABASE LOOKUP - TEST MODE ONLY ⚠️');
      
      // Create test user groups without database lookup
      userGroups = [
        {
          _id: new mongoose.Types.ObjectId('100000000000000000000001'),
          name: 'Test Group 1'
        },
        {
          _id: new mongoose.Types.ObjectId('100000000000000000000002'),
          name: 'Test Group 2'
        }
      ];
      
      console.log(`[DEBUG] Using ${userGroups.length} test user groups`);
      console.log(`[DEBUG] Test groups: ${userGroups.map(g => g.name || g._id).join(', ')}`);
      
      // Original user group lookup code (commented out for testing)
      /*
      console.log(`[DEBUG] User ID type: ${typeof user._id}, value: ${user._id}`);
      
      // Ensure we have a valid ObjectId
      const userId = typeof user._id === 'string' 
        ? new mongoose.Types.ObjectId(user._id) 
        : user._id;
      
      console.log(`[DEBUG] Looking for user groups with user ID: ${userId}`);
      
      // First try exact match with the user's ID
      userGroups = await UserGroup.find({
        users: userId
      }).select('_id name').lean();
      
      console.log(`[DEBUG] Found ${userGroups.length} user groups for user ${userId}`);
      
      // If user groups found, log their names for debugging
      if (userGroups.length > 0) {
        console.log(`[DEBUG] User groups: ${userGroups.map(g => g.name || g._id).join(', ')}`);
      } else {
        console.log(`[DEBUG] User ${userId} is not a member of any user groups`);
        
        // Try a string comparison as fallback if exact ObjectId match fails
        if (typeof user._id === 'object') {
          console.log(`[DEBUG] Trying string comparison as fallback...`);
          
          // Get all user groups
          const allGroups = await UserGroup.find({}).lean();
          console.log(`[DEBUG] Found ${allGroups.length} total user groups`);
          
          // Manually filter to find matching user IDs
          userGroups = allGroups.filter(group => {
            if (!group.users || !Array.isArray(group.users)) return false;
            
            return group.users.some(groupUserId => {
              // Convert both to strings for comparison
              const groupUserIdStr = groupUserId.toString();
              const userIdStr = userId.toString();
              return groupUserIdStr === userIdStr;
            });
          });
          
          console.log(`[DEBUG] Found ${userGroups.length} groups after manual string comparison`);
          if (userGroups.length > 0) {
            console.log(`[DEBUG] Matched user groups: ${userGroups.map(g => g.name || g._id).join(', ')}`);
          }
        }
        
        // If still no user groups, return empty array
        if (userGroups.length === 0) {
          console.log(`[DEBUG] After all attempts, user ${userId} is not in any groups`);
          return NextResponse.json([]);
        }
      }
      */
    } catch (groupError) {
      console.error('Error creating test user groups:', groupError);
      // Create fallback test groups if there's an error
      userGroups = [
        {
          _id: new mongoose.Types.ObjectId('100000000000000000000099'),
          name: 'Fallback Test Group'
        }
      ];
    }
    
    const userGroupIds = userGroups.map(group => group._id);
    
    // Query parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const filterStatus = status === 'all' ? undefined : status;
    
    // Step 5: Find experiments
    let experiments;
    try {
      console.log('[DEBUG] ⚠️ USING TEST EXPERIMENTS WITHOUT DATABASE LOOKUP - TEST MODE ONLY ⚠️');
      
      // Log group IDs for debugging
      console.log(`[DEBUG] User group IDs:`, userGroupIds.map(id => id.toString()));
      
      // Create test experiments data without database lookup
      const currentDate = new Date();
      experiments = [
        {
          _id: new mongoose.Types.ObjectId('200000000000000000000001'),
          name: 'Test Experiment 1',
          description: 'This is a test experiment for debugging',
          status: 'active',
          userGroups: [
            { 
              userGroupId: userGroups[0]._id,
              condition: 'control'
            }
          ],
          createdAt: new Date(currentDate.setDate(currentDate.getDate() - 5))
        },
        {
          _id: new mongoose.Types.ObjectId('200000000000000000000002'),
          name: 'Test Experiment 2',
          description: 'Another test experiment for debugging purposes',
          status: 'active',
          userGroups: [
            { 
              userGroupId: userGroups[0]._id,
              condition: 'experimental'
            }
          ],
          createdAt: new Date(currentDate.setDate(currentDate.getDate() - 2))
        }
      ];
      
      console.log(`[DEBUG] Using ${experiments.length} test experiments`);
      console.log(`[DEBUG] Test experiments: ${experiments.map(e => e.name).join(', ')}`);
      
      // Original experiment lookup code (commented out for testing)
      /*
      // Convert all userGroupIds to strings and ObjectIds for comparison
      const userGroupIdStrings = userGroupIds.map(id => id.toString());
      const userGroupIdObjects = userGroupIds.map(id => 
        typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
      );
      
      // Find all active experiments
      const allActiveExperiments = await Experiment.find({
        status: 'active' // Only include active experiments
      }).select('_id name description status userGroups createdAt').lean();
      
      console.log(`[DEBUG] Found ${allActiveExperiments.length} total active experiments`);
      
      // Manually filter experiments to find those that match user groups
      // This approach is more reliable than relying on MongoDB query with nested arrays
      experiments = allActiveExperiments.filter(experiment => {
        if (!experiment.userGroups || !Array.isArray(experiment.userGroups) || experiment.userGroups.length === 0) {
          return false;
        }
        
        return experiment.userGroups.some(groupAssignment => {
          // Get the userGroupId in string format for comparison
          const expGroupId = groupAssignment.userGroupId.toString();
          return userGroupIdStrings.includes(expGroupId);
        });
      });
      
      console.log(`[DEBUG] Found ${experiments.length} experiments matching user's groups`);
      
      // Log matching experiments
      if (experiments.length > 0) {
        console.log(`[DEBUG] Matched experiments: ${experiments.map(e => e.name).join(', ')}`);
        
        // Log detailed information about each experiment's user groups
        experiments.forEach(exp => {
          console.log(`[DEBUG] Experiment "${exp.name}" has user groups:`, 
            exp.userGroups.map(g => g.userGroupId.toString()).join(', '));
        });
      }
      */
    } catch (experimentError) {
      console.error('Error creating test experiments:', experimentError);
      // Create fallback experiment data if there's an error
      experiments = [
        {
          _id: new mongoose.Types.ObjectId('200000000000000000000099'),
          name: 'Fallback Test Experiment',
          description: 'This is a fallback experiment for error recovery',
          status: 'active',
          userGroups: [],
          createdAt: new Date()
        }
      ];
    }
    
    // If no experiments found, return empty array early
    if (experiments.length === 0) {
      console.log(`[DEBUG] No active experiments found for user ${user._id}`);
      return NextResponse.json([]);
    }
    
    // Step 6: Get participant progress
    let participantProgress;
    try {
      console.log('[DEBUG] ⚠️ USING TEST PROGRESS DATA WITHOUT DATABASE LOOKUP - TEST MODE ONLY ⚠️');
      
      // Create test progress data without database lookup
      participantProgress = [
        {
          userId: user._id,
          experimentId: experiments[0]._id, // First experiment
          status: 'in_progress',
          currentStageId: new mongoose.Types.ObjectId('300000000000000000000001'),
          completedStages: [new mongoose.Types.ObjectId('300000000000000000000001')],
          startedAt: new Date(new Date().setDate(new Date().getDate() - 1)),
          lastActivityAt: new Date()
        }
      ];
      
      console.log(`[DEBUG] Using ${participantProgress.length} test progress records`);
      
      // Original progress lookup code (commented out for testing)
      /*
      // Ensure we have a valid ObjectId for userId
      const userId = typeof user._id === 'string' 
        ? new mongoose.Types.ObjectId(user._id) 
        : user._id;
        
      // Get valid ObjectIds for experiment IDs
      const experimentIds = experiments.map(exp => {
        return typeof exp._id === 'string' 
          ? new mongoose.Types.ObjectId(exp._id) 
          : exp._id;
      });
      
      participantProgress = await ParticipantProgress.find({
        userId: userId,
        experimentId: { $in: experimentIds }
      }).lean();
      
      console.log(`[DEBUG] Found ${participantProgress.length} progress records for user ${userId}`);
      */
    } catch (progressError) {
      console.error('Error creating test progress data:', progressError);
      // Just use empty array if there's an error
      participantProgress = [];
    }
    
    // Create a map for quick lookups
    const progressMap = new Map();
    participantProgress.forEach(progress => {
      progressMap.set(progress.experimentId.toString(), progress);
    });
    
    // Step 7: Combine experiment data with participant progress
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
    
    console.log(`[DEBUG] Returning ${experimentsWithProgress.length} experiments after filtering`);
    return NextResponse.json(experimentsWithProgress);
  } catch (error) {
    console.error('Error fetching participant experiments:', error);
    return NextResponse.json(
      { 
        message: 'Failed to fetch experiments', 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV !== 'production' ? (error instanceof Error ? error.stack : null) : null
      }, 
      { status: 500 }
    );
  }
}