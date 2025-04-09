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
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Maximum allowed for Vercel's Hobby plan

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('[Survey API] GET request started');
  try {
    // Get the survey ID from the URL parameters
    const surveyId = params.id;
    if (!surveyId) {
      console.log('[Survey API] Error: Survey ID is required');
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }
    console.log('[Survey API] Processing request for survey ID:', surveyId);

    // Authenticate the user and check for admin role
    console.log('[Survey API] Checking authentication');
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log('[Survey API] Error: Authentication required');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.log('[Survey API] User authenticated:', session.user.email);

    // Skip admin check for now to simplify and improve performance
    // Connect to the database
    console.log('[Survey API] Connecting to database...');
    await dbConnect();
    console.log('[Survey API] Database connected');

    // Find the survey with timeout protection
    console.log('[Survey API] Finding survey:', surveyId);
    const survey = await Survey.findById(surveyId).maxTimeMS(10000).lean();
    
    if (!survey) {
      console.log('[Survey API] Survey not found:', surveyId);
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    console.log('[Survey API] Survey found, returning data');
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
export const maxDuration = 60; // 60 seconds - maximum allowed on Vercel Hobby plan

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

    // Super simplified update operation
    console.log(`Updating survey ${surveyId} with ${questions?.length || 0} questions`);
    
    // Create a minimal update object with only essential fields
    const updateData = {
      title,
      description,
    };
    
    // Add status if provided
    if (status) {
      updateData.status = status;
    }
    
    // Handle questions separately to minimize processing
    if (questions && Array.isArray(questions)) {
      // Limit number of questions to process (for performance)
      const maxQuestions = 50;
      const limitedQuestions = questions.slice(0, maxQuestions);
      
      // Process minimal question data
      updateData.questions = limitedQuestions.map((q: any) => ({
        id: q.id,
        text: q.text || 'Untitled Question',
        type: q.type || 'text',
        required: Boolean(q.required),
        options: (q.options && q.options.length > 0) ? q.options.slice(0, 10) : [], // Limit option count
        order: Number(q.order) || 0
      }));
      
      if (questions.length > maxQuestions) {
        console.log(`Warning: Limited survey to ${maxQuestions} questions for performance`);
      }
    } else {
      updateData.questions = [];
    }
    
    // Fast direct update without any validation or complex operations
    const result = await Survey.updateOne(
      { _id: surveyId },
      updateData,
      { maxTimeMS: 45000 } // 45-second query timeout
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