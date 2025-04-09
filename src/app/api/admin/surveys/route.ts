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

    // Parse the request body
    const body = await request.json();
    const { title, description, questions = [] } = body;

    if (!title) {
      return NextResponse.json({ error: 'Survey title is required' }, { status: 400 });
    }

    // Create the survey
    const survey = await Survey.create({
      title,
      description,
      questions,
      createdBy: session.user.id,
      status: 'draft',
      responsesCount: 0
    });

    return NextResponse.json({ 
      success: true, 
      survey 
    }, { 
      status: 201 
    });

  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json({ 
      error: 'Failed to create survey' 
    }, { 
      status: 500 
    });
  }
}