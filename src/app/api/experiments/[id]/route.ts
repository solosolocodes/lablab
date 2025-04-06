import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get a specific experiment by ID
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
    
    const pathParts = request.nextUrl.pathname.split('/');
    const experimentId = pathParts[pathParts.length - 1];
    
    // Find the experiment
    const experiment = await Experiment.findById(experimentId)
      .populate('userGroups.userGroupId', 'name description')
      .populate('createdBy', 'name email');
    
    if (!experiment) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    // Format response
    const formattedExperiment = {
      id: experiment._id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      createdBy: experiment.createdBy,
      userGroups: experiment.userGroups,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stages: experiment.stages.map((stage: any) => ({
        id: stage._id,
        type: stage.type,
        title: stage.title,
        description: stage.description,
        durationSeconds: stage.durationSeconds,
        required: stage.required,
        order: stage.order,
        // Additional fields based on stage type
        ...(stage.type === 'instructions' && {
          content: stage.content,
          format: stage.format
        }),
        ...(stage.type === 'scenario' && {
          scenarioId: stage.scenarioId
        }),
        ...(stage.type === 'survey' && {
          questions: stage.questions
        }),
        ...(stage.type === 'break' && {
          message: stage.message
        })
      })),
      branches: experiment.branches,
      startStageId: experiment.startStageId,
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
      lastEditedAt: experiment.lastEditedAt,
    };
    
    return NextResponse.json(formattedExperiment);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching experiment:', error);
    return NextResponse.json(
      { message: 'Error fetching experiment', error: errorMessage },
      { status: 500 }
    );
  }
}