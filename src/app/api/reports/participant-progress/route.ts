import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import ParticipantProgress from '@/models/ParticipantProgress';
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
    
    // Date range filtering on last activity
    if (dateFrom || dateTo) {
      query.lastActivityAt = {};
      
      if (dateFrom) {
        query.lastActivityAt.$gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // Set time to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.lastActivityAt.$lte = endDate;
      }
    }
    
    // Fetch participant progress records
    const progressRecords = await ParticipantProgress.find(query)
      .sort({ lastActivityAt: -1 })
      .populate('userId', 'email name')
      .populate('experimentId', 'name')
      .lean();
    
    // Format response data
    const formattedProgressRecords = progressRecords.map(record => ({
      _id: record._id,
      userId: record.userId?._id || record.userId,
      participantName: record.userId?.name || 'Unknown',
      participantEmail: record.userId?.email || 'Unknown',
      experimentId: record.experimentId?._id || record.experimentId,
      experimentName: record.experimentId?.name || 'Unknown',
      status: record.status,
      currentStageId: record.currentStageId,
      completedStages: record.completedStages,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      lastActivityAt: record.lastActivityAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }));
    
    return NextResponse.json(formattedProgressRecords);
  } catch (error) {
    console.error('Error fetching participant progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participant progress' },
      { status: 500 }
    );
  }
}