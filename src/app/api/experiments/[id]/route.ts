import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to get experiment ID from URL
function getExperimentId(request: NextRequest): string {
  const pathParts = request.nextUrl.pathname.split('/');
  return pathParts[pathParts.length - 1];
}

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
    
    const experimentId = getExperimentId(request);
    
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
          scenarioId: stage.scenarioId,
          rounds: stage.rounds,
          roundDuration: stage.roundDuration
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

// Update an experiment by ID
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
    
    const experimentId = getExperimentId(request);
    const { name, description, status, userGroups, stages, branches, startStageId } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { message: 'Name and description are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if experiment exists
    const experiment = await Experiment.findById(experimentId);
    if (!experiment) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    experiment.name = name;
    experiment.description = description;
    experiment.lastEditedAt = new Date();
    
    // Only update optional fields if provided
    if (status) experiment.status = status;
    
    // Handle userGroups
    if (userGroups) {
      // Define interface for userGroup
      interface UserGroupInput {
        userGroupId: string;
        condition: string;
        maxParticipants?: number | string;
      }
      
      // Use already imported mongoose
      // Log userGroups for debugging
      console.log('Processing userGroups:', JSON.stringify(userGroups, null, 2));
      
      // Ensure maxParticipants is a number or undefined
      experiment.userGroups = userGroups.map((group: UserGroupInput) => {
        // Convert userGroupId to ObjectId if it's a string
        let userGroupId;
        try {
          // Check if it's already a valid ID
          userGroupId = group.userGroupId;
        } catch (err) {
          console.error('Error processing userGroupId:', err);
          userGroupId = group.userGroupId;
        }
        
        return {
          userGroupId: userGroupId,
          condition: group.condition,
          maxParticipants: group.maxParticipants !== undefined ? Number(group.maxParticipants) : undefined
        };
      });
    }
    
    // Handle stages - need to ensure all required fields are present based on type
    if (stages) {
      // Define interfaces for stage data
      interface BaseStageInput {
        id: string;
        type: 'instructions' | 'scenario' | 'survey' | 'break';
        title: string;
        description: string;
        durationSeconds: number | string;
        required?: boolean;
        order: number | string;
      }
      
      interface InstructionsStageInput extends BaseStageInput {
        type: 'instructions';
        content: string;
        format?: 'text' | 'markdown' | 'html';
      }
      
      interface ScenarioStageInput extends BaseStageInput {
        type: 'scenario';
        scenarioId: string;
        rounds?: number | string;
        roundDuration?: number | string;
      }
      
      interface SurveyStageInput extends BaseStageInput {
        type: 'survey';
        questions?: Array<{
          id: string;
          text: string;
          type: string;
          options?: string[];
          required?: boolean;
        }>;
      }
      
      interface BreakStageInput extends BaseStageInput {
        type: 'break';
        message: string;
      }
      
      type StageInput = InstructionsStageInput | ScenarioStageInput | SurveyStageInput | BreakStageInput;
      
      experiment.stages = [];
      
      // Process each stage
      for (const stage of stages as StageInput[]) {
        // Common fields for all stage types
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stageData: any = {
          type: stage.type,
          title: stage.title,
          description: stage.description,
          durationSeconds: Number(stage.durationSeconds),
          required: stage.required !== undefined ? Boolean(stage.required) : true,
          order: Number(stage.order)
        };
        
        // Add type-specific fields
        if (stage.type === 'instructions') {
          stageData.content = stage.content || 'Enter instructions here...';
          stageData.format = stage.format || 'markdown';
        } 
        else if (stage.type === 'scenario') {
          // Use scenarioId as-is since Mongoose will handle conversion
          if (stage.scenarioId) {
            try {
              stageData.scenarioId = stage.scenarioId;
            } catch (err) {
              console.error('Error processing scenarioId:', err);
              stageData.scenarioId = stage.scenarioId;
            }
          }
          
          stageData.rounds = stage.rounds ? Number(stage.rounds) : 1;
          stageData.roundDuration = stage.roundDuration ? Number(stage.roundDuration) : 60;
        }
        else if (stage.type === 'survey') {
          stageData.questions = (stage.questions || []).map(q => ({
            id: q.id,
            text: q.text,
            type: q.type,
            options: q.options || [],
            required: q.required !== undefined ? Boolean(q.required) : true
          }));
        }
        else if (stage.type === 'break') {
          stageData.message = stage.message;
        }
        
        // Add the stage to the experiment
        experiment.stages.push(stageData);
      }
    }
    
    if (branches) experiment.branches = branches;
    if (startStageId) experiment.startStageId = startStageId;
    
    // Log experiment before saving for debugging
    console.log('About to save experiment, stages:', JSON.stringify(experiment.stages, null, 2));
    console.log('About to save experiment, userGroups:', JSON.stringify(experiment.userGroups, null, 2));
    
    try {
      // Save changes
      await experiment.save();
    } catch (saveError) {
      console.error('Error saving experiment:', saveError);
      if (saveError instanceof Error && saveError.name === 'ValidationError') {
        throw saveError;
      }
      throw new Error(`Failed to save experiment: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
    }
    
    // Return successful response
    return NextResponse.json({
      message: 'Experiment updated successfully',
      experiment: {
        id: experiment._id,
        name: experiment.name,
        description: experiment.description,
        status: experiment.status,
        userGroups: experiment.userGroups,
        stages: experiment.stages,
        branches: experiment.branches,
        startStageId: experiment.startStageId,
        createdAt: experiment.createdAt,
        updatedAt: experiment.updatedAt,
        lastEditedAt: experiment.lastEditedAt,
      }
    });
  } catch (error: unknown) {
    // Detailed error logging
    console.error('Error updating experiment:', error);
    
    // Handle MongoDB validation errors
    if (error instanceof Error && 'name' in error && error.name === 'ValidationError') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validationError = error as any;
      const errors: Record<string, string> = {};
      
      // Extract validation error messages and log details
      console.log('Full validation error:', JSON.stringify(validationError, null, 2));
      
      if (validationError.errors) {
        Object.keys(validationError.errors).forEach(key => {
          console.log(`Validation error for ${key}:`, validationError.errors[key]);
          errors[key] = validationError.errors[key].message;
        });
      }
      
      return NextResponse.json(
        { 
          message: 'Validation error when updating experiment', 
          errors,
          error: validationError.message 
        },
        { status: 400 }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { message: 'Error updating experiment', error: errorMessage },
      { status: 500 }
    );
  }
}