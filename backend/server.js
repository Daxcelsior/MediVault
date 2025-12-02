const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Routes
const healthRoute = require('./routes/health');
const patientRoute = require('./routes/patients');
const fileRoute = require('./routes/files');
const authRoute = require('./routes/auth');
const ipfsRoute = require('./routes/ipfs');

// Initialize app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:3000"];
app.use(cors({
  origin: allowedOrigins,
  methods: "GET,POST,PUT,DELETE,PATCH",
  credentials: true
}));

// JSON parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter (basic protection against brute-force)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 mins
  max: 100 // max 100 requests per IP
});
app.use(limiter);

// API routes
app.use('/api/health', healthRoute);
app.use('/api/patients', patientRoute);
app.use('/api/files', fileRoute);
app.use('/api/auth', authRoute);
app.use('/api/ipfs', ipfsRoute);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/healthchain', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err.message);
  if (err.message.includes('authentication failed') || err.message.includes('bad auth')) {
    console.log('\n💡 Authentication Error - Possible fixes:');
    console.log('   1. Go to MongoDB Atlas → Database Access');
    console.log('   2. Verify the username and password are correct');
    console.log('   3. Get a fresh connection string: Clusters → Connect → Connect your application');
    console.log('   4. Replace <password> in the connection string with your actual password');
    console.log('   5. Make sure to add /healthchain before the ? in the connection string');
  } else {
    console.log('💡 Make sure MONGODB_URI is correct in .env file');
    console.log('💡 Check your MongoDB connection string');
  }
});

// Error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});

