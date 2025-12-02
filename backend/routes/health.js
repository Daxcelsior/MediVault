const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    message: 'HealthChain Backend is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

