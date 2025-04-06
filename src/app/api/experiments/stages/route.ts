import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';

// Add a new stage to an experiment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { experimentId, stage } = await request.json();

    if (!experimentId || !stage || !stage.type) {
      return NextResponse.json(
        { message: 'Experiment ID and stage details are required' },
        { status: 400 }
      );
    }

    // Validate stage data based on type
    const validationError = validateStageData(stage);
    if (validationError) {
      return NextResponse.json(
        { message: validationError },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the experiment
    const experiment = await Experiment.findById(experimentId);
    if (!experiment) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    // Add the new stage
    const stageWithOrder = {
      ...stage,
      order: experiment.stages.length  // Assign the next available order number
    };
    
    experiment.stages.push(stageWithOrder);
    experiment.lastEditedAt = new Date();
    
    // If this is the first stage, set it as the starting stage
    if (experiment.stages.length === 1) {
      experiment.startStageId = experiment.stages[0]._id;
    }
    
    await experiment.save();
    
    // Return the new stage with its ID
    const newStage = experiment.stages[experiment.stages.length - 1];
    
    return NextResponse.json({
      message: 'Stage added successfully',
      stage: {
        id: newStage._id,
        ...stageWithOrder
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error adding stage:', error);
    return NextResponse.json(
      { message: 'Error adding stage', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update an existing stage
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
    
    const { experimentId, stageId, stageData } = await request.json();

    if (!experimentId || !stageId || !stageData) {
      return NextResponse.json(
        { message: 'Experiment ID, stage ID, and stage data are required' },
        { status: 400 }
      );
    }

    // Validate stage data based on type
    const validationError = validateStageData(stageData);
    if (validationError) {
      return NextResponse.json(
        { message: validationError },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the experiment
    const experiment = await Experiment.findById(experimentId);
    if (!experiment) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    // Find and update the stage
    const stageIndex = experiment.stages.findIndex(stage => 
      stage._id.toString() === stageId
    );
    
    if (stageIndex === -1) {
      return NextResponse.json(
        { message: 'Stage not found in experiment' },
        { status: 404 }
      );
    }
    
    // Update the stage
    const updatedStage = {
      ...stageData,
      _id: new mongoose.Types.ObjectId(stageId)  // Keep the original ID
    };
    
    experiment.stages[stageIndex] = updatedStage;
    experiment.lastEditedAt = new Date();
    
    await experiment.save();
    
    return NextResponse.json({
      message: 'Stage updated successfully',
      stage: {
        id: stageId,
        ...stageData
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating stage:', error);
    return NextResponse.json(
      { message: 'Error updating stage', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a stage
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check if user is authenticated and is admin
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const experimentId = searchParams.get('experimentId');
    const stageId = searchParams.get('stageId');

    if (!experimentId || !stageId) {
      return NextResponse.json(
        { message: 'Experiment ID and stage ID are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find the experiment
    const experiment = await Experiment.findById(experimentId);
    if (!experiment) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    // Check if this is the start stage
    if (experiment.startStageId && experiment.startStageId.toString() === stageId) {
      return NextResponse.json(
        { message: 'Cannot delete the start stage. Please set another stage as the start stage first.' },
        { status: 400 }
      );
    }
    
    // Find stage index
    const stageIndex = experiment.stages.findIndex(stage => 
      stage._id.toString() === stageId
    );
    
    if (stageIndex === -1) {
      return NextResponse.json(
        { message: 'Stage not found in experiment' },
        { status: 404 }
      );
    }
    
    // Remove the stage
    experiment.stages.splice(stageIndex, 1);
    
    // Also remove any branches that reference this stage
    experiment.branches = experiment.branches.filter(branch => 
      branch.fromStageId.toString() !== stageId && 
      branch.defaultTargetStageId.toString() !== stageId
    );
    
    // Update branch conditions that reference this stage
    experiment.branches.forEach(branch => {
      branch.conditions = branch.conditions.filter(condition => 
        condition.targetStageId.toString() !== stageId &&
        (!condition.sourceStageId || condition.sourceStageId.toString() !== stageId)
      );
    });
    
    experiment.lastEditedAt = new Date();
    
    await experiment.save();
    
    return NextResponse.json({
      message: 'Stage deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting stage:', error);
    return NextResponse.json(
      { message: 'Error deleting stage', error: errorMessage },
      { status: 500 }
    );
  }
}

// Helper function to validate stage data based on type
function validateStageData(stage: {
  type: string;
  title?: string;
  description?: string;
  durationSeconds?: number;
  content?: string;
  format?: string;
  scenarioId?: string;
  questions?: Array<{
    id?: string;
    text?: string;
    type?: string;
    options?: string[];
  }>;
  message?: string;
  [key: string]: any;
}) {
  const { type, title, description, durationSeconds } = stage;
  
  // Common validations
  if (!title) return 'Stage title is required';
  if (!description) return 'Stage description is required';
  if (durationSeconds === undefined) return 'Duration is required';
  if (durationSeconds < 0) return 'Duration cannot be negative';
  
  // Type-specific validations
  switch (type) {
    case 'instructions':
      if (!stage.content) return 'Content is required for instruction stages';
      if (!['text', 'markdown', 'html'].includes(stage.format)) {
        return 'Invalid format for instruction stage. Must be text, markdown, or html';
      }
      break;
      
    case 'scenario':
      if (!stage.scenarioId) return 'Scenario ID is required for scenario stages';
      break;
      
    case 'survey':
      if (!stage.questions || !Array.isArray(stage.questions) || stage.questions.length === 0) {
        return 'Survey stages must have at least one question';
      }
      for (const question of stage.questions) {
        if (!question.id) return 'Each question must have an ID';
        if (!question.text) return 'Each question must have text';
        if (!['text', 'multipleChoice', 'rating', 'checkboxes'].includes(question.type)) {
          return 'Invalid question type. Must be text, multipleChoice, rating, or checkboxes';
        }
        if (['multipleChoice', 'checkboxes'].includes(question.type) && 
            (!question.options || !Array.isArray(question.options) || question.options.length < 2)) {
          return 'Multiple choice and checkbox questions must have at least 2 options';
        }
      }
      break;
      
    case 'break':
      if (!stage.message) return 'Message is required for break stages';
      break;
      
    default:
      return 'Invalid stage type. Must be instructions, scenario, survey, or break';
  }
  
  return null; // No validation errors
}