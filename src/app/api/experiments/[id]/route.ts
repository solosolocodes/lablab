// Improved, robust API route for experiments
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Experiment from '@/models/Experiment';

// Enable CORS for API routes
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Standard response headers
const STANDARD_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  ...corsHeaders
};

// Get experiment ID from URL and validate it's a valid ObjectId
function getExperimentId(request: NextRequest): string | null {
  const pathParts = request.nextUrl.pathname.split('/');
  const experimentId = pathParts[pathParts.length - 1];
  
  // Validate it's a valid MongoDB ObjectId
  if (!mongoose.isValidObjectId(experimentId)) {
    return null;
  }
  
  return experimentId;
}

// Type definitions for MongoDB documents
type MongoDocument = {
  _id?: mongoose.Types.ObjectId | string;
  [key: string]: unknown;
};

// Return type for serialized documents
type SerializedDocument = {
  id?: string;
  [key: string]: unknown;
};

// Serialize MongoDB document to safe JSON
function serializeDocument(doc: unknown): unknown {
  if (doc === null || typeof doc !== 'object') {
    return doc;
  }
  
  // Handle arrays
  if (Array.isArray(doc)) {
    return doc.map(item => serializeDocument(item));
  }
  
  // Handle dates
  if (doc instanceof Date) {
    return doc.toISOString();
  }
  
  // Document should be an object at this point
  const document = doc as MongoDocument;
  
  // Handle ObjectId
  if (document._id && typeof document._id === 'object' && 'toString' in document._id) {
    document.id = document._id.toString();
  }
  
  // Create a new object to avoid modifying the original
  const result: SerializedDocument = {};
  
  // Process all properties
  for (const [key, value] of Object.entries(document)) {
    // Skip the _id field as we've already handled it
    if (key === '_id') continue;
    
    // Skip __v internal MongoDB version field
    if (key === '__v') continue;
    
    // Handle ObjectIds in the document
    if (key.endsWith('Id') && value !== null && typeof value === 'object' && mongoose.isValidObjectId(value)) {
      result[key] = String(value);
      continue;
    }
    
    // Handle nested documents, arrays and other values
    result[key] = serializeDocument(value);
  }
  
  return result;
}

// Interface for error details
interface ErrorDetails {
  [key: string]: unknown;
}

// Standard error response helper
function errorResponse(message: string, status: number, details?: ErrorDetails) {
  const responseData = { 
    success: false, 
    message,
    details: details || undefined,
    timestamp: new Date().toISOString() 
  };
  
  // Use direct NextResponse constructor instead of json() helper
  return new NextResponse(
    JSON.stringify(responseData),
    { 
      status, 
      headers: STANDARD_HEADERS
    }
  );
}

