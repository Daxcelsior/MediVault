import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import './FileList.css';

const FileList = ({ contract, account, patientID, encryptionKey }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [decrypting, setDecrypting] = useState({});

  useEffect(() => {
    if (contract && account && patientID) {
      fetchFiles();
    }
  }, [contract, account, patientID]);

  const fetchFiles = async () => {
    if (!contract || !patientID) return;
    
    setLoading(true);
    setError('');
    
    try {
      const result = await contract.methods
        .getPatientFiles(patientID)
        .call({ from: account });
      
      const { ipfsHashes, fileNames, uploadTimestamps, uploadedBy } = result;
      
      const fileList = ipfsHashes.map((hash, index) => ({
        ipfsHash: hash,
        fileName: fileNames[index],
        uploadTimestamp: parseInt(uploadTimestamps[index]),
        uploadedBy: uploadedBy[index]
      }));
      
      setFiles(fileList);
    } catch (err) {
      console.error('Error fetching files:', err);
      setError('Failed to fetch files. Make sure you have access to this patient.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
  };

  const downloadFile = async (file, encrypted = false) => {
    try {
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${file.ipfsHash}`;
      
      if (encrypted && !encryptionKey) {
        alert('Encryption key is required to decrypt this file');
        return;
      }

      setDecrypting({ ...decrypting, [file.ipfsHash]: true });

      const response = await fetch(ipfsUrl);
      const encryptedData = await response.text();

      if (encrypted) {
        try {
          const decrypted = CryptoJS.AES.decrypt(encryptedData, encryptionKey).toString(CryptoJS.enc.Utf8);
          
          if (!decrypted) {
            throw new Error('Decryption failed. Invalid key or corrupted data.');
          }

          // Convert base64 to blob
          const byteCharacters = atob(decrypted.split(',')[1] || decrypted);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray]);
          
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.fileName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } catch (decryptError) {
          alert('Failed to decrypt file. Please check your encryption key.');
          console.error('Decryption error:', decryptError);
        }
      } else {
        // Direct download for unencrypted files
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download file. Please try again.');
    } finally {
      setDecrypting({ ...decrypting, [file.ipfsHash]: false });
    }
  };

  const viewFile = (file) => {
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${file.ipfsHash}`;
    window.open(ipfsUrl, '_blank');
  };

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <h3>Patient Files</h3>
        <button onClick={fetchFiles} className="refresh-button" disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading && files.length === 0 ? (
        <div className="loading">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="no-files">No files found for this patient.</div>
      ) : (
        <div className="file-table-container">
          <table className="file-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Upload Date</th>
                <th>IPFS Hash</th>
                <th>Uploaded By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file, index) => (
                <tr key={index}>
                  <td className="file-name-cell">
                    <strong>{file.fileName}</strong>
                  </td>
                  <td>{formatTimestamp(file.uploadTimestamp)}</td>
                  <td className="hash-cell">
                    <code>{file.ipfsHash.substring(0, 12)}...</code>
                  </td>
                  <td className="address-cell">
                    {file.uploadedBy !== '0x0000000000000000000000000000000000000000'
                      ? `${file.uploadedBy.substring(0, 6)}...${file.uploadedBy.substring(38)}`
                      : 'N/A'}
                  </td>
                  <td className="actions-cell">
                    <button
                      onClick={() => viewFile(file)}
                      className="action-btn view-btn"
                      title="View file"
                    >
                      👁️ View
                    </button>
                    <button
                      onClick={() => downloadFile(file, false)}
                      className="action-btn download-btn"
                      disabled={decrypting[file.ipfsHash]}
                      title="Download file"
                    >
                      {decrypting[file.ipfsHash] ? '⏳' : '⬇️'} Download
                    </button>
                    {encryptionKey && (
                      <button
                        onClick={() => downloadFile(file, true)}
                        className="action-btn decrypt-btn"
                        disabled={decrypting[file.ipfsHash]}
                        title="Download and decrypt"
                      >
                        {decrypting[file.ipfsHash] ? '🔓 Decrypting...' : '🔓 Decrypt'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FileList;

