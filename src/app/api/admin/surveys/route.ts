import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/dbConnect';
import Survey from '@/models/Survey';
import User from '@/models/User';

/**
 * GET /api/admin/surveys
 * 
 * Retrieves all surveys
 * Admin only endpoint
 */
export async function GET(request: NextRequest) {
  try {
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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    
    // Build query
    const query: any = {};
    if (status && ['draft', 'published', 'archived'].includes(status)) {
      query.status = status;
    }

    // Fetch surveys
    const surveys = await Survey.find(query)
      .sort({ updatedAt: -1 }) // Most recently updated first
      .select('title description status questions createdAt updatedAt responsesCount')
      .lean();

    return NextResponse.json({ 
      success: true, 
      surveys 
    });

  } catch (error) {
    console.error('Error retrieving surveys:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve surveys' 
    }, { 
      status: 500 
    });
  }
}

/**
 * POST /api/admin/surveys
 * 
 * Creates a new survey
 * Admin only endpoint
 */
export async function POST(request: NextRequest) {
  console.log('[Survey API] POST request to create new survey started');
  try {
    // Authenticate the user and check for admin role
    console.log('[Survey API] Checking authentication');
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      console.log('[Survey API] Authentication failed: No session');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    console.log('[Survey API] Session found:', session.user.email);

    // Connect to the database first
    console.log('[Survey API] Connecting to database');
    await dbConnect();
    console.log('[Survey API] Database connected');
    
    // Get the user and check if they're an admin
    console.log('[Survey API] Checking admin status for user ID:', session.user.id);
    
    let user;
    try {
      user = await User.findById(session.user.id);
    } catch (userFindError) {
      console.error('[Survey API] Error finding user:', userFindError);
      // Try once more with session user directly
      user = { 
        _id: session.user.id, 
        role: session.user.role 
      };
      console.log('[Survey API] Using session user data as fallback:', user);
    }
    
    if (!user) {
      console.log('[Survey API] User not found in database:', session.user.id);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    console.log('[Survey API] User found, role:', user.role);
    
    if (user.role !== 'admin') {
      console.log('[Survey API] Access denied: User is not an admin');
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    console.log('[Survey API] Admin access confirmed');

    // Parse the request body
    console.log('[Survey API] Parsing request body');
    const body = await request.json();
    const { title, description, questions = [] } = body;
    console.log('[Survey API] Request body parsed:', { title, description, questionsCount: questions.length });

    if (!title) {
      console.log('[Survey API] Validation failed: Title is required');
      return NextResponse.json({ error: 'Survey title is required' }, { status: 400 });
    }

    // Create the survey with error handling
    console.log('[Survey API] Creating new survey');
    const surveyData = {
      title,
      description,
      questions: Array.isArray(questions) ? questions : [],
      createdBy: session.user.id,
      status: 'draft',
      responsesCount: 0
    };
    
    console.log('[Survey API] Survey data to be saved:', surveyData);
    
    try {
      // Make sure Survey model is properly imported and available
      if (!Survey || typeof Survey.create !== 'function') {
        console.error('[Survey API] Survey model not available or invalid');
        throw new Error('Survey model not properly initialized');
      }
      
      // Try to create the survey with a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Survey creation timed out')), 15000)
      );
      
      const createPromise = Survey.create(surveyData);
      
      // Race between creation and timeout
      const survey = await Promise.race([createPromise, timeoutPromise]);
      console.log('[Survey API] Survey created successfully with ID:', survey._id);
      
      // Convert any Mongoose document to plain object for serialization
      const plainSurvey = survey.toObject ? survey.toObject() : JSON.parse(JSON.stringify(survey));
      
      return NextResponse.json({ 
        success: true, 
        survey: plainSurvey
      }, { 
        status: 201 
      });
    } catch (dbError) {
      console.error('[Survey API] Database error creating survey:', dbError);
      
      // Try a fallback approach with direct document creation
      try {
        console.log('[Survey API] Attempting fallback survey creation');
        const newSurvey = new Survey(surveyData);
        const savedSurvey = await newSurvey.save();
        console.log('[Survey API] Survey created with fallback method, ID:', savedSurvey._id);
        
        const plainSurvey = savedSurvey.toObject ? savedSurvey.toObject() : JSON.parse(JSON.stringify(savedSurvey));
        
        return NextResponse.json({ 
          success: true, 
          survey: plainSurvey
        }, { 
          status: 201 
        });
      } catch (fallbackError) {
        console.error('[Survey API] Fallback survey creation also failed:', fallbackError);
        
        // Return meaningful error
        return NextResponse.json({ 
          error: 'Database error creating survey',
          details: dbError.message,
          fallbackError: fallbackError.message
        }, { 
          status: 500 
        });
      }
    }

  } catch (error) {
    console.error('[Survey API] Error creating survey:', error);
    return NextResponse.json({ 
      error: 'Failed to create survey',
      details: error.message
    }, { 
      status: 500 
    });
  }
}