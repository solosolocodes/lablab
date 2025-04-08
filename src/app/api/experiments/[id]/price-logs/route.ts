import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/dbConnect';
import PriceLog from '@/models/PriceLog';
import Experiment from '@/models/Experiment';
import User from '@/models/User';
import mongoose from 'mongoose';

// POST /api/experiments/:id/price-logs - Log price changes for a round
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Connect to the database
    await dbConnect();

    // Validate experiment ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: 'Invalid experiment ID' }, { status: 400 });
    }

    // Check if experiment exists
    const experiment = await Experiment.findById(params.id);
    if (!experiment) {
      return NextResponse.json({ message: 'Experiment not found' }, { status: 404 });
    }

    // Get user for tracking purposes
    const user = await User.findOne({ email: session.user.email });
    
    // For POST requests (logging price changes), we'll allow participant access
    // This is because price logging happens during the experiment
    // and should work for both admins and participants
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const data = await request.json();
    
    // Verify we have an array of price logs
    if (!Array.isArray(data.logs)) {
      return NextResponse.json({ 
        message: 'Invalid request format: Expected an array of price logs'
      }, { status: 400 });
    }
    
    // Create price log documents
    const priceLogs = data.logs.map((log: any) => ({
      experimentId: experiment._id,
      assetId: log.assetId,
      symbol: log.symbol,
      roundNumber: log.roundNumber,
      price: log.price,
      previousPrice: log.previousPrice || null,
      percentChange: log.percentChange || null,
      timestamp: log.timestamp || new Date()
    }));

    // Save price logs to database
    const result = await PriceLog.insertMany(priceLogs);

    return NextResponse.json({ 
      message: 'Price logs recorded successfully',
      count: result.length
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording price logs:', error);
    return NextResponse.json({ 
      message: 'Failed to record price logs',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/experiments/:id/price-logs - Get price logs for an experiment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Connect to the database
    await dbConnect();

    // Validate experiment ID
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: 'Invalid experiment ID' }, { status: 400 });
    }

    // Check if experiment exists
    const experiment = await Experiment.findById(params.id);
    if (!experiment) {
      return NextResponse.json({ message: 'Experiment not found' }, { status: 404 });
    }
    
    // Get user for access control
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    // For participants, verify they're part of the experiment
    if (user.role !== 'admin') {
      const isParticipant = experiment.participants.some(
        (p: any) => p.userId && p.userId.toString() === user._id.toString()
      );
      
      if (!isParticipant) {
        return NextResponse.json({ message: 'Access denied: Not a participant in this experiment' }, { status: 403 });
      }
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const roundNumber = searchParams.get('round');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const format = searchParams.get('format');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Build query
    const query: any = { experimentId: experiment._id };
    
    if (symbol) {
      query.symbol = symbol;
    }
    
    if (roundNumber && !isNaN(parseInt(roundNumber, 10))) {
      query.roundNumber = parseInt(roundNumber, 10);
    }
    
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        query.timestamp = { $gte: start };
      }
    }
    
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        query.timestamp = { ...query.timestamp, $lte: end };
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute query with pagination
    const priceLogs = await PriceLog.find(query)
      .sort({ roundNumber: 1, symbol: 1 })
      .skip(skip)
      .limit(limit);
    
    // Count total matching documents for pagination
    const totalCount = await PriceLog.countDocuments(query);
    
    // CSV format if requested
    if (format === 'csv') {
      // Create CSV header
      const csvHeader = 'experiment_id,asset_id,symbol,round_number,price,previous_price,percent_change,timestamp\n';
      
      // Map each record to CSV row
      const csvRows = priceLogs.map(log => {
        return [
          log.experimentId,
          log.assetId,
          log.symbol,
          log.roundNumber,
          log.price,
          log.previousPrice || '',
          log.percentChange || '',
          log.timestamp.toISOString()
        ].join(',');
      }).join('\n');
      
      // Combine header and rows
      const csv = csvHeader + csvRows;
      
      // Set headers for file download
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="price-logs-${params.id}.csv"`
        }
      });
    }
    
    // Default JSON response
    return NextResponse.json({
      priceLogs: priceLogs.map(log => ({
        id: log._id,
        experimentId: log.experimentId,
        assetId: log.assetId,
        symbol: log.symbol,
        roundNumber: log.roundNumber,
        price: log.price,
        previousPrice: log.previousPrice,
        percentChange: log.percentChange,
        timestamp: log.timestamp
      })),
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching price logs:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch price logs',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}