// Options for CORS preflight requests
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function OPTIONS(_: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Error type for database operations
type DatabaseError = 
  | mongoose.Error.MongooseServerSelectionError 
  | mongoose.Error
  | mongoose.Error.CastError 
  | Error;

// Retry a database operation with backoff
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  retryDelay = 500
): Promise<T> {
  let lastError: DatabaseError | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Type guard to ensure error is Error-like
      if (!(error instanceof Error)) {
        throw error; // If it's not an Error, just throw it
      }
      
      lastError = error as DatabaseError;
      
      // Only retry for connection/timeout type errors
      if (
        error instanceof mongoose.Error.MongooseServerSelectionError ||
        error instanceof mongoose.Error.CastError ||
        (error instanceof mongoose.Error && error.name === 'DisconnectedError') ||
        (error instanceof Error && error.name === 'MongoError' && 
         (error.message.includes('timeout') || error.message.includes('connection')))
      ) {
        // Only retry if we're not on the last attempt
        if (attempt < maxRetries - 1) {
          // Exponential backoff with jitter
          const delay = retryDelay * Math.pow(2, attempt) + Math.random() * 200;
          console.log(`API: Retrying database operation attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // Non-retriable error or max retries reached
      throw error;
    }
  }
  
  // This shouldn't be reached but TypeScript needs it
  if (lastError) {
    throw lastError;
  }
  
  // This is to satisfy TypeScript - should never happen
  throw new Error('Unexpected end of retryOperation without result or error');
}

// GET handler for a specific experiment
export async function GET(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 12);
  console.log(`API [${requestId}]: GET experiment request started at ${new Date().toISOString()}`);
  
  try {
    // Get ID from URL
    const experimentId = getExperimentId(request);
    if (!experimentId) {
      console.log(`API [${requestId}]: Invalid experiment ID format`);
      return errorResponse('Invalid experiment ID format', 400);
    }
    
    console.log(`API [${requestId}]: Valid experiment ID: ${experimentId}`);
    
    // Connect to database with retry logic
    let dbConnected = false;
    try {
      await connectDB();
      dbConnected = true;
      console.log(`API [${requestId}]: Database connected`);
    } catch (connError) {
      console.error(`API [${requestId}]: Database connection error:`, connError);
      return errorResponse(
        'Database connection failed. Please try again.',
        503, // Service Unavailable
        { retryAfter: 3 } // Suggest retry after 3 seconds
      );
    }
    
    // Only proceed if database is connected
    if (!dbConnected) {
      return errorResponse('Database unavailable', 503);
    }
    
    // Create a direct, simple response without complex processing
    try {
      // Simple find by ID with retry logic
      const experiment = await retryOperation(
        () => Experiment.findById(experimentId).lean(),
        3, // Max 3 retries
        300 // Starting delay of 300ms
      );
      
      // Not found
      if (!experiment) {
        console.log(`API [${requestId}]: Experiment not found`);
        return errorResponse('Experiment not found', 404);
      }
      
      // Serialize the document for proper JSON response
      const serialized = serializeDocument(experiment) as Record<string, unknown>;
      
      // Ensure expected fields are present
      const response = {
        success: true,
        id: (serialized.id as string) || experimentId,
        name: (serialized.name as string) || 'Untitled',
        description: (serialized.description as string) || '',
        status: (serialized.status as string) || 'draft',
        userGroups: (serialized.userGroups as unknown[]) || [],
        stages: (serialized.stages as unknown[]) || [],
        branches: (serialized.branches as unknown[]) || [],
        startStageId: serialized.startStageId as string | undefined,
        createdAt: (serialized.createdAt as string) || new Date().toISOString(),
        updatedAt: (serialized.updatedAt as string) || new Date().toISOString(),
        lastEditedAt: serialized.lastEditedAt as string | undefined
      };
      
      // Log success
      console.log(`API [${requestId}]: Successfully found experiment: ${response.id}, ${response.name}`);
      
      try {
        // Return clean JSON response - using traditional method rather than NextResponse.json
        // to have more control over response formatting
        return new NextResponse(JSON.stringify(response), {
          status: 200,
          headers: STANDARD_HEADERS
        });
      } catch (jsonError) {
        console.error(`API [${requestId}]: Error stringifying response:`, jsonError);
        // Fallback to a simpler response
        return new NextResponse(
          JSON.stringify({ 
            success: true, 
            id: experimentId,
            name: serialized.name || 'Untitled',
            message: 'Experiment found but could not serialize all details'
          }),
          {
            status: 200,
            headers: STANDARD_HEADERS
          }
        );
      }
    } catch (dbError) {
      console.error(`API [${requestId}]: Database error:`, dbError);
      
      // Handle specific MongoDB errors
      if (dbError instanceof mongoose.Error.CastError) {
        return errorResponse(
          'Invalid experiment ID format', 
          400
        );
      }
      
      // Generic database error
      return errorResponse(
        `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`, 
        500
      );
    }
  } catch (error) {
    console.error(`API [${requestId}]: Unexpected error:`, error);
    return errorResponse(
      'An unexpected error occurred',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}

// PUT handler for updating an experiment
export async function PUT(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 12);
  console.log(`API [${requestId}]: PUT experiment request started at ${new Date().toISOString()}`);
  
  try {
    // Get ID from URL
    const experimentId = getExperimentId(request);
    if (!experimentId) {
      console.log(`API [${requestId}]: Invalid experiment ID format`);
      return errorResponse('Invalid experiment ID format', 400);
    }
    
    console.log(`API [${requestId}]: Updating experiment ID: ${experimentId}`);
    
    // Get request body with error handling
    let data;
    try {
      data = await request.json();
    } catch (parseError) {
      console.error(`API [${requestId}]: Request JSON parse error:`, parseError);
      return errorResponse('Invalid JSON in request body', 400);
    }
    
    // Basic validation
    if (!data.name || typeof data.name !== 'string') {
      return errorResponse('Name is required and must be a string', 400);
    }
    
    if (!data.description || typeof data.description !== 'string') {
      return errorResponse('Description is required and must be a string', 400);
    }
    
    // Additional validations for complex fields
    if (data.stages && !Array.isArray(data.stages)) {
      return errorResponse('Stages must be an array', 400);
    }
    
    if (data.userGroups && !Array.isArray(data.userGroups)) {
      return errorResponse('User groups must be an array', 400);
    }
    
    // Connect to database with retry logic
    let dbConnected = false;
    try {
      await connectDB();
      dbConnected = true;
      console.log(`API [${requestId}]: Database connected`);
    } catch (connError) {
      console.error(`API [${requestId}]: Database connection error:`, connError);
      return errorResponse(
        'Database connection failed. Please try again.',
        503, // Service Unavailable
        { retryAfter: 3 } // Suggest retry after 3 seconds
      );
    }
    
    // Only proceed if database is connected
    if (!dbConnected) {
      return errorResponse('Database unavailable', 503);
    }
    
    // Find and update with retry mechanism
    try {
      // Create a session for potential future transaction support
      const session = await mongoose.startSession();
      
      try {
        // Check if experiment exists - with retry
        const experiment = await retryOperation(
          () => Experiment.findById(experimentId).session(session),
          3, // Max 3 retries
          300 // Starting delay of 300ms
        );
        
        if (!experiment) {
          session.endSession();
          return errorResponse('Experiment not found', 404);
        }
        
        // Update basic fields
        experiment.name = data.name;
        experiment.description = data.description;
        experiment.lastEditedAt = new Date();
        
        // Update optional fields if provided (with type safety)
        if (data.status && typeof data.status === 'string') {
          experiment.status = data.status;
        }
        
        if (Array.isArray(data.userGroups)) {
          experiment.userGroups = data.userGroups;
        }
        
        if (Array.isArray(data.stages)) {
          experiment.stages = data.stages;
        }
        
        if (Array.isArray(data.branches)) {
          experiment.branches = data.branches;
        }
        
        if (data.startStageId) {
          experiment.startStageId = data.startStageId;
        }
        
        // Save changes with retry
        await retryOperation(
          () => experiment.save({ session }),
          3, // Max 3 retries
          300 // Starting delay of 300ms
        );
        
        session.endSession();
        
        // Return success response - use direct NextResponse constructor
        const responseData = {
          success: true,
          message: 'Experiment updated successfully',
          id: experiment._id.toString(),
          timestamp: new Date().toISOString()
        };
        
        return new NextResponse(
          JSON.stringify(responseData),
          { 
            status: 200,
            headers: STANDARD_HEADERS
          }
        );
      } catch (sessionError) {
        // Make sure to close the session
        session.endSession();
        throw sessionError;
      }
    } catch (dbError) {
      console.error(`API [${requestId}]: Database error during update:`, dbError);
      
      // Handle specific MongoDB errors
      if (dbError instanceof mongoose.Error.ValidationError) {
        // Format validation errors for better client understanding
        const validationErrors: Record<string, string> = {};
        
        for (const field in dbError.errors) {
          validationErrors[field] = dbError.errors[field].message;
        }
        
        return errorResponse(
          'Validation error', 
          400,
          { fields: validationErrors }
        );
      }
      
      // Generic database error
      return errorResponse(
        'Error updating experiment',
        500,
        { error: dbError instanceof Error ? dbError.message : String(dbError) }
      );
    }
  } catch (error) {
    console.error(`API [${requestId}]: Unexpected error during update:`, error);
    return errorResponse(
      'An unexpected error occurred',
      500,
      { error: error instanceof Error ? error.message : String(error) }
    );
  }
}