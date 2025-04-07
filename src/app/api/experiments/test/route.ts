import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  console.log('TEST API: Request received at', new Date().toISOString());
  
  try {
    // Test MongoDB connection
    console.log('TEST API: Attempting database connection...');
    await connectDB();
    
    // Get connection state
    const connectionState = mongoose.connection.readyState;
    const stateMap = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    
    console.log(`TEST API: MongoDB connection state: ${connectionState} (${stateMap[connectionState] || 'unknown'})`);
    
    // Create a simple test object with proper TypeScript interface
    interface TestResponse {
      success: boolean;
      message: string;
      timestamp: string;
      connectionState: {
        state: number;
        description: string;
      };
      mongodbInfo: {
        connectionString: string;
        host: string;
        name: string;
        models: string[];
      };
      collections?: string[];
      experimentCount?: number;
      queryError?: string;
    }
    
    const testObject: TestResponse = {
      success: true,
      message: 'Test route responding successfully',
      timestamp: new Date().toISOString(),
      connectionState: {
        state: connectionState,
        description: stateMap[connectionState] || 'unknown'
      },
      mongodbInfo: {
        connectionString: process.env.MONGODB_URI ? 'Set (hidden)' : 'Not set',
        host: mongoose.connection.host || 'unknown',
        name: mongoose.connection.name || 'unknown',
        models: Object.keys(mongoose.models)
      }
    };
    
    // Try to query the database if connected
    if (connectionState === 1) {
      try {
        // Get all model collections
        console.log('TEST API: Connected - listing collections...');
        const collections = Object.keys(mongoose.connection.collections);
        testObject.collections = collections;
        
        // Try to count documents in the Experiment collection if it exists
        if (mongoose.models.Experiment) {
          console.log('TEST API: Experiment model exists - counting documents...');
          const count = await mongoose.models.Experiment.countDocuments();
          testObject.experimentCount = count;
        } else {
          console.log('TEST API: Experiment model does not exist');
        }
      } catch (queryError) {
        console.error('TEST API: Error querying database:', queryError);
        testObject.queryError = queryError instanceof Error ? queryError.message : String(queryError);
      }
    }
    
    console.log('TEST API: Sending response:', testObject);
    
    return NextResponse.json(testObject, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('TEST API: Error in test route:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Test route failed',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  }
}