import connectDB from './db';

/**
 * Database connection utility for MongoDB
 * Wraps the base connectDB function to provide a consistent interface
 * for all API routes and server components
 */
async function dbConnect() {
  try {
    await connectDB();
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw new Error('Database connection failed');
  }
}

export default dbConnect;