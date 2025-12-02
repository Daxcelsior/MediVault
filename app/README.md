# HealthChain Access Control Frontend

React frontend application for HealthChain Access Control with authentication and IPFS image upload.

## Features

- User authentication (Register, Login, Logout)
- Blockchain integration with Web3
- IPFS image upload functionality
- Modern, responsive UI

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the `app` directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

If your backend is running on a different port or URL, update this accordingly.

### 3. Start the Development Server

```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

## Backend Setup

Make sure the backend server is running. See `../backend/README.md` for backend setup instructions.

## Usage

1. **Register/Login**: Create an account or login with existing credentials
2. **Blockchain Tab**: Interact with the smart contract (requires MetaMask)
3. **IPFS Upload Tab**: Upload images to IPFS (requires backend to be configured with Pinata)

## Project Structure

```
app/
├── src/
│   ├── components/
│   │   ├── Login.js          # Login component
│   │   ├── Register.js       # Registration component
│   │   ├── IPFSUpload.js     # IPFS upload component
│   │   ├── Auth.css          # Authentication styles
│   │   └── IPFSUpload.css    # IPFS upload styles
│   ├── services/
│   │   └── api.js            # API service layer
│   ├── App.js                # Main app component
│   └── App.css               # Main app styles
└── package.json
```
