import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import User from '@/models/User';
import Experiment from '@/models/Experiment';
import Scenario from '@/models/Scenario';
import UserGroup from '@/models/UserGroup';

export async function GET() {
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
    // Fetch core metrics
    const [
      activeUsersCount,
      totalUsers,
      totalExperiments,
      activeExperiments,
      completedExperiments,
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
      
      // Count user groups
      UserGroup.countDocuments(),
      
      // Count scenarios
      Scenario.countDocuments(),
    ]);
    
    // Calculate completion rate based on completed vs total experiments
    const completionRate = totalExperiments > 0 
      ? Math.round((completedExperiments / totalExperiments) * 100) 
      : 0;
    
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
      const userGroupIds = experiment.userGroups.map((group: { userGroupId: mongoose.Types.ObjectId }) => group.userGroupId);
      const userGroupsData = await UserGroup.find(
        { _id: { $in: userGroupIds } },
        { name: 1, users: 1 }
      );
      
      // Calculate total participants
      const totalParticipants = userGroupsData.reduce(
        (sum, group) => sum + ((group.users as unknown[])?.length || 0), 
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
    
    // Calculate average participants per experiment
    const averageParticipants = totalExperiments > 0 
        ? Math.round(activeUsersCount / totalExperiments) 
        : 0;
        
    // Format analytics data with actual numbers
    const analyticsData = {
      activeUsers: activeUsersCount,
      totalUsers: totalUsers,
      experimentsRun: totalExperiments,
      activeExperiments: activeExperiments,
      completedExperiments: completedExperiments,
      userGroups: totalUserGroups,
      scenarios: totalScenarios,
      completionRate: completionRate,
      averageParticipantsPerExperiment: averageParticipants
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