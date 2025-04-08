import connectDB from './db';

/**
 * Database connection utility for MongoDB
 * Wraps the base connectDB function to provide a consistent interface
 * for all API routes and server components with better error handling
 */
async function dbConnect() {
  // Number of connection attempts before giving up
  const MAX_RETRIES = 3;
  // Time to wait between retries (ms)
  const RETRY_DELAY = 1000;
  
  let lastError = null;
  
  // Try connecting multiple times before giving up
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[DB Connect] Connection attempt ${attempt}/${MAX_RETRIES}`);
      const mongoose = await connectDB();
      console.log('[DB Connect] Connection successful');
      return mongoose;
    } catch (error) {
      lastError = error;
      console.error(`[DB Connect] Connection attempt ${attempt} failed:`, error);
      
      if (attempt < MAX_RETRIES) {
        console.log(`[DB Connect] Retrying in ${RETRY_DELAY}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }
  
  // All attempts failed
  console.error(`[DB Connect] All ${MAX_RETRIES} connection attempts failed`);
  throw new Error(`Database connection failed after ${MAX_RETRIES} attempts: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Use this function to perform database operations with graceful fallback to default values
 * when the database is unavailable
 */
export async function withDatabaseConnection<T>(
  dbOperation: () => Promise<T>,
  fallbackValue: T,
  operationName = 'database operation'
): Promise<T> {
  try {
    // First try to connect to the database
    await dbConnect();
    // Then perform the database operation
    return await dbOperation();
  } catch (error) {
    console.error(`[DB Connect] Error in ${operationName}:`, error);
    console.log(`[DB Connect] Using fallback data for ${operationName}`);
    // Return fallback value if anything fails
    return fallbackValue;
  }
}

export default dbConnect;