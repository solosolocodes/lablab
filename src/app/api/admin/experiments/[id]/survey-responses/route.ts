import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import SurveyResponse from '@/models/SurveyResponse';
import User from '@/models/User';

/**
 * GET /api/admin/experiments/[id]/survey-responses
 * 
 * Retrieves all survey responses for an experiment
 * Admin only endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the experiment ID from the URL parameters
    const experimentId = params.id;
    if (!experimentId) {
      return NextResponse.json({ error: 'Experiment ID is required' }, { status: 400 });
    }

    // Authenticate the user and check for admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get the user and check if they're an admin
    const user = await User.findById(session.user.id);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Optional filter by stageId
    const url = new URL(request.url);
    const stageId = url.searchParams.get('stageId');
    
    // Connect to the database
    await dbConnect();

    // Build the query
    const query: any = { experimentId };
    if (stageId) {
      query.stageId = stageId;
    }

    // Find all survey responses for the experiment
    const responses = await SurveyResponse.find(query)
      .populate('userId', 'name email') // Include user details
      .sort({ submittedAt: -1 }); // Most recent first

    return NextResponse.json({ 
      success: true, 
      responses
    });

  } catch (error) {
    console.error('Error retrieving survey responses:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve survey responses' 
    }, { 
      status: 500 
    });
  }
}

/**
 * GET /api/admin/experiments/[id]/survey-responses/export
 * 
 * Exports all survey responses for an experiment as CSV
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the experiment ID from the URL parameters
    const experimentId = params.id;
    if (!experimentId) {
      return NextResponse.json({ error: 'Experiment ID is required' }, { status: 400 });
    }

    // Authenticate the user and check for admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get the user and check if they're an admin
    const user = await User.findById(session.user.id);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Connect to the database
    await dbConnect();

    // Find all survey responses for the experiment
    const responses = await SurveyResponse.find({ experimentId })
      .populate('userId', 'name email')
      .sort({ submittedAt: -1 });

    // Format response data
    const formattedResponses = responses.map(response => {
      // Convert the responses Map to a flat object
      const flatResponses: Record<string, any> = {};
      if (response.responses) {
        Object.entries(response.responses.toJSON()).forEach(([key, value]) => {
          // Format arrays as comma-separated strings
          if (Array.isArray(value)) {
            flatResponses[`question_${key}`] = value.join(', ');
          } else {
            flatResponses[`question_${key}`] = value;
          }
        });
      }

      // Return formatted response
      return {
        responseId: response._id,
        stageId: response.stageId,
        participantId: response.userId?._id || response.userId,
        participantName: response.userId?.name || 'Unknown',
        participantEmail: response.userId?.email || 'Unknown',
        submittedAt: response.submittedAt.toISOString(),
        ...flatResponses
      };
    });

    // Get all unique question IDs
    const allQuestionIds = new Set<string>();
    formattedResponses.forEach(response => {
      Object.keys(response).forEach(key => {
        if (key.startsWith('question_')) {
          allQuestionIds.add(key);
        }
      });
    });

    // Return the formatted responses
    return NextResponse.json({ 
      success: true, 
      responses: formattedResponses,
      questionIds: Array.from(allQuestionIds)
    });

  } catch (error) {
    console.error('Error exporting survey responses:', error);
    return NextResponse.json({ 
      error: 'Failed to export survey responses' 
    }, { 
      status: 500 
    });
  }
}