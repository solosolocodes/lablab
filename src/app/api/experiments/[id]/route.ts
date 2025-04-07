'use client';

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

// Mock data for preview mode
const mockExperimentData = {
  id: "mockExperimentId",
  name: "Financial Decision Making",
  description: "An experiment to study financial decision making under various conditions",
  status: "draft",
  createdBy: {
    id: "mockUserId",
    name: "Test User",
    email: "test@example.com"
  },
  userGroups: [],
  stages: [
    {
      id: "stage1",
      type: "instructions",
      title: "Introduction",
      description: "Welcome to the financial decision-making experiment",
      durationSeconds: 60,
      required: true,
      order: 0,
      content: "## Welcome to our Financial Decision-Making Study\n\nThank you for participating in this experiment. Your time and feedback are valuable to our research.\n\n### Purpose\n\nThis study aims to understand how people make financial decisions in different scenarios.\n\n### What to Expect\n\nThis experiment consists of multiple stages:\n\n1. Instructions (you are here)\n2. A market scenario simulation\n3. A decision-making exercise\n4. A feedback survey\n\nPlease read all instructions carefully and take your time with each stage.",
      format: "markdown"
    },
    // Additional mock stages omitted for brevity
  ],
  branches: [],
  startStageId: "stage1",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastEditedAt: new Date().toISOString()
};

