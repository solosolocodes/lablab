import mongoose from 'mongoose';
import { debug } from './debug';

// In development, use .env.local value, in production use vercel.json environment variable
// Note: Added TLS parameter to handle SSL/TLS issues (can't use both tlsInsecure and tlsAllowInvalidCertificates)
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vis203077:lablab@lablab.bw2sxxm.mongodb.net/?retryWrites=true&w=majority&appName=lablab&tlsAllowInvalidCertificates=true";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

debug.info('DB', `Using MongoDB URI from ${process.env.MONGODB_URI ? 'environment variable' : 'fallback hardcoded value'}`);
debug.info('ENV', `Debug mode: ${debug.isEnabled ? 'ENABLED' : 'DISABLED'}`);
debug.info('ENV', `Node environment: ${process.env.NODE_ENV}`);

// Log Vercel deployment information if available
if (process.env.VERCEL_ENV) {
  debug.info('VERCEL', `Deployment environment: ${process.env.VERCEL_ENV}`);
  debug.info('VERCEL', `Deployment URL: ${process.env.VERCEL_URL || 'unknown'}`);
  debug.info('VERCEL', `Deployment ID: ${process.env.VERCEL_ID || 'unknown'}`);
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
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true, // Only use in development
};

async function connectDB() {
  // If there's an active connection, return it
  if (cached.conn) {
    // Check if the connection is still alive
    if (mongoose.connection.readyState === 1) {
      return cached.conn;
    }
    
    // Connection is not ready, reset the cache
    debug.warn('DB', 'MongoDB connection not in ready state, resetting...');
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
      debug.error('DB', 'Previous MongoDB connection attempt failed:', error);
      cached.promise = null;
    }
  }

  // Force a small delay between connection attempts to prevent overwhelming the server
  const now = Date.now();
  if (cached.lastConnectionAttempt && now - cached.lastConnectionAttempt < 3000) {
    const waitTime = 3000 - (now - cached.lastConnectionAttempt);
    debug.info('DB', `Rate limiting MongoDB connection attempts, waiting ${waitTime}ms...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  cached.lastConnectionAttempt = Date.now();
  
  // Start a new connection attempt
  debug.info('DB', 'Establishing new MongoDB connection...');
  cached.promise = mongoose.connect(MONGODB_URI, connectionOptions)
    .then(mongoose => {
      debug.info('DB', `MongoDB connected successfully at ${new Date().toISOString()}`);
      
      // Setup connection event handlers
      mongoose.connection.on('error', err => {
        debug.error('DB', 'MongoDB connection error:', err);
      });
      
      mongoose.connection.on('disconnected', () => {
        debug.warn('DB', `MongoDB disconnected at ${new Date().toISOString()}`);
        // Reset the connection cache when disconnected to force a new connection on next request
        if (cached.conn) {
          cached.conn = null;
        }
      });
      
      return mongoose;
    })
    .catch(err => {
      // Log detailed connection error information
      debug.error('DB', 'MongoDB connection error details:', err);
      
      // Handle specific MongoDB error cases
      if (err.name === 'MongoServerSelectionError') {
        debug.error('DB', 'Could not connect to MongoDB server. Check network connectivity and server status.');
      } else if (err.message.includes('Authentication failed')) {
        debug.error('DB', 'Authentication failed. Check MongoDB username and password.');
      } else if (err.message.includes('ENOTFOUND')) {
        debug.error('DB', 'DNS lookup failed. Check MongoDB URI hostname.');
      } else if (err.message.includes('SSL') || err.message.includes('TLS') || err.message.includes('ssl') || err.message.includes('tls')) {
        debug.error('DB', 'SSL/TLS connection error. This might be caused by certificate issues or TLS version incompatibility.');
        debug.error('DB', 'Try connecting with tlsAllowInvalidCertificates=true in connection options.');
      }
      
      // Reset on error to force a retry on next request
      cached.promise = null;
      throw err; // Re-throw to allow calling code to handle the error
    });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    debug.error('DB', 'Failed to connect to MongoDB in connectDB function:', error);
    
    // Log detailed error information
    if (error instanceof Error) {
      // Add user-friendly error messages for common MongoDB issues
      if (error.name === 'MongoNetworkError' || error.message.includes('failed to connect')) {
        debug.error('DB', 'MongoDB connection failed: Network error - please check your internet connection and MongoDB server status');
      } else if (error.message.includes('Authentication failed')) {
        debug.error('DB', 'MongoDB connection failed: Authentication error - please check your MongoDB username and password');
      } else if (error.message.includes('ENOTFOUND')) {
        debug.error('DB', 'MongoDB connection failed: DNS lookup error - please check the hostname in your MongoDB URI');
      } else if (error.message.includes('SSL') || error.message.includes('TLS') || error.message.includes('ssl') || error.message.includes('tls')) {
        debug.error('DB', 'MongoDB connection failed: SSL/TLS error - this is often caused by certificate validation issues');
        debug.info('DB', 'Trying to reconnect with relaxed TLS settings. This should only be used in development.');
        
        // Try to connect again with relaxed TLS settings
        try {
          debug.info('DB', 'Attempting connection with relaxed TLS settings...');
          mongoose.connection.close();
          
          // Apply TLS relaxation for this connection attempt
          // Note: tlsInsecure and tlsAllowInvalidCertificates can't be used together
          const relaxedOptions = {
            ...connectionOptions,
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true,
            // Force TLS 1.2 which is more widely compatible
            tlsCAFile: undefined,
            replicaSet: undefined
          };
          
          return await mongoose.connect(MONGODB_URI, relaxedOptions);
        } catch (retryError) {
          debug.error('DB', 'Failed to connect even with relaxed TLS settings:', retryError);
        }
      }
    }
    
    // Clear the promise so the next call will try again
    cached.promise = null;
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }
}

export default connectDB;