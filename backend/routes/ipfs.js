const express = require('express');
const router = express.Router();
const multer = require('multer');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Pinata API configuration
const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET_API_KEY = process.env.PINATA_SECRET_API_KEY;
const PINATA_GATEWAY = process.env.PINATA_GATEWAY || 'gateway.pinata.cloud';
const PINATA_JWT = process.env.PINATA_JWT; // Alternative: use JWT instead of API key + secret

// Upload file to Pinata
router.post('/upload', upload.single('image'), async (req, res, next) => {
  try {
    // Check if Pinata credentials are configured
    if (!PINATA_JWT && (!PINATA_API_KEY || !PINATA_SECRET_API_KEY)) {
      return res.status(500).json({
        success: false,
        message: 'Pinata API credentials not configured. Please set PINATA_JWT or PINATA_API_KEY and PINATA_SECRET_API_KEY in your .env file.'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname || req.file.filename;

    try {
      // Prepare form data for Pinata
      const formData = new FormData();
      const fileStream = fs.createReadStream(filePath);
      
      formData.append('file', fileStream, {
        filename: fileName,
        contentType: req.file.mimetype || 'application/octet-stream'
      });

      // Add metadata (optional)
      const metadata = JSON.stringify({
        name: fileName,
        keyvalues: {
          uploadedAt: new Date().toISOString()
        }
      });
      formData.append('pinataMetadata', metadata);

      // Configure Pinata options (optional)
      const options = JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false
      });
      formData.append('pinataOptions', options);

      // Make request to Pinata
      let pinataResponse;
      
      if (PINATA_JWT) {
        // Use JWT authentication (recommended for Pinata V2)
        pinataResponse = await axios.post(
          'https://api.pinata.cloud/pinning/pinFileToIPFS',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${PINATA_JWT}`,
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );
      } else {
        // Use API key + secret authentication (Pinata V1)
        pinataResponse = await axios.post(
          'https://api.pinata.cloud/pinning/pinFileToIPFS',
          formData,
          {
            headers: {
              'pinata_api_key': PINATA_API_KEY,
              'pinata_secret_api_key': PINATA_SECRET_API_KEY,
              ...formData.getHeaders()
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
          }
        );
      }

      // Extract IPFS hash from response
      const ipfsHash = pinataResponse.data.IpfsHash;
      const ipfsUrl = `https://${PINATA_GATEWAY}/ipfs/${ipfsHash}`;

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      // Return success response
      res.json({
        success: true,
        ipfsHash,
        ipfsUrl,
        pinataUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        fileName,
        fileSize: req.file.size,
        timestamp: new Date().toISOString()
      });
    } catch (pinataError) {
      // Clean up uploaded file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      console.error('Pinata upload error:', pinataError.response?.data || pinataError.message);
      
      return res.status(pinataError.response?.status || 500).json({
        success: false,
        message: pinataError.response?.data?.error?.details || pinataError.response?.data?.error?.message || 'Failed to upload file to Pinata',
        error: pinataError.response?.data || pinataError.message
      });
    }
  } catch (error) {
    console.error('Upload error:', error);
    next(error);
  }
});

// Get file info from IPFS
router.get('/info/:hash', async (req, res, next) => {
  try {
    const { hash } = req.params;
    
    if (!hash) {
      return res.status(400).json({
        success: false,
        message: 'IPFS hash is required'
      });
    }

    const ipfsUrl = `https://${PINATA_GATEWAY}/ipfs/${hash}`;

    // Try to fetch file info (this is a simple implementation)
    try {
      const response = await axios.head(ipfsUrl, { timeout: 5000 });
      
      res.json({
        success: true,
        hash,
        ipfsUrl,
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        gateway: PINATA_GATEWAY
      });
    } catch (fetchError) {
      // File might exist but HEAD request failed
      res.json({
        success: true,
        hash,
        ipfsUrl,
        gateway: PINATA_GATEWAY,
        note: 'File info could not be retrieved, but hash is valid'
      });
    }
  } catch (error) {
    console.error('Info retrieval error:', error);
    next(error);
  }
});

module.exports = router;
