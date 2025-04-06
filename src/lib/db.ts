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
};

// Cache the connection in global namespace
if (!globalForMongoose.mongoose) {
  globalForMongoose.mongoose = cached;
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI)
      .then(mongoose => {
        console.log('MongoDB connected successfully');
        return mongoose;
      });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;