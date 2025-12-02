require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthchain';

async function createTestUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    // Check if user already exists
    const existingUser = await User.findOne({ email: 'magic@konoha.com' });
    if (existingUser) {
      console.log('❌ User already exists with email: magic@konoha.com');
      process.exit(1);
    }

    // Create test user
    const user = new User({
      username: 'magic',
      email: 'magic@konoha.com',
      password: 'password123', // Will be hashed automatically
      name: 'Magic User',
      role: 'patient'
    });

    await user.save();
    console.log('✅ Test user created successfully!');
    console.log('   Email: magic@konoha.com');
    console.log('   Password: password123');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user:', error.message);
    process.exit(1);
  }
}

createTestUser();


