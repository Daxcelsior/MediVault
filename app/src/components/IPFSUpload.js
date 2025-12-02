import React, { useState, useRef } from 'react';
import { ipfsAPI } from '../services/api';
import CryptoJS from 'crypto-js';
import './IPFSUpload.css';

const IPFSUpload = ({ contract, account, patientID, onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [useEncryption, setUseEncryption] = useState(true);
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Generate encryption key from patient key (in production, use secure key management)
  const generateEncryptionKey = () => {
    if (!account) {
      return CryptoJS.lib.WordArray.random(256/8).toString();
    }
    // Use account address as seed for key generation
    return CryptoJS.SHA256(account + patientID).toString();
  };

  const handleFileChange = (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('application/')) {
      setError('Please select an image or document file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setError('');
    setResult(null);
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    // Generate encryption key if not set
    if (useEncryption && !encryptionKey) {
      setEncryptionKey(generateEncryptionKey());
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0]);
    }
  };

  const encryptFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const fileData = e.target.result;
          const encrypted = CryptoJS.AES.encrypt(fileData, encryptionKey).toString();
          const encryptedBlob = new Blob([encrypted], { type: 'text/plain' });
          resolve(encryptedBlob);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file');
      return;
    }

    if (useEncryption && !encryptionKey) {
      setError('Encryption key is required');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);
    setUploadProgress(0);

    try {
      let fileToUpload = selectedFile;
      
      // Encrypt file if encryption is enabled
      if (useEncryption) {
        setUploadProgress(25);
        fileToUpload = await encryptFile(selectedFile);
        // Create a new File object with encrypted data
        const encryptedFile = new File(
          [fileToUpload],
          selectedFile.name + '.encrypted',
          { type: 'text/plain' }
        );
        fileToUpload = encryptedFile;
        setUploadProgress(50);
      }

      const formData = new FormData();
      formData.append('image', fileToUpload);

      // Simulate progress (since axios doesn't support upload progress easily)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 90) return prev + 5;
          return prev;
        });
      }, 200);

      const response = await ipfsAPI.uploadImage(formData);
      
      clearInterval(progressInterval);
      setUploadProgress(100);

      const { ipfsHash, ipfsUrl } = response.data;

      // Store file metadata on blockchain if contract is available
      if (contract && account && patientID) {
        try {
          await contract.methods
            .storeFileHash(patientID, ipfsHash, selectedFile.name)
            .send({ from: account });
        } catch (blockchainError) {
          console.error('Failed to store on blockchain:', blockchainError);
          // Continue even if blockchain storage fails
        }
      }

      setResult({
        ...response.data,
        fileName: selectedFile.name,
        encrypted: useEncryption,
        encryptionKey: useEncryption ? encryptionKey : null
      });

      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setSelectedFile(null);
        setPreview(null);
        setUploadProgress(0);
      }, 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload file. Please try again.');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setUploadProgress(0);
    setEncryptionKey('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="ipfs-upload-container">
      <div className="ipfs-upload-card">
        <h2>Upload File to IPFS</h2>
        
        {error && <div className="error-message">{error}</div>}
        
        {result && (
          <div className="success-message">
            <h3>Upload Successful!</h3>
            <p><strong>File Name:</strong> {result.fileName}</p>
            <p><strong>IPFS Hash:</strong> 
              <code className="hash-code">{result.ipfsHash}</code>
            </p>
            <p><strong>IPFS URL:</strong> 
              <a href={result.ipfsUrl} target="_blank" rel="noopener noreferrer">
                {result.ipfsUrl}
              </a>
            </p>
            {result.encrypted && (
              <div className="encryption-info">
                <p><strong>⚠️ File is encrypted</strong></p>
                <p><strong>Encryption Key:</strong> 
                  <code className="key-code">{result.encryptionKey}</code>
                </p>
                <p className="key-warning">Save this key to decrypt the file later!</p>
              </div>
            )}
            {preview && result.ipfsUrl && (
              <div className="image-preview">
                <img src={result.ipfsUrl} alt="Uploaded" />
              </div>
            )}
            <button onClick={handleReset} className="reset-button">
              Upload Another File
            </button>
          </div>
        )}

        {!result && (
          <>
            <div className="encryption-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={useEncryption}
                  onChange={(e) => setUseEncryption(e.target.checked)}
                />
                Encrypt file before upload (AES-256)
              </label>
            </div>

            <div
              ref={dropZoneRef}
              className={`file-drop-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                id="file-input"
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileInputChange}
                className="file-input"
              />
              <label htmlFor="file-input" className="file-input-label">
                <div className="drop-zone-content">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <p>Drag and drop a file here, or click to select</p>
                  <p className="file-hint">Supports images and documents (max 10MB)</p>
                </div>
              </label>
            </div>

            {selectedFile && (
              <div className="file-info-card">
                <div className="file-details">
                  <strong>{selectedFile.name}</strong>
                  <span>{formatFileSize(selectedFile.size)}</span>
                  {useEncryption && (
                    <span className="encryption-badge">🔒 Encrypted</span>
                  )}
                </div>
                {preview && (
                  <div className="image-preview-small">
                    <img src={preview} alt="Preview" />
                  </div>
                )}
              </div>
            )}

            {uploading && (
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="progress-text">{uploadProgress}% uploaded</p>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="upload-button"
            >
              {uploading ? `Uploading... ${uploadProgress}%` : 'Upload to IPFS'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default IPFSUpload;
