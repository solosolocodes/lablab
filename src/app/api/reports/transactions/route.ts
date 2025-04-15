import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Transaction from '@/models/Transaction';
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
      query.timestamp = {};
      
      if (dateFrom) {
        query.timestamp.$gte = new Date(dateFrom);
      }
      
      if (dateTo) {
        // Set time to end of day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.timestamp.$lte = endDate;
      }
    }
    
    // Fetch transactions
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .populate('userId', 'email name')
      .populate('experimentId', 'name')
      .lean();
    
    // Format response data
    const formattedTransactions = transactions.map(transaction => ({
      _id: transaction._id,
      userId: transaction.userId?._id || transaction.userId,
      participantName: transaction.userId?.name || 'Unknown',
      participantEmail: transaction.userId?.email || 'Unknown',
      experimentId: transaction.experimentId?._id || transaction.experimentId,
      experimentName: transaction.experimentId?.name || 'Unknown',
      assetId: transaction.assetId,
      symbol: transaction.symbol,
      type: transaction.type,
      quantity: transaction.quantity,
      price: transaction.price,
      totalValue: transaction.totalValue,
      roundNumber: transaction.roundNumber,
      timestamp: transaction.timestamp,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    }));
    
    return NextResponse.json(formattedTransactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}