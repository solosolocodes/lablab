import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';
import mongoose from 'mongoose';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all experiments with optional filtering
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
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // Create filter based on query parameters
    const filter: { status?: string } = {};
    if (status) filter.status = status;
    
    // Find experiments
    const experiments = await Experiment.find(filter)
      .sort({ updatedAt: -1 });
    
    // Format the response
    const formattedExperiments = experiments.map(experiment => ({
      id: experiment._id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      userGroups: experiment.userGroups,
      stageCount: experiment.stages.length,
      createdAt: experiment.createdAt,
      updatedAt: experiment.updatedAt,
      lastEditedAt: experiment.lastEditedAt,
    }));
    
    return NextResponse.json(formattedExperiments);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching experiments:', error);
    return NextResponse.json(
      { message: 'Error fetching experiments', error: errorMessage },
      { status: 500 }
    );
  }
}

// Create a new experiment
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
    
    const { name, description, userGroups = [] } = await request.json();

    if (!name || !description) {
      return NextResponse.json(
        { message: 'Name and description are required fields' },
        { status: 400 }
      );
    }

    await connectDB();

    // Create experiment
    const experiment = await Experiment.create({
      name,
      description,
      userGroups,
      status: 'draft',
      createdBy: new mongoose.Types.ObjectId(session.user.id),
      stages: [],
      branches: [],
    });
    
    // Return successful response
    return NextResponse.json({
      message: 'Experiment created successfully',
      experiment: {
        id: experiment._id,
        name: experiment.name,
        description: experiment.description,
        status: experiment.status,
        userGroups: experiment.userGroups,
        stageCount: experiment.stages.length,
        createdAt: experiment.createdAt,
        updatedAt: experiment.updatedAt,
        lastEditedAt: experiment.lastEditedAt,
      }
    }, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error creating experiment:', error);
    return NextResponse.json(
      { message: 'Error creating experiment', error: errorMessage },
      { status: 500 }
    );
  }
}

// Update an experiment
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
    
    const { id, name, description, status, userGroups, stages, branches, startStageId } = await request.json();

    if (!id || !name || !description) {
      return NextResponse.json(
        { message: 'ID, name, and description are required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Check if experiment exists
    const experiment = await Experiment.findById(id);
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
    if (userGroups) experiment.userGroups = userGroups;
    if (stages) experiment.stages = stages;
    if (branches) experiment.branches = branches;
    if (startStageId) experiment.startStageId = startStageId;
    
    // Save changes
    await experiment.save();
    
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error updating experiment:', error);
    return NextResponse.json(
      { message: 'Error updating experiment', error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete an experiment
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { message: 'Experiment ID is required' },
        { status: 400 }
      );
    }

    await connectDB();
    
    // Find and delete the experiment
    const result = await Experiment.findByIdAndDelete(id);
    
    if (!result) {
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Experiment deleted successfully'
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error deleting experiment:', error);
    return NextResponse.json(
      { message: 'Error deleting experiment', error: errorMessage },
      { status: 500 }
    );
  }
}