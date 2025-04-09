import mongoose from 'mongoose';

// In development, use .env.local value, in production use vercel.json environment variable
// Note: Added tlsInsecure=true query parameter to handle SSL/TLS issues
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vis203077:lablab@lablab.bw2sxxm.mongodb.net/?retryWrites=true&w=majority&appName=lablab&tlsInsecure=true&tlsAllowInvalidCertificates=true&tlsAllowInvalidHostnames=true";

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

console.log(`[DEBUG DB] Using MongoDB URI from ${process.env.MONGODB_URI ? 'environment variable' : 'fallback hardcoded value'}`);

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
  tlsAllowInvalidHostnames: true,    // Only use in development
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
      // Log detailed connection error information
      console.error('MongoDB connection error details:');
      console.error('- Error name:', err.name);
      console.error('- Error message:', err.message);
      console.error('- Error code:', err.code);
      console.error('- Error stack:', err.stack);
      
      // Handle specific MongoDB error cases
      if (err.name === 'MongoServerSelectionError') {
        console.error('- Could not connect to MongoDB server. Check network connectivity and server status.');
      } else if (err.message.includes('Authentication failed')) {
        console.error('- Authentication failed. Check MongoDB username and password.');
      } else if (err.message.includes('ENOTFOUND')) {
        console.error('- DNS lookup failed. Check MongoDB URI hostname.');
      } else if (err.message.includes('SSL') || err.message.includes('TLS') || err.message.includes('ssl') || err.message.includes('tls')) {
        console.error('- SSL/TLS connection error. This might be caused by certificate issues or TLS version incompatibility.');
        console.error('- Try connecting with tlsAllowInvalidCertificates=true in connection options.');
      }
      
      // Reset on error to force a retry on next request
      cached.promise = null;
      throw err; // Re-throw to allow calling code to handle the error
    });

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    console.error('Failed to connect to MongoDB in connectDB function:', error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error('- Error name:', error.name);
      console.error('- Error message:', error.message);
      
      // Add user-friendly error messages for common MongoDB issues
      if (error.name === 'MongoNetworkError' || error.message.includes('failed to connect')) {
        console.error('MongoDB connection failed: Network error - please check your internet connection and MongoDB server status');
      } else if (error.message.includes('Authentication failed')) {
        console.error('MongoDB connection failed: Authentication error - please check your MongoDB username and password');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('MongoDB connection failed: DNS lookup error - please check the hostname in your MongoDB URI');
      } else if (error.message.includes('SSL') || error.message.includes('TLS') || error.message.includes('ssl') || error.message.includes('tls')) {
        console.error('MongoDB connection failed: SSL/TLS error - this is often caused by certificate validation issues');
        console.error('Trying to reconnect with relaxed TLS settings. This should only be used in development.');
        
        // Try to connect again with relaxed TLS settings
        try {
          console.log('Attempting connection with relaxed TLS settings...');
          mongoose.connection.close();
          
          // Apply stronger TLS relaxation for this connection attempt
          const relaxedOptions = {
            ...connectionOptions,
            ssl: true,
            tls: true,
            tlsAllowInvalidCertificates: true,
            tlsAllowInvalidHostnames: true,
            tlsInsecure: true,
            // Force TLS 1.2 which is more widely compatible
            tlsCAFile: undefined,
            replicaSet: undefined
          };
          
          return await mongoose.connect(MONGODB_URI, relaxedOptions);
        } catch (retryError) {
          console.error('Failed to connect even with relaxed TLS settings:', retryError);
        }
      }
    }
    
    // Clear the promise so the next call will try again
    cached.promise = null;
    throw new Error(`MongoDB connection failed: ${error instanceof Error ? error.message : 'Unknown database error'}`);
  }
}

export default connectDB;