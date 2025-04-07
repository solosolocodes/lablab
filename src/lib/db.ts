import mongoose from 'mongoose';

// In development, use .env.local value, in production use vercel.json environment variable
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vis203077:lablab@lablab.bw2sxxm.mongodb.net/?retryWrites=true&w=majority&appName=lablab";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

// Define the types for the cached connection
interface ConnectionCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastConnectionAttempt: number | null;
}

// In Next.js, we can cache the connection in a global variable safely
// This is explicitly recommended in the Next.js docs for database connections
// https://github.com/vercel/next.js/blob/canary/examples/with-mongodb-mongoose/lib/dbConnect.js
const globalForMongoose = global as unknown as {
  mongoose: ConnectionCache | undefined;
};

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
const cached: ConnectionCache = globalForMongoose.mongoose || {
  conn: null,
  promise: null,
  lastConnectionAttempt: null
};

// Cache the connection in global namespace
if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

// Connection options with proper timeouts and settings
const connectionOptions = {
  serverSelectionTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 10000, // 10 seconds
  maxPoolSize: 10, // Maximum number of connections in the pool
  minPoolSize: 2, // Minimum number of connections in the pool
  retryWrites: true,
  retryReads: true,
  maxIdleTimeMS: 60000, // Close connections after 60 seconds of inactivity
};

async function connectDB() {
  // If there's an active connection, return it
  if (cached.conn) {
    // Check if the connection is still alive
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    }
    
    // Connection is not ready, reset the cache
    console.log('MongoDB connection not in ready state, resetting...');
    cached.conn = null;
    cached.promise = null;
  }

  // If there's a connection attempt in progress, return the existing promise
  if (cached.promise) {
    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (error) {
      // If previous attempt failed, reset and try again
      console.error('Previous MongoDB connection attempt failed:', error);
      cached.promise = null;
    }
  }

  // Force a small delay between connection attempts to prevent overwhelming the server
  const now = Date.now();
  if (cached.lastConnectionAttempt && now - cached.lastConnectionAttempt < 3000) {
    const waitTime = 3000 - (now - cached.lastConnectionAttempt);
    console.log(`Rate limiting MongoDB connection attempts, waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  cached.lastConnectionAttempt = Date.now();
  
  // Start a new connection attempt
  console.log('Establishing new MongoDB connection...');
  cached.promise = mongoose.connect(MONGODB_URI, connectionOptions)
    .then(mongoose => {
      console.log('MongoDB connected successfully at', new Date().toISOString());
      
      // Setup connection event handlers
      mongoose.connection.on('error', err => {
        console.error('MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.log('MongoDB disconnected at', new Date().toISOString());
        // Reset the connection cache when disconnected to force a new connection on next request
        if (cached.conn) {
          cached.conn = null;
        }
      });
      
      return mongoose;
    })
    .catch(err => {
      console.error('MongoDB connection error:', err);
      // Reset on error to force a retry on next request
      cached.promise = null;
      throw err; // Re-throw to allow calling code to handle the error
    });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    // Clear the promise so the next call will try again
    cached.promise = null;
    throw error;
  }
}

export default connectDB;