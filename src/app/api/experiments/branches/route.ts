import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import mongoose from 'mongoose';

// Add a new branch to an experiment
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
    
    const { experimentId, branch } = await request.json();

    if (!experimentId || !branch || !branch.fromStageId || !branch.defaultTargetStageId) {
      return NextResponse.json(
        { message: 'Experiment ID, from stage ID, and default target stage ID are required' },
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
    
    // Validate that stages exist
    const stageIds = experiment.stages.map(stage => stage._id.toString());
    if (!stageIds.includes(branch.fromStageId)) {
      return NextResponse.json(
        { message: 'From stage not found in experiment' },
        { status: 400 }
      );
    }
    
    if (!stageIds.includes(branch.defaultTargetStageId)) {
      return NextResponse.json(
        { message: 'Default target stage not found in experiment' },
        { status: 400 }
      );
    }
    
    // Check if a branch already exists from this stage
    const existingBranchIndex = experiment.branches.findIndex(b => 
      b.fromStageId.toString() === branch.fromStageId
    );
    
    if (existingBranchIndex !== -1) {
      return NextResponse.json(
        { message: 'A branch already exists from this stage' },
        { status: 400 }
      );
    }
    
    // Validate conditions if provided
    if (branch.conditions && Array.isArray(branch.conditions)) {
      for (const condition of branch.conditions) {
        if (!condition.type) {
          return NextResponse.json(
            { message: 'Each condition must have a type' },
            { status: 400 }
          );
        }
        
        if (!condition.targetStageId || !stageIds.includes(condition.targetStageId)) {
          return NextResponse.json(
            { message: 'Each condition must have a valid target stage ID' },
            { status: 400 }
          );
        }
        
        // Type-specific validations
        switch (condition.type) {
          case 'response':
            if (!condition.sourceStageId || !stageIds.includes(condition.sourceStageId)) {
              return NextResponse.json(
                { message: 'Response conditions must have a valid source stage ID' },
                { status: 400 }
              );
            }
            if (!condition.questionId) {
              return NextResponse.json(
                { message: 'Response conditions must have a question ID' },
                { status: 400 }
              );
            }
            if (condition.operator && !['equals', 'contains', 'greaterThan', 'lessThan'].includes(condition.operator)) {
              return NextResponse.json(
                { message: 'Invalid operator for response condition' },
                { status: 400 }
              );
            }
            break;
            
          case 'completion':
            if (!condition.sourceStageId || !stageIds.includes(condition.sourceStageId)) {
              return NextResponse.json(
                { message: 'Completion conditions must have a valid source stage ID' },
                { status: 400 }
              );
            }
            if (condition.threshold !== undefined && (typeof condition.threshold !== 'number' || condition.threshold < 0 || condition.threshold > 100)) {
              return NextResponse.json(
                { message: 'Completion threshold must be a number between 0 and 100' },
                { status: 400 }
              );
            }
            break;
            
          case 'time':
            if (!condition.sourceStageId || !stageIds.includes(condition.sourceStageId)) {
              return NextResponse.json(
                { message: 'Time conditions must have a valid source stage ID' },
                { status: 400 }
              );
            }
            if (condition.threshold === undefined || typeof condition.threshold !== 'number' || condition.threshold <= 0) {
              return NextResponse.json(
                { message: 'Time threshold must be a positive number' },
                { status: 400 }
              );
            }
            break;
            
          case 'random':
            if (condition.probability === undefined || typeof condition.probability !== 'number' || condition.probability < 0 || condition.probability > 100) {
              return NextResponse.json(
                { message: 'Random probability must be a number between 0 and 100' },
                { status: 400 }
              );
            }
            break;
            
          case 'always':
            // No additional validation needed
            break;
            
          default:
            return NextResponse.json(
              { message: 'Invalid condition type' },
              { status: 400 }
            );
        }
      }
    }
    
    // Add new branch
    const newBranch = {
      fromStageId: new mongoose.Types.ObjectId(branch.fromStageId),
      conditions: branch.conditions || [],
      defaultTargetStageId: new mongoose.Types.ObjectId(branch.defaultTargetStageId)
    };
    
    experiment.branches.push(newBranch);
    experiment.lastEditedAt = new Date();
    
    await experiment.save();
    
    // Return the added branch with its generated ID
    const addedBranch = experiment.branches[experiment.branches.length - 1];
    
    return NextResponse.json({
      message: 'Branch added successfully',
      branch: {
        id: addedBranch._id,
        fromStageId: addedBranch.fromStageId,
        conditions: addedBranch.conditions,
        defaultTargetStageId: addedBranch.defaultTargetStageId
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error adding branch:', error);
    return NextResponse.json(
      { message: 'Error adding branch', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update an existing branch
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
    
    const { experimentId, branchId, branch } = await request.json();

    if (!experimentId || !branchId || !branch || !branch.defaultTargetStageId) {
      return NextResponse.json(
        { message: 'Experiment ID, branch ID, and default target stage ID are required' },
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
    
    // Find the branch
    const branchIndex = experiment.branches.findIndex(b => 
      b._id.toString() === branchId
    );
    
    if (branchIndex === -1) {
      return NextResponse.json(
        { message: 'Branch not found in experiment' },
        { status: 404 }
      );
    }
    
    // Validate that stages exist
    const stageIds = experiment.stages.map(stage => stage._id.toString());
    if (!stageIds.includes(branch.defaultTargetStageId)) {
      return NextResponse.json(
        { message: 'Default target stage not found in experiment' },
        { status: 400 }
      );
    }
    
    // Validate conditions if provided
    if (branch.conditions && Array.isArray(branch.conditions)) {
      for (const condition of branch.conditions) {
        if (!condition.type) {
          return NextResponse.json(
            { message: 'Each condition must have a type' },
            { status: 400 }
          );
        }
        
        if (!condition.targetStageId || !stageIds.includes(condition.targetStageId)) {
          return NextResponse.json(
            { message: 'Each condition must have a valid target stage ID' },
            { status: 400 }
          );
        }
        
        // Type-specific validations (same as in POST)
        switch (condition.type) {
          case 'response':
            if (!condition.sourceStageId || !stageIds.includes(condition.sourceStageId)) {
              return NextResponse.json(
                { message: 'Response conditions must have a valid source stage ID' },
                { status: 400 }
              );
            }
            if (!condition.questionId) {
              return NextResponse.json(
                { message: 'Response conditions must have a question ID' },
                { status: 400 }
              );
            }
            break;
            
          case 'completion':
          case 'time':
            if (!condition.sourceStageId || !stageIds.includes(condition.sourceStageId)) {
              return NextResponse.json(
                { message: `${condition.type} conditions must have a valid source stage ID` },
                { status: 400 }
              );
            }
            break;
        }
      }
    }
    
    // Update the branch (preserve the fromStageId and _id)
    const updatedBranch = {
      _id: experiment.branches[branchIndex]._id,
      fromStageId: experiment.branches[branchIndex].fromStageId,
      conditions: branch.conditions || [],
      defaultTargetStageId: new mongoose.Types.ObjectId(branch.defaultTargetStageId)
    };
    
    experiment.branches[branchIndex] = updatedBranch;
    experiment.lastEditedAt = new Date();
    
    await experiment.save();
    
    return NextResponse.json({
      message: 'Branch updated successfully',
      branch: {
        id: updatedBranch._id,
        fromStageId: updatedBranch.fromStageId,
        conditions: updatedBranch.conditions,
        defaultTargetStageId: updatedBranch.defaultTargetStageId
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating branch:', error);
    return NextResponse.json(
      { message: 'Error updating branch', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete a branch
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
    const branchId = searchParams.get('branchId');

    if (!experimentId || !branchId) {
      return NextResponse.json(
        { message: 'Experiment ID and branch ID are required' },
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
    
    // Find branch index
    const branchIndex = experiment.branches.findIndex(branch => 
      branch._id.toString() === branchId
    );
    
    if (branchIndex === -1) {
      return NextResponse.json(
        { message: 'Branch not found in experiment' },
        { status: 404 }
      );
    }
    
    // Remove the branch
    experiment.branches.splice(branchIndex, 1);
    experiment.lastEditedAt = new Date();
    
    await experiment.save();
    
    return NextResponse.json({
      message: 'Branch deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting branch:', error);
    return NextResponse.json(
      { message: 'Error deleting branch', error: errorMessage },
      { status: 500 }
    );
  }
}