# Deployment Scripts

## EC2 Deployment

### Quick Deploy Script

1. **On your local machine:**
   ```bash
   # Copy backend to EC2
   scp -i your-key.pem -r backend/ ec2-user@your-ec2-ip:~/
   ```

2. **On EC2 instance:**
   ```bash
   cd backend
   chmod +x ../deploy/ec2-deploy.sh
   ../deploy/ec2-deploy.sh
   ```

### Manual Deployment

```bash
# Install dependencies
npm install

# Install PM2
npm install -g pm2

# Start application
pm2 start server.js --name healthchain-backend
pm2 save
pm2 startup
```

## Amplify Deployment

### Build Configuration

The `amplify-build.yml` file is already configured. When you connect Amplify to your GitHub repo, it will automatically use this configuration.

### Environment Variables

Add these in Amplify Console:
- `REACT_APP_API_URL` - Your backend API URL

## Deployment Checklist

- [ ] Backend tested locally
- [ ] Frontend tested locally
- [ ] Code pushed to GitHub
- [ ] EC2 instance created
- [ ] DynamoDB table created
- [ ] AWS credentials configured
- [ ] Security groups configured
- [ ] PM2 installed and configured
- [ ] Amplify app connected to GitHub
- [ ] Environment variables set
- [ ] Both frontend and backend accessible

