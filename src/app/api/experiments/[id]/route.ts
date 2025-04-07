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
    {
      id: "stage2",
      type: "instructions",
      title: "Key Concepts",
      description: "Understanding the key financial concepts used in this experiment",
      durationSeconds: 120,
      required: true,
      order: 1,
      content: "## Key Financial Concepts\n\n### Risk and Return\nInvestments with higher potential returns typically come with higher risks. Lower-risk investments generally offer more modest returns.\n\n### Diversification\nSpreading investments across different asset types to reduce risk.\n\n### Market Volatility\nThe rate at which prices rise or fall in a particular market.\n\n### Time Horizon\nThe length of time you expect to hold an investment before needing the money.\n\nThese concepts will be important as you navigate the scenarios in this experiment.",
      format: "markdown"
    },
    {
      id: "stage3",
      type: "scenario",
      title: "Market Scenario",
      description: "A simulated market environment for financial decision making",
      durationSeconds: 300,
      required: true,
      order: 2,
      scenarioId: "market-sim-1",
      rounds: 3,
      roundDuration: 60
    },
    {
      id: "stage4",
      type: "break",
      title: "Short Break",
      description: "Take a moment to reset before the next activity",
      durationSeconds: 30,
      required: false,
      order: 3,
      message: "You've completed the market scenario. Take a short break before continuing to the survey section."
    },
    {
      id: "stage5",
      type: "survey",
      title: "Decision Evaluation",
      description: "Please answer the following questions about your experience",
      durationSeconds: 180,
      required: true,
      order: 4,
      questions: [
        {
          id: "q1",
          text: "How confident were you in your investment decisions?",
          type: "rating",
          required: true
        },
        {
          id: "q2",
          text: "What factors influenced your decision-making the most?",
          type: "text",
          required: true
        },
        {
          id: "q3",
          text: "Which investment strategy did you primarily use?",
          type: "multipleChoice",
          options: ["Conservative/low-risk", "Balanced/moderate-risk", "Aggressive/high-risk", "Adaptive/changing"],
          required: true
        },
        {
          id: "q4",
          text: "What additional information would have helped you make better decisions?",
          type: "text",
          required: false
        }
      ]
    },
    {
      id: "stage6",
      type: "instructions",
      title: "Conclusion",
      description: "Thank you for participating",
      durationSeconds: 30,
      required: true,
      order: 5,
      content: "## Thank You for Participating\n\nYour participation in this experiment is greatly appreciated. The data collected will help us better understand financial decision-making processes.\n\n### What Happens Next\n\nThe results of this study will be anonymized and analyzed. If you indicated interest in receiving the results, we will contact you when the analysis is complete.\n\n### Contact Information\n\nIf you have any questions about this study, please contact the research team at research@example.com.\n\nThank you again for your valuable contribution to this research.",
      format: "markdown"
    }
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
    
    // Check if the request is for preview mode
    const isPreviewMode = request.nextUrl.searchParams.has('preview');
    console.log(`API: Preview mode: ${isPreviewMode}`);
    
    // For preview mode, try to get real data first, fallback to mock
    if (isPreviewMode) {
      try {
        console.log('API: Connecting to database for preview mode...');
        await connectDB();
        
        // Find the experiment
        const experiment = await Experiment.findById(experimentId)
          .populate('userGroups.userGroupId', 'name description')
          .populate('createdBy', 'name email');
        
        if (experiment) {
          console.log(`API: Found real experiment: "${experiment.name}" for preview`);
          
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
          
          console.log('API: Returning real experiment data for preview');
          return NextResponse.json(formattedExperiment);
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
    await connectDB();
    
    // Find the experiment
    const experiment = await Experiment.findById(experimentId)
      .populate('userGroups.userGroupId', 'name description')
      .populate('createdBy', 'name email');
    
    if (!experiment) {
      console.log(`API: Experiment with ID ${experimentId} not found`);
      return NextResponse.json(
        { message: 'Experiment not found' },
        { status: 404 }
      );
    }
    
    console.log(`API: Found experiment: "${experiment.name}", stages: ${experiment.stages?.length || 0}`);
    
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
    
    console.log('API: Successfully formatted experiment response, returning data');
    return NextResponse.json(formattedExperiment);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('API: Error fetching experiment:', error);
    console.error('API: Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // For preview mode, return mock data even on error
    if (request.nextUrl.searchParams.has('preview')) {
      console.log('API: Error occurred but returning mock data for preview mode');
      return NextResponse.json(mockExperimentData);
    }
    
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
      }
      
      // Use already imported mongoose
      // Log userGroups for debugging
      console.log('Processing userGroups:', JSON.stringify(userGroups, null, 2));
      
      // Process user groups - no max participants needed
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
          condition: group.condition
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
          // Handle required scenarioId - must be present for scenario stages
          try {
            // If scenarioId is missing or empty, log a warning but don't add scenarioId
            // This will cause a validation error but won't return null from the route handler
            if (!stage.scenarioId) {
              console.warn(`Scenario stage missing required scenarioId: ${stage.id}`);
              stageData._validationError = true; // Mark as invalid for later filtering
            } else {
              stageData.scenarioId = stage.scenarioId;
            }
          } catch (err) {
            console.error('Error processing scenarioId:', err);
            stageData._validationError = true; // Mark as invalid for later filtering
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
        
        // Skip stages with validation errors
        if (!stageData._validationError) {
          // Delete the validation flag property before adding to MongoDB
          if (stageData._validationError !== undefined) {
            delete stageData._validationError;
          }
          experiment.stages.push(stageData);
        } else {
          // Log skipped stage for debugging
          console.log(`Skipping invalid stage: ${stage.id} (${stage.type})`);
        }
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