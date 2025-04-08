import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/dbConnect';
import Transaction, { ITransaction } from '@/models/Transaction';
import Experiment from '@/models/Experiment';
import User from '@/models/User';
import mongoose from 'mongoose';

// POST /api/experiments/:id/transactions - Create a new transaction
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

    // Get user ID from email
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    const requiredFields = ['assetId', 'symbol', 'type', 'quantity', 'price', 'totalValue', 'roundNumber'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      }, { status: 400 });
    }
    
    // Create transaction document
    const transaction = new Transaction({
      experimentId: experiment._id,
      userId: user._id,
      assetId: data.assetId,
      symbol: data.symbol,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      totalValue: data.totalValue,
      roundNumber: data.roundNumber,
      timestamp: data.timestamp || new Date()
    });

    // Save transaction to database
    await transaction.save();

    return NextResponse.json({ 
      message: 'Transaction recorded successfully',
      transaction: {
        id: transaction._id,
        experimentId: transaction.experimentId,
        userId: transaction.userId,
        type: transaction.type,
        symbol: transaction.symbol,
        quantity: transaction.quantity,
        price: transaction.price,
        totalValue: transaction.totalValue,
        roundNumber: transaction.roundNumber,
        timestamp: transaction.timestamp
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error recording transaction:', error);
    return NextResponse.json({ 
      message: 'Failed to record transaction',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/experiments/:id/transactions - Get transactions for an experiment
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

    // Get user ID from email
    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const type = searchParams.get('type');
    const symbol = searchParams.get('symbol');
    const roundNumber = searchParams.get('round');
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    // Build query
    const query: any = { experimentId: experiment._id };
    
    // Only admins can query all users' transactions
    if (user.role !== 'admin' || userId === 'me') {
      query.userId = user._id;
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      query.userId = userId;
    }
    
    if (type && ['buy', 'sell'].includes(type)) {
      query.type = type;
    }
    
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
    const transactions = await Transaction.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);
    
    // Count total matching documents for pagination
    const totalCount = await Transaction.countDocuments(query);
    
    return NextResponse.json({
      transactions: transactions.map(t => ({
        id: t._id,
        experimentId: t.experimentId,
        userId: t.userId,
        assetId: t.assetId,
        symbol: t.symbol,
        type: t.type,
        quantity: t.quantity,
        price: t.price,
        totalValue: t.totalValue,
        roundNumber: t.roundNumber,
        timestamp: t.timestamp
      })),
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch transactions',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}