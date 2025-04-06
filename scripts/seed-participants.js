/**
 * Script to seed 100 participant users in MongoDB
 * 
 * Usage: 
 * 1. Ensure MongoDB connection string is set in .env.local file
 * 2. Run: node scripts/seed-participants.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '.env.local' });

// MongoDB connection string from environment variables
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vis203077:lablab@lablab.bw2sxxm.mongodb.net/?retryWrites=true&w=majority&appName=lablab";

// Define the User schema (simplified version of the actual model)
const userSchema = new mongoose.Schema({
  name: String,
  email: {
    type: String,
    unique: true
  },
  password: String,
  role: {
    type: String,
    default: 'participant'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Create or get User model
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Generate random alphanumeric string of specified length
function generateAlphanumeric(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

// Array of first names to use for generating participants
const firstNames = [
  'Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'William', 'Sophia', 'James', 'Isabella', 'Oliver',
  'Charlotte', 'Benjamin', 'Amelia', 'Elijah', 'Mia', 'Lucas', 'Harper', 'Mason', 'Evelyn', 'Logan',
  'Abigail', 'Alexander', 'Emily', 'Ethan', 'Elizabeth', 'Jacob', 'Sofia', 'Michael', 'Avery', 'Daniel',
  'Ella', 'Henry', 'Scarlett', 'Jackson', 'Grace', 'Sebastian', 'Chloe', 'Aiden', 'Victoria', 'Matthew',
  'Riley', 'Samuel', 'Aria', 'David', 'Lily', 'Joseph', 'Aubrey', 'Carter', 'Zoey', 'Owen',
  'Hannah', 'Wyatt', 'Lillian', 'John', 'Addison', 'Jack', 'Layla', 'Luke', 'Brooklyn', 'Jayden',
  'Leah', 'Dylan', 'Zoe', 'Gabriel', 'Penelope', 'Isaac', 'Stella', 'Lincoln', 'Everly', 'Anthony',
  'Lucy', 'Hudson', 'Natalie', 'Caleb', 'Bella', 'Ryan', 'Aurora', 'Nathan', 'Claire', 'Muhammad',
  'Violet', 'Thomas', 'Skylar', 'Leo', 'Savannah', 'Josiah', 'Audrey', 'Joshua', 'Maria', 'Christopher',
  'Josephine', 'Andrew', 'Aaliyah', 'Theodore', 'Genesis', 'Adrian', 'Maya', 'Austin', 'Elena', 'Xavier'
];

// Function to generate user data
function generateUsers(count) {
  const users = [];
  
  for (let i = 0; i < count; i++) {
    // Generate random data
    const alphaId = generateAlphanumeric(6);
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = alphaId;
    
    users.push({
      name: `${firstName} ${lastName}`,
      email: `${alphaId}@email.com`,
      password: '123123', // Will be hashed before saving
      role: 'participant'
    });
  }
  
  return users;
}

// Connect to MongoDB and seed users
async function seedUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');
    
    console.log('Generating 100 participants...');
    const participants = generateUsers(100);
    
    console.log('Hashing passwords...');
    // Hash all passwords
    const salt = await bcrypt.genSalt(10);
    for (const user of participants) {
      user.password = await bcrypt.hash(user.password, salt);
    }
    
    console.log('Inserting participants into database...');
    // Insert all users, but skip duplicates (in case some random emails match)
    let insertedCount = 0;
    for (const user of participants) {
      try {
        await User.create(user);
        insertedCount++;
      } catch (error) {
        if (error.code === 11000) {
          console.log(`Skipping duplicate email: ${user.email}`);
        } else {
          throw error;
        }
      }
    }
    
    console.log(`Successfully added ${insertedCount} participants to the database`);
    console.log('Sample participants:');
    console.log(participants.slice(0, 5).map(p => ({ name: p.name, email: p.email })));
    
  } catch (error) {
    console.error('Error seeding users:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the seeding function
seedUsers();