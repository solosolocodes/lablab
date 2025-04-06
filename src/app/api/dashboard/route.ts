import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import User from '@/models/User';
import Experiment from '@/models/Experiment';
import Scenario from '@/models/Scenario';
import UserGroup from '@/models/UserGroup';

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
    
    // Fetch data for analytics
    const [
      activeUsersCount,
      totalUsers,
      totalExperiments,
      activeExperiments,
      completedExperiments,
      completionRate,
      totalUserGroups,
      totalScenarios
    ] = await Promise.all([
      // Count active users (participants who have logged in)
      User.countDocuments({ role: 'participant' }),
      
      // Count total users
      User.countDocuments(),
      
      // Count total experiments
      Experiment.countDocuments(),
      
      // Count active experiments
      Experiment.countDocuments({ status: { $in: ['active', 'published'] } }),
      
      // Count completed experiments
      Experiment.countDocuments({ status: 'completed' }),
      
      // Get overall completion rate (placeholder - would need actual participation data)
      Promise.resolve(78), // Placeholder value
      
      // Count user groups
      UserGroup.countDocuments(),
      
      // Count scenarios
      Scenario.countDocuments(),
    ]);
    
    // Fetch recent active experiments
    const recentExperiments = await Experiment.find(
      { status: { $in: ['active', 'published'] } },
      {
        name: 1,
        status: 1,
        updatedAt: 1,
        userGroups: 1,
        stages: 1
      }
    )
    .sort({ updatedAt: -1 })
    .limit(5);
    
    // Format experiments for display
    const formattedExperiments = await Promise.all(recentExperiments.map(async (experiment) => {
      // Count total participants assigned to this experiment
      const userGroupIds = experiment.userGroups.map(group => group.userGroupId);
      const userGroupsData = await UserGroup.find(
        { _id: { $in: userGroupIds } },
        { name: 1, participants: 1 }
      );
      
      // Calculate total participants
      const totalParticipants = userGroupsData.reduce(
        (sum, group) => sum + (group.participants?.length || 0), 
        0
      );
      
      // Calculate a pseudo-progress based on time since creation
      // In a real app, this would be based on actual progress data
      const now = new Date();
      const created = new Date(experiment.createdAt);
      const ageInDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      const progress = Math.min(Math.floor(ageInDays * 10), 100);
      
      return {
        id: experiment._id.toString(),
        name: experiment.name,
        status: experiment.status,
        participants: totalParticipants,
        stages: experiment.stages.length,
        progress: progress
      };
    }));
    
    // Format analytics data
    const analyticsData = {
      activeUsers: activeUsersCount,
      totalUsers: totalUsers,
      experimentsRun: totalExperiments,
      activeExperiments: activeExperiments,
      completedExperiments: completedExperiments,
      userGroups: totalUserGroups,
      scenarios: totalScenarios,
      completionRate: completionRate,
      averageParticipantsPerExperiment: totalExperiments > 0 
        ? Math.floor(activeUsersCount / totalExperiments) 
        : 0
    };
    
    return NextResponse.json({
      analytics: analyticsData,
      activeExperiments: formattedExperiments
    });
    
  } catch (error: unknown) {
    console.error('Dashboard data fetch error:', error);
    return NextResponse.json(
      { 
        message: 'Error fetching dashboard data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}