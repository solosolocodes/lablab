// Script to test MongoDB connection
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

// Get the MongoDB URI from environment variables or use the hardcoded fallback
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vis203077:lablab@lablab.bw2sxxm.mongodb.net/?retryWrites=true&w=majority&appName=lablab&tlsAllowInvalidCertificates=true";

// Connection options
const connectionOptions = {
  serverSelectionTimeoutMS: 10000, // 10 seconds
  socketTimeoutMS: 45000, // 45 seconds
  connectTimeoutMS: 10000, // 10 seconds
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
  ssl: true,
  tls: true,
  tlsAllowInvalidCertificates: true, // For development only
};

console.log('Testing MongoDB connection...');
console.log(`Connection string: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Hide credentials

async function testConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('✅ MongoDB connected successfully!');
    
    // Test if we can run a simple query
    console.log('Testing MongoDB query...');
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log(`✅ Database contains ${collections.length} collections:`);
      collections.forEach(collection => {
        console.log(`  - ${collection.name}`);
      });
    } catch (queryError) {
      console.error('❌ Failed to query database:', queryError);
    }
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('❌ MongoDB connection failed:');
    console.error('- Error name:', error.name);
    console.error('- Error message:', error.message);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('- Could not connect to MongoDB server. Check network connectivity and server status.');
      
      // Check if the server is reachable with a different approach
      console.log('\nTrying to ping the MongoDB server...');
      const { execSync } = require('child_process');
      try {
        const host = MONGODB_URI.match(/@([^/:]+)/)[1];
        console.log(`Pinging host: ${host}`);
        execSync(`ping -c 3 ${host}`);
        console.log('✅ Host is reachable');
      } catch (pingError) {
        console.error('❌ Host is not reachable');
      }
    } else if (error.message.includes('Authentication failed')) {
      console.error('- Authentication failed. Check MongoDB username and password.');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('- DNS lookup failed. Check MongoDB URI hostname.');
    }
    
    // Try with relaxed TLS settings
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.log('\nTrying with relaxed TLS settings...');
      try {
        await mongoose.connect(MONGODB_URI, {
          ...connectionOptions,
          ssl: true,
          tls: true,
          tlsAllowInvalidCertificates: true,
          tlsCAFile: undefined,
          replicaSet: undefined
        });
        console.log('✅ Connection successful with relaxed TLS settings!');
        await mongoose.connection.close();
      } catch (retryError) {
        console.error('❌ Failed even with relaxed TLS settings:', retryError.message);
      }
    }
  }
}

testConnection()
  .then(() => {
    console.log('Test complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during test:', error);
    process.exit(1);
  });