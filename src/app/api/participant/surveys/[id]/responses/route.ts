import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import SurveyResponse from '@/models/SurveyResponse';

/**
 * POST /api/participant/surveys/[id]/responses
 * 
 * Saves a survey response for a participant
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the stage ID from the URL parameters
    const stageId = params.id;
    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
    }

    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();
    const { experimentId, answers } = body;

    if (!experimentId) {
      return NextResponse.json({ error: 'Experiment ID is required' }, { status: 400 });
    }

    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Survey answers are required' }, { status: 400 });
    }

    // Connect to the database
    await dbConnect();

    // Create or update the survey response
    const response = await SurveyResponse.findOneAndUpdate(
      {
        experimentId,
        stageId,
        userId: session.user.id
      },
      {
        experimentId,
        stageId,
        userId: session.user.id,
        responses: answers,
        submittedAt: new Date()
      },
      {
        new: true,
        upsert: true // Create if doesn't exist
      }
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Survey response saved successfully',
      response
    });

  } catch (error) {
    console.error('Error saving survey response:', error);
    return NextResponse.json({ 
      error: 'Failed to save survey response' 
    }, { 
      status: 500 
    });
  }
}

/**
 * GET /api/participant/surveys/[id]/responses
 * 
 * Retrieves a participant's survey response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the stage ID from the URL parameters
    const stageId = params.id;
    if (!stageId) {
      return NextResponse.json({ error: 'Stage ID is required' }, { status: 400 });
    }

    // Authenticate the user
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get experimentId from query param
    const url = new URL(request.url);
    const experimentId = url.searchParams.get('experimentId');
    if (!experimentId) {
      return NextResponse.json({ error: 'Experiment ID is required' }, { status: 400 });
    }

    // Connect to the database
    await dbConnect();

    // Find the survey response
    const response = await SurveyResponse.findOne({
      experimentId,
      stageId,
      userId: session.user.id
    });

    if (!response) {
      return NextResponse.json({ 
        success: false, 
        message: 'No response found' 
      }, { 
        status: 404 
      });
    }

    return NextResponse.json({ 
      success: true, 
      response 
    });

  } catch (error) {
    console.error('Error retrieving survey response:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve survey response' 
    }, { 
      status: 500 
    });
  }
}