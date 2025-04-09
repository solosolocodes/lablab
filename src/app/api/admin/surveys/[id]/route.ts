import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Survey from '@/models/Survey';
import User from '@/models/User';
import SurveyResponse from '@/models/SurveyResponse';

/**
 * GET /api/admin/surveys/[id]
 * 
 * Retrieves a specific survey
 * Admin only endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the survey ID from the URL parameters
    const surveyId = params.id;
    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
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

    // Find the survey
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      survey 
    });

  } catch (error) {
    console.error('Error retrieving survey:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve survey' 
    }, { 
      status: 500 
    });
  }
}

/**
 * PUT /api/admin/surveys/[id]
 * 
 * Updates a survey
 * Admin only endpoint
 */
// Set max duration to allow longer execution time for this route
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the survey ID from the URL parameters
    const surveyId = params.id;
    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    console.log('Processing PUT request for survey:', surveyId);

    // Authenticate the user and check for admin role
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Connect to the database
    await dbConnect();
    console.log('Database connected successfully');

    // Parse the request body
    const body = await request.json();
    const { title, description, questions, status } = body;

    if (!title) {
      return NextResponse.json({ error: 'Survey title is required' }, { status: 400 });
    }

    // Simplified update operation
    console.log(`Updating survey ${surveyId} with ${questions?.length || 0} questions`);
    
    // Create a minimal update object
    const updateData = {
      title,
      description,
      // Keep questions structure minimal 
      questions: questions?.map((q: any) => ({
        id: q.id,
        text: q.text || 'Untitled Question',
        type: q.type || 'text',
        required: Boolean(q.required),
        options: q.options || [],
        order: Number(q.order) || 0
      })) || [],
    };
    
    // Add status if provided
    if (status) {
      updateData.status = status;
    }
    
    // Direct update without finding the document first
    const result = await Survey.updateOne(
      { _id: surveyId },
      updateData
    );
    
    console.log('Update result:', result);

    return NextResponse.json({ 
      success: true, 
      result: result
    });

  } catch (error) {
    console.error('Error updating survey:', error);
    return NextResponse.json({ 
      error: 'Failed to update survey' 
    }, { 
      status: 500 
    });
  }
}

/**
 * DELETE /api/admin/surveys/[id]
 * 
 * Deletes a survey
 * Admin only endpoint
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the survey ID from the URL parameters
    const surveyId = params.id;
    if (!surveyId) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
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

    // Check if the survey exists
    const survey = await Survey.findById(surveyId);
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    // Check if there are any responses linked to this survey
    const responseCount = await SurveyResponse.countDocuments({ stageId: surveyId });
    if (responseCount > 0) {
      // Don't delete, just archive
      await Survey.findByIdAndUpdate(surveyId, { status: 'archived' });
      
      return NextResponse.json({ 
        success: true, 
        message: 'Survey has responses and was archived instead of deleted'
      });
    }

    // Delete the survey if there are no responses
    await Survey.findByIdAndDelete(surveyId);

    return NextResponse.json({ 
      success: true, 
      message: 'Survey deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ 
      error: 'Failed to delete survey' 
    }, { 
      status: 500 
    });
  }
}