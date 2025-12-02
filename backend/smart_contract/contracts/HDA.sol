// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PatientDataAccess {
    
    // AccessPermission struct with expiration and emergency flags
    struct AccessPermission {
        bool granted;
        uint256 expiresAt;
        bool isEmergency;
        uint256 grantedAt;
    }

    // Patient structure containing health data and access permissions
    struct Patient {
        string name;
        uint age;
        address patientAddress;
        mapping(address => AccessPermission) accessList;
        bool exists;
    }

    // AuditLog struct for compliance tracking
    struct AuditLog {
        uint256 timestamp;
        address actor;
        string patientID;
        string actionType; // "REGISTER", "GRANT", "REVOKE", "EMERGENCY_REQUEST", "EMERGENCY_GRANTED", "ACCESS_CHECK", "FILE_STORED"
        bool success;
        address provider;
        string details;
    }

    // File metadata struct
    struct FileMetadata {
        string ipfsHash;
        string fileName;
        uint256 uploadTimestamp;
        string patientID;
        address uploadedBy;
    }

    // Emergency access request struct
    struct EmergencyRequest {
        address provider;
        string patientID;
        string reason;
        uint256 requestedAt;
        bool approved;
    }

    // Mapping of patient IDs to Patient struct
    mapping(string => Patient) private patients;
    
    // Mapping of patient IDs to emergency requests
    mapping(string => EmergencyRequest[]) private emergencyRequests;
    
    // Audit trail array
    AuditLog[] private auditTrail;
    
    // Mapping of patient IDs to file metadata arrays
    mapping(string => FileMetadata[]) private patientFiles;
    
    // Events
    event PatientRegistered(string indexed patientID, address indexed patientAddress, string name, uint age);
    event AccessGranted(string indexed patientID, address indexed provider, uint256 expiresAt, bool isEmergency);
    event AccessRevoked(string indexed patientID, address indexed provider);
    event EmergencyRequested(string indexed patientID, address indexed provider, string reason);
    event EmergencyGranted(string indexed patientID, address indexed provider);
    event AccessChecked(string indexed patientID, address indexed provider, bool hasAccess);
    event FileStored(string indexed patientID, string ipfsHash, string fileName, address indexed uploadedBy);
    event AuditLogged(string indexed patientID, address indexed actor, string actionType, bool success);

    // Internal function to record audit actions
    function recordAction(
        address actor,
        string memory patientID,
        string memory actionType,
        bool success,
        address provider,
        string memory details
    ) internal {
        auditTrail.push(AuditLog({
            timestamp: block.timestamp,
            actor: actor,
            patientID: patientID,
            actionType: actionType,
            success: success,
            provider: provider,
            details: details
        }));
        emit AuditLogged(patientID, actor, actionType, success);
    }

    // Registers a new patient
    function registerPatient(string memory patientID, string memory name, uint age) public {
        require(bytes(patientID).length > 0, "Patient ID cannot be empty");
        require(bytes(name).length > 0, "Name cannot be empty");
        require(age > 0, "Age must be greater than 0");
        
        // Avoid re-registering
        if (patients[patientID].exists) {
            recordAction(msg.sender, patientID, "REGISTER", false, address(0), "Patient already exists");
            return;
        }

        Patient storage newPatient = patients[patientID];
        newPatient.name = name;
        newPatient.age = age;
        newPatient.patientAddress = msg.sender;
        newPatient.exists = true;
        
        recordAction(msg.sender, patientID, "REGISTER", true, address(0), string(abi.encodePacked("Registered: ", name)));
        emit PatientRegistered(patientID, msg.sender, name, age);
    }

    // Allows patient to grant access to a healthcare provider (permanent access)
    function grantAccess(string memory patientID, address providerID) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(patients[patientID].patientAddress == msg.sender, "Only patient can grant access");
        require(providerID != address(0), "Invalid provider address");
        
        Patient storage patient = patients[patientID];
        patient.accessList[providerID] = AccessPermission({
            granted: true,
            expiresAt: 0, // 0 means no expiration (permanent)
            isEmergency: false,
            grantedAt: block.timestamp
        });
        
        recordAction(msg.sender, patientID, "GRANT", true, providerID, "Permanent access granted");
        emit AccessGranted(patientID, providerID, 0, false);
    }

    // Allows patient to grant access with expiration
    function grantAccessWithExpiry(
        string memory patientID,
        address providerID,
        uint256 expiryDurationSeconds
    ) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(patients[patientID].patientAddress == msg.sender, "Only patient can grant access");
        require(providerID != address(0), "Invalid provider address");
        require(expiryDurationSeconds > 0, "Expiry duration must be greater than 0");
        
        Patient storage patient = patients[patientID];
        uint256 expiresAt = block.timestamp + expiryDurationSeconds;
        
        patient.accessList[providerID] = AccessPermission({
            granted: true,
            expiresAt: expiresAt,
            isEmergency: false,
            grantedAt: block.timestamp
        });
        
        recordAction(msg.sender, patientID, "GRANT", true, providerID, string(abi.encodePacked("Access granted, expires at: ", uint2str(expiresAt))));
        emit AccessGranted(patientID, providerID, expiresAt, false);
    }

    // Allows patient to revoke access from a healthcare provider
    function revokeAccess(string memory patientID, address providerID) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(patients[patientID].patientAddress == msg.sender, "Only patient can revoke access");
        
        Patient storage patient = patients[patientID];
        patient.accessList[providerID].granted = false;
        
        recordAction(msg.sender, patientID, "REVOKE", true, providerID, "Access revoked");
        emit AccessRevoked(patientID, providerID);
    }

    // Provider requests emergency access
    function requestEmergencyAccess(string memory patientID, string memory reason) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(msg.sender != address(0), "Invalid provider address");
        require(bytes(reason).length > 0, "Reason cannot be empty");
        
        emergencyRequests[patientID].push(EmergencyRequest({
            provider: msg.sender,
            patientID: patientID,
            reason: reason,
            requestedAt: block.timestamp,
            approved: false
        }));
        
        recordAction(msg.sender, patientID, "EMERGENCY_REQUEST", true, msg.sender, reason);
        emit EmergencyRequested(patientID, msg.sender, reason);
    }

    // Patient grants emergency access (auto-expires after 24 hours)
    function grantEmergencyAccess(string memory patientID, address providerID) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(patients[patientID].patientAddress == msg.sender, "Only patient can grant emergency access");
        require(providerID != address(0), "Invalid provider address");
        
        Patient storage patient = patients[patientID];
        uint256 expiresAt = block.timestamp + 24 hours; // 24 hours expiration
        
        patient.accessList[providerID] = AccessPermission({
            granted: true,
            expiresAt: expiresAt,
            isEmergency: true,
            grantedAt: block.timestamp
        });
        
        // Mark emergency request as approved
        EmergencyRequest[] storage requests = emergencyRequests[patientID];
        for (uint i = 0; i < requests.length; i++) {
            if (requests[i].provider == providerID && !requests[i].approved) {
                requests[i].approved = true;
                break;
            }
        }
        
        recordAction(msg.sender, patientID, "EMERGENCY_GRANTED", true, providerID, "Emergency access granted for 24 hours");
        emit EmergencyGranted(patientID, providerID);
        emit AccessGranted(patientID, providerID, expiresAt, true);
    }

    // Checks if a provider has access to a patient's record (with expiration check)
    function checkAccess(string memory patientID, address providerID) public view returns (bool) {
        Patient storage patient = patients[patientID];

        if (!patient.exists) {
            return false;
        }
        
        AccessPermission memory permission = patient.accessList[providerID];
        
        // Check if access is granted
        if (!permission.granted) {
            return false;
        }
        
        // Check if access has expired (0 means no expiration)
        if (permission.expiresAt > 0 && block.timestamp >= permission.expiresAt) {
            return false;
        }
        
        return true;
    }

    // Get access history for a patient
    // Note: This function is kept for interface compatibility but redirects to audit trail
    // Solidity doesn't allow iterating over mappings, so we use audit logs instead
    function getAccessHistory(string memory patientID) public view returns (
        address[] memory /* providers */,
        bool[] memory /* hasAccess */,
        uint256[] memory /* expiresAt */,
        bool[] memory /* isEmergency */,
        uint256[] memory /* grantedAt */
    ) {
        require(patients[patientID].exists, "Patient does not exist");
        // Note: This is a simplified version. In production, you'd need to maintain a list of providers
        // For now, this function structure is provided but would need additional storage to track all providers
        // This is a limitation of Solidity - we can't iterate over mappings
        revert("Use getPatientAuditTrail for access history");
    }

    // Get patient audit trail
    function getPatientAuditTrail(string memory patientID) public view returns (
        uint256[] memory timestamps,
        address[] memory actors,
        string[] memory actionTypes,
        bool[] memory successes,
        address[] memory providers,
        string[] memory details
    ) {
        uint256 count = 0;
        
        // Count matching logs
        for (uint i = 0; i < auditTrail.length; i++) {
            if (keccak256(bytes(auditTrail[i].patientID)) == keccak256(bytes(patientID))) {
                count++;
            }
        }
        
        // Initialize arrays
        timestamps = new uint256[](count);
        actors = new address[](count);
        actionTypes = new string[](count);
        successes = new bool[](count);
        providers = new address[](count);
        details = new string[](count);
        
        // Populate arrays
        uint256 index = 0;
        for (uint i = 0; i < auditTrail.length; i++) {
            if (keccak256(bytes(auditTrail[i].patientID)) == keccak256(bytes(patientID))) {
                timestamps[index] = auditTrail[i].timestamp;
                actors[index] = auditTrail[i].actor;
                actionTypes[index] = auditTrail[i].actionType;
                successes[index] = auditTrail[i].success;
                providers[index] = auditTrail[i].provider;
                details[index] = auditTrail[i].details;
                index++;
            }
        }
    }

    // Get access history by date range
    function getAccessHistoryByDateRange(
        string memory patientID,
        uint256 startTime,
        uint256 endTime
    ) public view returns (
        uint256[] memory timestamps,
        address[] memory actors,
        string[] memory actionTypes,
        bool[] memory successes,
        address[] memory providers,
        string[] memory details
    ) {
        require(startTime <= endTime, "Invalid date range");
        
        uint256 count = 0;
        
        // Count matching logs
        for (uint i = 0; i < auditTrail.length; i++) {
            if (keccak256(bytes(auditTrail[i].patientID)) == keccak256(bytes(patientID)) &&
                auditTrail[i].timestamp >= startTime &&
                auditTrail[i].timestamp <= endTime) {
                count++;
            }
        }
        
        // Initialize arrays
        timestamps = new uint256[](count);
        actors = new address[](count);
        actionTypes = new string[](count);
        successes = new bool[](count);
        providers = new address[](count);
        details = new string[](count);
        
        // Populate arrays
        uint256 index = 0;
        for (uint i = 0; i < auditTrail.length; i++) {
            if (keccak256(bytes(auditTrail[i].patientID)) == keccak256(bytes(patientID)) &&
                auditTrail[i].timestamp >= startTime &&
                auditTrail[i].timestamp <= endTime) {
                timestamps[index] = auditTrail[i].timestamp;
                actors[index] = auditTrail[i].actor;
                actionTypes[index] = auditTrail[i].actionType;
                successes[index] = auditTrail[i].success;
                providers[index] = auditTrail[i].provider;
                details[index] = auditTrail[i].details;
                index++;
            }
        }
    }

    // Store file metadata on blockchain
    function storeFileHash(
        string memory patientID,
        string memory ipfsHash,
        string memory fileName
    ) public {
        require(patients[patientID].exists, "Patient does not exist");
        require(bytes(ipfsHash).length > 0, "IPFS hash cannot be empty");
        require(bytes(fileName).length > 0, "File name cannot be empty");
        
        // Check if caller has access (patient or authorized provider)
        bool hasAccess = false;
        if (patients[patientID].patientAddress == msg.sender) {
            hasAccess = true;
        } else {
            hasAccess = checkAccess(patientID, msg.sender);
        }
        
        require(hasAccess, "Unauthorized: Only patient or authorized providers can store files");
        
        patientFiles[patientID].push(FileMetadata({
            ipfsHash: ipfsHash,
            fileName: fileName,
            uploadTimestamp: block.timestamp,
            patientID: patientID,
            uploadedBy: msg.sender
        }));
        
        recordAction(msg.sender, patientID, "FILE_STORED", true, msg.sender, string(abi.encodePacked("File stored: ", fileName)));
        emit FileStored(patientID, ipfsHash, fileName, msg.sender);
    }

    // Get all files for a patient
    function getPatientFiles(string memory patientID) public view returns (
        string[] memory ipfsHashes,
        string[] memory fileNames,
        uint256[] memory uploadTimestamps,
        address[] memory uploadedBy
    ) {
        require(patients[patientID].exists, "Patient does not exist");
        
        // Check if caller has access
        bool hasAccess = false;
        if (patients[patientID].patientAddress == msg.sender) {
            hasAccess = true;
        } else {
            hasAccess = checkAccess(patientID, msg.sender);
        }
        
        require(hasAccess, "Unauthorized: Only patient or authorized providers can view files");
        
        FileMetadata[] storage files = patientFiles[patientID];
        uint256 count = files.length;
        
        ipfsHashes = new string[](count);
        fileNames = new string[](count);
        uploadTimestamps = new uint256[](count);
        uploadedBy = new address[](count);
        
        for (uint i = 0; i < count; i++) {
            ipfsHashes[i] = files[i].ipfsHash;
            fileNames[i] = files[i].fileName;
            uploadTimestamps[i] = files[i].uploadTimestamp;
            uploadedBy[i] = files[i].uploadedBy;
        }
    }

    // Get emergency requests for a patient
    function getEmergencyRequests(string memory patientID) public view returns (
        address[] memory providers,
        string[] memory reasons,
        uint256[] memory requestedAt,
        bool[] memory approved
    ) {
        require(patients[patientID].exists, "Patient does not exist");
        require(
            patients[patientID].patientAddress == msg.sender,
            "Only patient can view emergency requests"
        );
        
        EmergencyRequest[] storage requests = emergencyRequests[patientID];
        uint256 count = requests.length;
        
        providers = new address[](count);
        reasons = new string[](count);
        requestedAt = new uint256[](count);
        approved = new bool[](count);
        
        for (uint i = 0; i < count; i++) {
            providers[i] = requests[i].provider;
            reasons[i] = requests[i].reason;
            requestedAt[i] = requests[i].requestedAt;
            approved[i] = requests[i].approved;
        }
    }

    // Helper function to convert uint to string (for events)
    function uint2str(uint _i) internal pure returns (string memory) {
        if (_i == 0) {
            return "0";
        }
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
