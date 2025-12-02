import React, { useState, useEffect } from 'react';
import './AuditLogViewer.css';

const AuditLogViewer = ({ contract, account, patientID: propPatientID, onPatientIDChange }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [localPatientID, setLocalPatientID] = useState(propPatientID || '');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    actionType: '',
    providerSearch: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Use propPatientID if provided, otherwise use local state
  const patientID = propPatientID || localPatientID;

  useEffect(() => {
    // Only fetch if we have both contract and a non-empty patientID
    if (contract && patientID && patientID.trim() !== '') {
      fetchAuditLogs();
    } else {
      // Clear logs if conditions aren't met
      setLogs([]);
      if (!contract) {
        setError('Smart contract not loaded. Please connect your wallet.');
      } else if (!patientID || patientID.trim() === '') {
        setError('Please enter a Patient ID in the Blockchain section to view audit logs.');
      }
    }
  }, [contract, patientID, account]);

  const fetchAuditLogs = async () => {
    if (!contract) {
      setError('Smart contract not loaded. Please connect your wallet.');
      return;
    }
    
    if (!patientID || patientID.trim() === '') {
      setError('Please enter a Patient ID to view audit logs.');
      setLogs([]);
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      console.log('Fetching audit logs for patient:', patientID);
      let result;
      
      if (filters.startDate && filters.endDate) {
        const startTime = Math.floor(new Date(filters.startDate).getTime() / 1000);
        const endTime = Math.floor(new Date(filters.endDate).getTime() / 1000);
        console.log('Using date range filter:', { startTime, endTime });
        result = await contract.methods
          .getAccessHistoryByDateRange(patientID, startTime, endTime)
          .call({ from: account });
      } else {
        console.log('Fetching all audit logs');
        result = await contract.methods
          .getPatientAuditTrail(patientID)
          .call({ from: account });
      }
      
      console.log('Audit log result:', result);
      
      // Handle the result - it might be an object with arrays or just arrays
      let timestamps, actors, actionTypes, successes, providers, details;
      
      if (Array.isArray(result)) {
        // If result is an array of arrays
        [timestamps, actors, actionTypes, successes, providers, details] = result;
      } else {
        // If result is an object
        timestamps = result.timestamps || result[0] || [];
        actors = result.actors || result[1] || [];
        actionTypes = result.actionTypes || result[2] || [];
        successes = result.successes || result[3] || [];
        providers = result.providers || result[4] || [];
        details = result.details || result[5] || [];
      }
      
      console.log('Parsed audit log data:', {
        timestamps: timestamps?.length || 0,
        actors: actors?.length || 0,
        actionTypes: actionTypes?.length || 0
      });
      
      if (!timestamps || timestamps.length === 0) {
        setLogs([]);
        setError('No audit logs found for this patient. Perform some actions (register patient, grant access, etc.) to generate logs.');
        return;
      }
      
      let auditLogs = timestamps.map((timestamp, index) => ({
        timestamp: parseInt(timestamp),
        actor: actors[index] || '0x0000000000000000000000000000000000000000',
        actionType: actionTypes[index] || 'UNKNOWN',
        success: successes[index] !== undefined ? successes[index] : true,
        provider: providers[index] || '0x0000000000000000000000000000000000000000',
        details: details[index] || ''
      }));
      
      // Apply filters
      if (filters.actionType) {
        auditLogs = auditLogs.filter(log => 
          log.actionType.toLowerCase().includes(filters.actionType.toLowerCase())
        );
      }
      
      if (filters.providerSearch) {
        auditLogs = auditLogs.filter(log => 
          log.provider.toLowerCase().includes(filters.providerSearch.toLowerCase())
        );
      }
      
      // Sort by timestamp (newest first)
      auditLogs.sort((a, b) => b.timestamp - a.timestamp);
      
      setLogs(auditLogs);
      if (auditLogs.length === 0) {
        setError('No audit logs found for this patient.');
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        data: err.data
      });
      
      let errorMessage = 'Failed to fetch audit logs. ';
      if (err.message) {
        if (err.message.includes('Patient does not exist')) {
          errorMessage += 'Patient not found. Please register the patient first.';
        } else if (err.message.includes('Unauthorized')) {
          errorMessage += 'You do not have access to view this patient\'s audit logs.';
        } else {
          errorMessage += err.message;
        }
      } else {
        errorMessage += 'Make sure the patient ID is correct and you have access.';
      }
      
      setError(errorMessage);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(parseInt(timestamp) * 1000).toLocaleString();
  };

  const getActionTypeColor = (actionType) => {
    const colors = {
      'GRANT': '#4caf50',
      'REVOKE': '#f44336',
      'EMERGENCY_REQUEST': '#ff9800',
      'EMERGENCY_GRANTED': '#ff5722',
      'REGISTER': '#2196f3',
      'ACCESS_CHECK': '#9c27b0',
      'FILE_STORED': '#00bcd4'
    };
    return colors[actionType] || '#757575';
  };

  const handleFilterChange = (e) => {
    setFilters({
      ...filters,
      [e.target.name]: e.target.value
    });
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      actionType: '',
      providerSearch: ''
    });
    setCurrentPage(1);
    fetchAuditLogs();
  };

  // Pagination
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLogs = logs.slice(startIndex, endIndex);

  const handlePatientIDChange = (e) => {
    const newID = e.target.value;
    setLocalPatientID(newID);
    if (onPatientIDChange) {
      onPatientIDChange(newID);
    }
  };

  return (
    <div className="audit-log-viewer">
      <h3>Audit Log Viewer</h3>
      
      {!contract && (
        <div className="error-message">
          ⚠️ Smart contract not loaded. Please connect your MetaMask wallet.
        </div>
      )}
      
      {contract && (
        <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Patient ID:
          </label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={patientID}
              onChange={handlePatientIDChange}
              placeholder="Enter Patient ID (e.g., PATIENT001)"
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <button
              onClick={fetchAuditLogs}
              disabled={!patientID || patientID.trim() === '' || loading}
              style={{
                padding: '8px 16px',
                backgroundColor: patientID && patientID.trim() !== '' ? '#6366f1' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: patientID && patientID.trim() !== '' ? 'pointer' : 'not-allowed',
                fontSize: '14px'
              }}
            >
              {loading ? 'Loading...' : 'Load Logs'}
            </button>
          </div>
          {patientID && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Viewing audit logs for: <strong>{patientID}</strong>
            </div>
          )}
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="filters-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>Start Date:</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>End Date:</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>
          <div className="filter-group">
            <label>Action Type:</label>
            <select
              name="actionType"
              value={filters.actionType}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              <option value="GRANT">Grant</option>
              <option value="REVOKE">Revoke</option>
              <option value="EMERGENCY_REQUEST">Emergency Request</option>
              <option value="EMERGENCY_GRANTED">Emergency Granted</option>
              <option value="REGISTER">Register</option>
              <option value="ACCESS_CHECK">Access Check</option>
              <option value="FILE_STORED">File Stored</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Provider Address:</label>
            <input
              type="text"
              name="providerSearch"
              value={filters.providerSearch}
              onChange={handleFilterChange}
              placeholder="Search provider..."
            />
          </div>
        </div>
        <div className="filter-actions">
          <button onClick={handleApplyFilters} className="filter-button">
            Apply Filters
          </button>
          <button onClick={handleClearFilters} className="filter-button secondary">
            Clear
          </button>
          <button onClick={fetchAuditLogs} className="filter-button">
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading audit logs...</div>
      ) : (
        <>
          <div className="audit-table-container">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Provider Address</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="no-data">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  paginatedLogs.map((log, index) => (
                    <tr key={index}>
                      <td>{formatTimestamp(log.timestamp)}</td>
                      <td>
                        <span
                          className="action-badge"
                          style={{ backgroundColor: getActionTypeColor(log.actionType) }}
                        >
                          {log.actionType}
                        </span>
                      </td>
                      <td className="address-cell">
                        {log.provider !== '0x0000000000000000000000000000000000000000' 
                          ? `${log.provider.substring(0, 6)}...${log.provider.substring(38)}`
                          : 'N/A'}
                      </td>
                      <td>
                        <span className={`status-badge ${log.success ? 'success' : 'failure'}`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="details-cell">{log.details || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="page-button"
              >
                Previous
              </button>
              <span className="page-info">
                Page {currentPage} of {totalPages} ({logs.length} total logs)
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="page-button"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogViewer;