// Get a specific experiment by ID
export async function GET(request: NextRequest) {
  try {
    console.log(`API: GET experiment request received for ${request.nextUrl.pathname}`);
    
    // Get experiment ID
    const experimentId = getExperimentId(request);
    console.log(`API: Experiment ID: ${experimentId}`);
    
    // Validate the experiment ID format
    if (!experimentId || experimentId === '[id]') {
      console.error('API: Invalid experiment ID format:', experimentId);
      return NextResponse.json(
        { message: 'Invalid experiment ID' },
        { status: 400 }
      );
    }
    
    // Log the experiment ID to help with debugging
    console.log('API: Analyzing experiment ID:', {
      experimentId, 
      length: experimentId.length,
      containsChars: /[a-zA-Z0-9]/.test(experimentId),
      firstChar: experimentId.charAt(0),
      lastChar: experimentId.charAt(experimentId.length - 1)
    });
    
    // Try to validate if it's a valid MongoDB ObjectId
    try {
      const mongoose = (await import('mongoose')).default;
      if (!mongoose.Types.ObjectId.isValid(experimentId)) {
        console.error('API: Invalid MongoDB ObjectId format:', experimentId);
        // Instead of returning error, we'll let it continue and try to find by friendly ID
        console.log('API: Continuing anyway to try finding experiment by non-ObjectId format');
      } else {
        console.log('API: Experiment ID appears to be a valid ObjectId format');
      }
    } catch (err) {
      console.error('API: Error validating ObjectId:', err);
      // Continue anyway, as this is just an extra validation
    }
    
    // Check if the request is for preview mode
    const isPreviewMode = request.nextUrl.searchParams.has('preview');
    console.log(`API: Preview mode: ${isPreviewMode}`);
    
    // For preview mode, try to get real data first, fallback to mock
    if (isPreviewMode) {
      try {
        console.log('API: Connecting to database for preview mode...');
        await connectDB();
        
        // Find the experiment
        let experiment;
        try {
          experiment = await Experiment.findById(experimentId)
            .populate('userGroups.userGroupId', 'name description')
            .populate('createdBy', 'name email');
          
          if (experiment) {
            console.log(`API: Found real experiment: "${experiment.name}" for preview`);
          } else {
            console.log(`API: No experiment found with ID ${experimentId} for preview`);
            throw new Error('Experiment not found');
          }
        } catch (mongoError) {
          console.error('API: MongoDB error finding experiment:', mongoError);
          throw mongoError;
        }
        
        if (experiment) {
          console.log(`API: Processing found experiment for preview`);
          
          try {
            // Simple direct response for preview mode
            const directResponse = {
              id: experiment._id.toString(),
              name: experiment.name || 'Untitled Experiment',
              description: experiment.description || '',
              status: experiment.status || 'draft',
              createdBy: experiment.createdBy ? {
                id: experiment.createdBy._id || 'unknown',
                name: experiment.createdBy.name || 'Unknown',
                email: experiment.createdBy.email || 'unknown@example.com'
              } : { id: 'unknown', name: 'Unknown', email: 'unknown@example.com' },
              userGroups: Array.isArray(experiment.userGroups) 
                ? experiment.userGroups.map(ug => {
                    try {
                      return {
                        userGroupId: ug.userGroupId ? (
                          typeof ug.userGroupId === 'object' && ug.userGroupId._id 
                            ? ug.userGroupId._id.toString() 
                            : ug.userGroupId.toString()
                        ) : 'unknown',
                        condition: ug.condition || 'default'
                      };
                    } catch (error) {
                      console.error('Error processing userGroup in preview mode:', error);
                      return { userGroupId: 'error', condition: 'error' };
                    }
                  })
                : [],
              stages: [],
              branches: [],
              startStageId: experiment.startStageId || null,
              createdAt: experiment.createdAt || new Date().toISOString(),
              updatedAt: experiment.updatedAt || new Date().toISOString(),
              lastEditedAt: experiment.lastEditedAt || new Date().toISOString()
            };
            
            return NextResponse.json(directResponse);
          } catch (formattingError) {
            console.error('API: Error formatting experiment for preview:', formattingError);
            throw formattingError;
          }
        }
      } catch (dbError) {
        console.error('API: Error fetching real experiment data:', dbError);
        console.log('API: Falling back to mock data for preview mode');
      }
      
      // If we got here, either no experiment was found or there was an error
      console.log('API: Returning mock data for preview mode');
      return NextResponse.json(mockExperimentData);
    }
    
    // Non-preview mode - regular admin access flow
    const session = await getServerSession(authOptions);
    
    // Check authentication for non-preview requests
    if (!session || session.user.role !== 'admin') {
      console.log('API: Unauthorized access attempt');
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log('API: Connecting to database...');
    try {
      await connectDB();
      console.log('API: Database connection successful');
      
      // Test database connection by running a simple query
      const mongoose = (await import('mongoose')).default;
      const connectionState = mongoose.connection.readyState;
      console.log('API: MongoDB connection state:', {
        state: connectionState,
        // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
        stateDesc: ['disconnected', 'connected', 'connecting', 'disconnecting'][connectionState] || 'unknown',
        host: mongoose.connection.host,
        name: mongoose.connection.name
      });
      
      if (connectionState !== 1) {
        throw new Error(`MongoDB connection not ready. State: ${connectionState}`);
      }
    } catch (dbConnectError) {
      console.error('API: Critical database connection error:', dbConnectError);
      return NextResponse.json(
        { 
          message: 'Database connection error', 
          error: dbConnectError instanceof Error ? dbConnectError.message : String(dbConnectError),
          details: 'Failed to establish connection to MongoDB. Please check database configuration.'
        },
        { status: 500 }
      );
    }
    
    // Find the experiment
    let experiment;
    try {
      // Try to find the experiment by ID first
      console.log(`API: Attempting to find experiment by ID: ${experimentId}`);
      
      // First, check if any experiments exist in the collection
      try {
        const totalExperiments = await Experiment.countDocuments();
        console.log(`API: Total experiments in database: ${totalExperiments}`);
        
        if (totalExperiments === 0) {
          return NextResponse.json(
            { message: 'No experiments exist in the database' },
            { status: 404 }
          );
        }
      } catch (countError) {
        console.error('API: Error counting experiments:', countError);
      }
      
      // Fetch the experiment directly
      experiment = await Experiment.findById(experimentId)
        .populate('userGroups.userGroupId', 'name description')
        .populate('createdBy', 'name email');
      
      // Log raw document structure to help with debugging
      if (experiment) {
        console.log('API: Raw experiment document structure:', {
          id: experiment._id ? experiment._id.toString() : 'undefined',
          hasId: Boolean(experiment._id),
          hasUserGroups: Boolean(experiment.userGroups),
          userGroupsIsArray: Array.isArray(experiment.userGroups),
          rawDocument: JSON.stringify(experiment.toObject ? experiment.toObject() : experiment)
        });
      }
      
      if (!experiment) {
        console.log(`API: Experiment with ID ${experimentId} not found via findById, trying alternative queries`);
        
        // Try to find by string field if it's not a valid ObjectId
        try {
          console.log(`API: Trying to query experiments collection directly`);
          // Print the first few experiments to see their structure
          const firstFewExperiments = await Experiment.find().limit(3);
          if (firstFewExperiments.length > 0) {
            console.log('API: First few experiments in database:', 
              firstFewExperiments.map(exp => ({ 
                id: exp._id ? exp._id.toString() : 'unknown', 
                name: exp.name || 'unnamed',
                hasUserGroups: Boolean(exp.userGroups) && Array.isArray(exp.userGroups)
              }))
            );
          } else {
            console.log('API: No experiments found in database');
          }
          
          // Return not found
          return NextResponse.json(
            { 
              message: 'Experiment not found', 
              details: 'The experiment ID provided does not match any records in the database'
            },
            { status: 404 }
          );
        } catch (queryError) {
          console.error('API: Error during alternative experiment queries:', queryError);
          return NextResponse.json(
            { 
              message: 'Error querying experiments', 
              error: queryError instanceof Error ? queryError.message : String(queryError)
            },
            { status: 500 }
          );
        }
      }
    } catch (dbError) {
      console.error(`API: Error finding experiment with ID ${experimentId}:`, dbError);
      return NextResponse.json(
        { 
          message: 'Database error while finding experiment', 
          error: dbError instanceof Error ? dbError.message : String(dbError),
          details: 'There was an error querying the database. The experiment ID may be invalid or the database connection may have issues.'
        },
        { status: 500 }
      );
    }
    
    console.log(`API: Found experiment: "${experiment.name}", stages: ${experiment.stages?.length || 0}`);
    
    try {
      // Create a simplified response object based on the MongoDB document structure
      const response = {
        id: experiment._id.toString(),
        name: experiment.name || 'Untitled Experiment',
        description: experiment.description || '',
        status: experiment.status || 'draft',
        createdBy: experiment.createdBy 
          ? {
              id: experiment.createdBy._id?.toString() || 'unknown',
              name: experiment.createdBy.name || 'Unknown',
              email: experiment.createdBy.email || 'unknown@example.com'
            }
          : { id: 'unknown', name: 'Unknown', email: 'unknown@example.com' },
        userGroups: [],
        stages: [],
        branches: [],
        startStageId: experiment.startStageId || null,
        createdAt: experiment.createdAt instanceof Date ? experiment.createdAt.toISOString() : experiment.createdAt || new Date().toISOString(),
        updatedAt: experiment.updatedAt instanceof Date ? experiment.updatedAt.toISOString() : experiment.updatedAt || new Date().toISOString(),
        lastEditedAt: experiment.lastEditedAt instanceof Date ? experiment.lastEditedAt.toISOString() : experiment.lastEditedAt || new Date().toISOString(),
      };
      
      // Process user groups safely
      if (experiment.userGroups && Array.isArray(experiment.userGroups)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.userGroups = experiment.userGroups.map((ug: any) => {
          try {
            const userGroupId = typeof ug.userGroupId === 'object' && ug.userGroupId && ug.userGroupId._id 
              ? ug.userGroupId._id.toString() 
              : (ug.userGroupId ? ug.userGroupId.toString() : 'unknown');
              
            return {
              userGroupId,
              condition: ug.condition || 'default'
            };
          } catch (error) {
            console.error('API: Error processing user group:', error, ug);
            return { userGroupId: 'error', condition: 'error' };
          }
        });
      }
      
      // Process stages safely
      if (experiment.stages && Array.isArray(experiment.stages)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        response.stages = experiment.stages.map((stage: any) => {
          try {
            const baseStage = {
              id: stage._id ? stage._id.toString() : 'unknown',
              type: stage.type || 'unknown',
              title: stage.title || 'Untitled Stage',
              description: stage.description || '',
              durationSeconds: typeof stage.durationSeconds === 'number' ? stage.durationSeconds : 0,
              required: typeof stage.required === 'boolean' ? stage.required : true,
              order: typeof stage.order === 'number' ? stage.order : 0,
            };
            
            if (stage.type === 'instructions') {
              return {
                ...baseStage,
                content: stage.content || '',
                format: stage.format || 'text'
              };
            } else if (stage.type === 'scenario') {
              return {
                ...baseStage,
                scenarioId: stage.scenarioId || '',
                rounds: stage.rounds || 1,
                roundDuration: stage.roundDuration || 60
              };
            } else if (stage.type === 'survey') {
              return {
                ...baseStage,
                questions: Array.isArray(stage.questions) ? stage.questions : []
              };
            } else if (stage.type === 'break') {
              return {
                ...baseStage,
                message: stage.message || 'Take a break'
              };
            }
            
            return baseStage;
          } catch (error) {
            console.error('API: Error processing stage:', error, stage);
            return {
              id: 'error',
              type: 'unknown',
              title: 'Error Stage',
              description: 'Error processing this stage',
              durationSeconds: 0,
              required: false,
              order: 0
            };
          }
        });
      }
      
      // Process branches safely
      if (experiment.branches && Array.isArray(experiment.branches)) {
        response.branches = experiment.branches;
      }
      
      // Log the response structure before sending
      console.log('API: Response structure check:', {
        hasId: Boolean(response.id),
        hasUserGroups: Boolean(response.userGroups) && Array.isArray(response.userGroups),
        hasStages: Boolean(response.stages) && Array.isArray(response.stages),
        userGroupsCount: Array.isArray(response.userGroups) ? response.userGroups.length : 0,
        stagesCount: Array.isArray(response.stages) ? response.stages.length : 0
      });
      
      console.log('API: Successfully formatted response, returning data');
      return NextResponse.json(response);
    } catch (formattingError) {
      console.error('API: Error during response formatting:', formattingError);
      return NextResponse.json(
        { 
          message: 'Error formatting experiment data', 
          error: formattingError instanceof Error ? formattingError.message : String(formattingError)
        },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('API: Error fetching experiment:', error);
    console.error('API: Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // For preview mode, return mock data even on error
    if (request.nextUrl.searchParams.has('preview')) {
      console.log('API: Error occurred but returning mock data for preview mode');
      return NextResponse.json(mockExperimentData);
    }
    
    try {
      // Ensure we return a valid JSON response even in case of errors
      console.log('API: Returning error response in standard JSON format');
      
      return NextResponse.json(
        { 
          message: 'Error fetching experiment', 
          error: errorMessage,
          timestamp: new Date().toISOString(),
          path: request.nextUrl.pathname,
          status: 500
        },
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (responseError) {
      // Last resort fallback if even creating the error response fails
      console.error('API: Critical error creating error response:', responseError);
      
      return new NextResponse(
        JSON.stringify({ 
          message: 'Critical error in API', 
          error: 'Failed to process request'
        }),
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
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
      // Log userGroups for debugging
      console.log('Processing userGroups:', JSON.stringify(userGroups, null, 2));
      
      // Process user groups - no max participants needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      experiment.userGroups = userGroups.map((group: any) => {
        // Simple userGroup format with just ID and condition
        return {
          userGroupId: group.userGroupId,
          condition: group.condition
        };
      });
    }
    
    // Handle stages - need to ensure all required fields are present based on type
    if (stages) {
      experiment.stages = [];
      
      // Process each stage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const stage of stages as any[]) {
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
          // Handle required scenarioId
          if (!stage.scenarioId) {
            console.warn(`Scenario stage missing required scenarioId: ${stage.id}`);
            stageData._validationError = true; // Mark as invalid for later filtering
          } else {
            stageData.scenarioId = stage.scenarioId;
          }
          
          stageData.rounds = stage.rounds ? Number(stage.rounds) : 1;
          stageData.roundDuration = stage.roundDuration ? Number(stage.roundDuration) : 60;
        }
        else if (stage.type === 'survey') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          stageData.questions = (stage.questions || []).map((q: any) => ({
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
        
        // Skip stages with validation errors
        if (!stageData._validationError) {
          // Delete the validation flag property before adding to MongoDB
          if (stageData._validationError !== undefined) {
            delete stageData._validationError;
          }
          experiment.stages.push(stageData);
        }
      }
    }
    
    if (branches) experiment.branches = branches;
    if (startStageId) experiment.startStageId = startStageId;
    
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