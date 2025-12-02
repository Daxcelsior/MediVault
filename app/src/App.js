import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import Web3 from "web3";
import ContractArtifact from "./PatientDataAccess.json";
import Login from "./components/Login";
import Register from "./components/Register";
import IPFSUpload from "./components/IPFSUpload";
import FileList from "./components/FileList";
import AuditLogViewer from "./components/AuditLogViewer";
import { authAPI } from "./services/api";

function App() {
  const [contract, setContract] = useState(null);
  const [account, setAccount] = useState("");
  const [patientID, setPatientID] = useState("");
  const [providerAddress, setProviderAddress] = useState("");
  const [message, setMessage] = useState("");
  
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showRegister, setShowRegister] = useState(false);
  const [activeTab, setActiveTab] = useState("blockchain");

  // New state for expiration and emergency access
  const [expiryDate, setExpiryDate] = useState("");
  const [expiryTime, setExpiryTime] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyRequests, setEmergencyRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [accessStatus, setAccessStatus] = useState(null);

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
      authAPI.getMe().catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
        setUser(null);
      });
    }
  }, []);

  useEffect(() => {
    const loadBlockchain = async () => {
      if (window.ethereum) {
        try {
          const _web3 = new Web3(window.ethereum);
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const accounts = await _web3.eth.getAccounts();
          const networkId = await _web3.eth.net.getId();
          const deployedNetwork = ContractArtifact.networks[networkId];

          if (deployedNetwork) {
            const instance = new _web3.eth.Contract(
              ContractArtifact.abi,
              deployedNetwork.address
            );
            setContract(instance);
            setAccount(accounts[0]);
            setMessage("Wallet connected.");
          } else {
            setMessage("Smart contract not deployed to detected network.");
          }
        } catch (err) {
          setMessage("Error connecting to MetaMask.");
          console.error(err);
        }
      } else {
        setMessage("Please install MetaMask.");
      }
    };

    loadBlockchain();
  }, []);

  const checkAccessStatus = useCallback(async () => {
    if (!contract || !patientID || !providerAddress) return;
    
    try {
      const hasAccess = await contract.methods
        .checkAccess(patientID, providerAddress)
        .call();
      
      setAccessStatus(hasAccess);
      
      // Note: Getting expiration time would require additional contract function
      // For now, we just show if access is granted
    } catch (error) {
      console.error('Error checking access status:', error);
    }
  }, [contract, patientID, providerAddress]);

  // Check access status periodically for countdown
  useEffect(() => {
    if (contract && patientID && providerAddress) {
      checkAccessStatus();
      const interval = setInterval(checkAccessStatus, 1000);
      return () => clearInterval(interval);
    }
  }, [contract, patientID, providerAddress, checkAccessStatus]);

  const handleLoginSuccess = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setShowRegister(false);
  };

  const handleRegisterSuccess = (userData) => {
    setIsAuthenticated(true);
    setUser(userData);
    setShowRegister(false);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const registerPatient = async () => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }
    
    setLoading(true);
    try {
      await contract.methods
        .registerPatient(patientID, "Daksh", 25)
        .send({ from: account });
      setMessage("Patient registered successfully.");
    } catch (error) {
      console.error(error);
      setMessage("Failed to register patient: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const grantAccess = async () => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }
    
    setLoading(true);
    try {
      await contract.methods
        .grantAccess(patientID, providerAddress)
        .send({ from: account });
      setMessage("Access granted successfully (permanent).");
      checkAccessStatus();
    } catch (error) {
      console.error(error);
      setMessage("Failed to grant access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const grantAccessWithExpiry = async () => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }

    if (!expiryDate || !expiryTime) {
      setMessage("Please select expiration date and time.");
      return;
    }

    setLoading(true);
    try {
      const expiryDateTime = new Date(`${expiryDate}T${expiryTime}`);
      const now = new Date();
      const expiryDurationSeconds = Math.floor((expiryDateTime.getTime() - now.getTime()) / 1000);

      if (expiryDurationSeconds <= 0) {
        setMessage("Expiration time must be in the future.");
        setLoading(false);
        return;
      }

      await contract.methods
        .grantAccessWithExpiry(patientID, providerAddress, expiryDurationSeconds)
        .send({ from: account });
      setMessage(`Access granted successfully. Expires on ${expiryDateTime.toLocaleString()}.`);
      checkAccessStatus();
    } catch (error) {
      console.error(error);
      setMessage("Failed to grant access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const revokeAccess = async () => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }
    
    setLoading(true);
    try {
      await contract.methods
        .revokeAccess(patientID, providerAddress)
        .send({ from: account });
      setMessage("Access revoked successfully.");
      checkAccessStatus();
    } catch (error) {
      console.error(error);
      setMessage("Failed to revoke access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async () => {
    if (!contract) {
      setMessage("Please connect your wallet first.");
      return;
    }
    
    setLoading(true);
    try {
      const result = await contract.methods
        .checkAccess(patientID, providerAddress)
        .call();
      setMessage(`Access for provider: ${result ? "GRANTED" : "DENIED"}`);
      checkAccessStatus();
    } catch (error) {
      console.error(error);
      setMessage("Failed to check access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const requestEmergencyAccess = async () => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }

    if (!emergencyReason.trim()) {
      setMessage("Please provide a reason for emergency access.");
      return;
    }

    setLoading(true);
    try {
      await contract.methods
        .requestEmergencyAccess(patientID, emergencyReason)
        .send({ from: account });
      setMessage("Emergency access requested successfully.");
      setEmergencyReason("");
      fetchEmergencyRequests();
    } catch (error) {
      console.error(error);
      setMessage("Failed to request emergency access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const grantEmergencyAccess = async (providerAddr) => {
    if (!contract || !account) {
      setMessage("Please connect your wallet first.");
      return;
    }

    setLoading(true);
    try {
      await contract.methods
        .grantEmergencyAccess(patientID, providerAddr || providerAddress)
        .send({ from: account });
      setMessage("Emergency access granted for 24 hours.");
      fetchEmergencyRequests();
      checkAccessStatus();
    } catch (error) {
      console.error(error);
      setMessage("Failed to grant emergency access: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  const fetchEmergencyRequests = useCallback(async () => {
    if (!contract || !account || !patientID) return;

    try {
      const result = await contract.methods
        .getEmergencyRequests(patientID)
        .call({ from: account });

      const { providers, reasons, requestedAt, approved } = result;
      
      const requests = providers.map((provider, index) => ({
        provider,
        reason: reasons[index],
        requestedAt: parseInt(requestedAt[index]),
        approved: approved[index]
      }));

      setEmergencyRequests(requests);
    } catch (error) {
      console.error('Error fetching emergency requests:', error);
    }
  }, [contract, account, patientID]);

  useEffect(() => {
    if (contract && account && patientID) {
      fetchEmergencyRequests();
    }
  }, [contract, account, patientID, fetchEmergencyRequests]);

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="App">
        {showRegister ? (
          <Register onRegisterSuccess={handleRegisterSuccess} />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
        <div className="auth-toggle">
          {showRegister ? (
            <p>
              Already have an account?{" "}
              <button onClick={() => setShowRegister(false)}>Login</button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button onClick={() => setShowRegister(true)}>Register</button>
            </p>
          )}
        </div>
      </div>
    );
  }

  // Main app content when authenticated
  return (
    <div className="App">
      <header className="app-header">
        <h1>HealthChain Access Control</h1>
        <div className="user-info">
          <span>Welcome, {user?.username || user?.email}!</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="tabs">
        <button
          className={activeTab === "blockchain" ? "tab active" : "tab"}
          onClick={() => setActiveTab("blockchain")}
        >
          Blockchain
        </button>
        <button
          className={activeTab === "ipfs" ? "tab active" : "tab"}
          onClick={() => setActiveTab("ipfs")}
        >
          IPFS Upload
        </button>
        <button
          className={activeTab === "files" ? "tab active" : "tab"}
          onClick={() => setActiveTab("files")}
        >
          Files
        </button>
        <button
          className={activeTab === "audit" ? "tab active" : "tab"}
          onClick={() => setActiveTab("audit")}
        >
          Audit Logs
        </button>
      </div>

      {activeTab === "blockchain" && (
        <div className="blockchain-section">
          <h2>Patient Data Access DApp</h2>
          {message && <p className={`message ${message.includes("successfully") ? "success" : ""}`}>{message}</p>}
          <p className="account-info">Connected Account: {account || "Not connected"}</p>

          {accessStatus !== null && (
            <div className={`access-status ${accessStatus ? "granted" : "denied"}`}>
              Access Status: {accessStatus ? "✅ GRANTED" : "❌ DENIED"}
            </div>
          )}

          <div className="form-section">
            <div className="input-group">
              <label>Patient ID:</label>
              <input
                type="text"
                placeholder="Enter Patient ID"
                value={patientID}
                onChange={(e) => setPatientID(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label>Provider Address:</label>
              <input
                type="text"
                placeholder="Enter Provider Address (0x...)"
                value={providerAddress}
                onChange={(e) => setProviderAddress(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="button-group">
              <button onClick={registerPatient} className="action-button" disabled={loading}>
                {loading ? "Processing..." : "Register Patient"}
              </button>
              <button onClick={checkAccess} className="action-button" disabled={loading}>
                {loading ? "Checking..." : "Check Access"}
              </button>
            </div>

            <div className="section-divider">
              <h3>Grant Access</h3>
            </div>

            <div className="button-group">
              <button onClick={grantAccess} className="action-button" disabled={loading}>
                {loading ? "Processing..." : "Grant Permanent Access"}
              </button>
            </div>

            <div className="input-group">
              <label>Expiration Date:</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="input-group">
              <label>Expiration Time:</label>
              <input
                type="time"
                value={expiryTime}
                onChange={(e) => setExpiryTime(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="button-group">
              <button onClick={grantAccessWithExpiry} className="action-button" disabled={loading}>
                {loading ? "Processing..." : "Grant Access with Expiry"}
              </button>
              <button onClick={revokeAccess} className="action-button revoke" disabled={loading}>
                {loading ? "Processing..." : "Revoke Access"}
              </button>
            </div>

            <div className="section-divider">
              <h3>Emergency Access</h3>
            </div>

            <div className="input-group">
              <label>Emergency Reason:</label>
              <textarea
                placeholder="Enter reason for emergency access request..."
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                className="input-field textarea"
                rows="3"
              />
            </div>

            <div className="button-group">
              <button onClick={requestEmergencyAccess} className="action-button emergency" disabled={loading}>
                {loading ? "Processing..." : "Request Emergency Access"}
              </button>
            </div>

            {emergencyRequests.length > 0 && (
              <div className="emergency-requests">
                <h4>Emergency Access Requests:</h4>
                {emergencyRequests.map((req, index) => (
                  <div key={index} className={`emergency-request-card ${req.approved ? "approved" : ""}`}>
                    <p><strong>Provider:</strong> {req.provider.substring(0, 6)}...{req.provider.substring(38)}</p>
                    <p><strong>Reason:</strong> {req.reason}</p>
                    <p><strong>Requested:</strong> {new Date(req.requestedAt * 1000).toLocaleString()}</p>
                    <p><strong>Status:</strong> {req.approved ? "✅ Approved" : "⏳ Pending"}</p>
                    {!req.approved && (
                      <button
                        onClick={() => grantEmergencyAccess(req.provider)}
                        className="action-button emergency-grant"
                        disabled={loading}
                      >
                        Grant Emergency Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "ipfs" && (
        <div className="ipfs-section">
          <IPFSUpload 
            contract={contract}
            account={account}
            patientID={patientID}
            onUploadSuccess={() => {
              setMessage("File uploaded successfully!");
            }}
          />
        </div>
      )}

      {activeTab === "files" && (
        <div className="files-section">
          <FileList 
            contract={contract}
            account={account}
            patientID={patientID}
          />
        </div>
      )}

      {activeTab === "audit" && (
        <div className="audit-section">
          <AuditLogViewer 
            contract={contract}
            account={account}
            patientID={patientID}
            onPatientIDChange={(newID) => setPatientID(newID)}
          />
        </div>
      )}
    </div>
  );
}

export default App;
