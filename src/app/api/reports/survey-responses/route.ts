import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import SurveyResponse from '@/models/SurveyResponse';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Check authentication and role
    if (!session || session.user.role !== 'researcher') {
      return NextResponse.json(
        { error: 'You must be logged in as a researcher to access this endpoint' },
        { status: 401 }
      );
    }
    
    await dbConnect();
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const experimentId = searchParams.get('experimentId');
    const participantId = searchParams.get('participantId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Build query
    const query: any = {};
    
    if (experimentId) {
      query.experimentId = experimentId;
    }
    
    if (participantId) {
      query.userId = participantId;
    }
    
    // Date range filtering
    if (dateFrom || dateTo) {
      query.submittedAt = {};
      
      if (dateFrom) {
        query.submittedAt.$gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // Set time to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.submittedAt.$lte = endDate;
      }
    }
    
    // Fetch survey responses
    const responses = await SurveyResponse.find(query)
      .sort({ submittedAt: -1 })
      .populate('userId', 'email name')
      .populate('experimentId', 'name')
      .lean();
    
    // Format response data
    const formattedResponses = responses.map(response => ({
      _id: response._id,
      userId: response.userId?._id || response.userId,
      participantName: response.userId?.name || 'Unknown',
      participantEmail: response.userId?.email || 'Unknown',
      experimentId: response.experimentId?._id || response.experimentId,
      experimentName: response.experimentId?.name || 'Unknown',
      stageId: response.stageId,
      responses: response.responses,
      submittedAt: response.submittedAt,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt
    }));
    
    return NextResponse.json(formattedResponses);
  } catch (error) {
    console.error('Error fetching survey responses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch survey responses' },
      { status: 500 }
    );
  }
}