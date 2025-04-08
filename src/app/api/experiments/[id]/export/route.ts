import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/dbConnect';
import Experiment from '@/models/Experiment';
import Transaction from '@/models/Transaction';
import PriceLog from '@/models/PriceLog';
import User from '@/models/User';
import mongoose from 'mongoose';

// GET /api/experiments/:id/export - Export all experiment data
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

    // Get user and verify they are an admin
    const user = await User.findOne({ email: session.user.email });
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ message: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get('format') || 'json';
    const dataType = searchParams.get('type') || 'all';

    // Fetch experiment data
    let transactions = [];
    let priceLogs = [];
    
    // Fetch transactions if requested
    if (dataType === 'all' || dataType === 'transactions') {
      transactions = await Transaction.find({ experimentId: experiment._id })
        .sort({ timestamp: 1 })
        .lean();
    }

    // Fetch price logs if requested
    if (dataType === 'all' || dataType === 'prices') {
      priceLogs = await PriceLog.find({ experimentId: experiment._id })
        .sort({ roundNumber: 1, timestamp: 1 })
        .lean();
    }

    // Return data based on requested format
    if (format === 'csv') {
      let csv = '';
      
      // Generate transactions CSV
      if (dataType === 'all' || dataType === 'transactions') {
        const transactionCsvHeader = 'transaction_id,experiment_id,user_id,asset_id,symbol,type,quantity,price,total_value,round_number,timestamp\n';
        const transactionRows = transactions.map((t: any) => {
          return [
            t._id.toString(),
            t.experimentId.toString(),
            t.userId.toString(),
            t.assetId,
            t.symbol,
            t.type,
            t.quantity,
            t.price,
            t.totalValue,
            t.roundNumber,
            new Date(t.timestamp).toISOString()
          ].join(',');
        }).join('\n');
        
        csv += 'TRANSACTIONS\n' + transactionCsvHeader + transactionRows + '\n\n';
      }
      
      // Generate price logs CSV
      if (dataType === 'all' || dataType === 'prices') {
        const priceLogsCsvHeader = 'log_id,experiment_id,asset_id,symbol,round_number,price,previous_price,percent_change,timestamp\n';
        const priceLogRows = priceLogs.map((p: any) => {
          return [
            p._id.toString(),
            p.experimentId.toString(),
            p.assetId,
            p.symbol,
            p.roundNumber,
            p.price,
            p.previousPrice || '',
            p.percentChange || '',
            new Date(p.timestamp).toISOString()
          ].join(',');
        }).join('\n');
        
        csv += 'PRICE LOGS\n' + priceLogsCsvHeader + priceLogRows;
      }
      
      // Create experiment metadata section
      const experimentMetadata = `EXPERIMENT METADATA\nid,name,status,stages,created_at\n${
        experiment._id},${experiment.name},${experiment.status},${
        experiment.stages?.length || 0},${new Date(experiment.createdAt).toISOString()}\n\n`;
      
      // Combine all sections
      csv = experimentMetadata + csv;
      
      // Return as CSV file
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="experiment-${params.id}-export.csv"`
        }
      });
    } else if (format === 'excel') {
      // Return a message that Excel format is not yet supported
      return NextResponse.json({
        message: 'Excel export format is not yet supported. Please use CSV or JSON format.'
      }, { status: 400 });
    }
    
    // Default JSON response
    return NextResponse.json({
      experiment: {
        id: experiment._id,
        name: experiment.name,
        description: experiment.description,
        status: experiment.status,
        stages: experiment.stages?.length || 0,
        createdAt: experiment.createdAt
      },
      transactions: transactions.map((t: any) => ({
        id: t._id,
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
      priceLogs: priceLogs.map((p: any) => ({
        id: p._id,
        assetId: p.assetId,
        symbol: p.symbol,
        roundNumber: p.roundNumber,
        price: p.price,
        previousPrice: p.previousPrice,
        percentChange: p.percentChange,
        timestamp: p.timestamp
      })),
      meta: {
        transactionCount: transactions.length,
        priceLogCount: priceLogs.length,
        exportDate: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error exporting experiment data:', error);
    return NextResponse.json({ 
      message: 'Failed to export experiment data',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}