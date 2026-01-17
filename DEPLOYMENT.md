# Deployment Guide

## Architecture

This application consists of two parts:
1. **Frontend** - React/Vite static site (deployed at `journey.dnalevity.com`)
2. **Backend** - Node.js/Express API server (needs to be deployed separately)

## Backend Server Deployment

The backend server (`server/`) needs to be deployed separately and made accessible. You have several options:

### Option 1: Deploy to a separate server/domain

1. Deploy the Node.js server to a hosting service (e.g., Railway, Render, Fly.io, DigitalOcean, AWS, etc.)
2. Set the `VITE_API_URL` environment variable during frontend build to point to your server:
   ```bash
   VITE_API_URL=https://api.yourdomain.com npm run build
   ```

### Option 2: Deploy to same domain with reverse proxy

If you control the web server (nginx, Apache, etc.), you can proxy API requests:

**Nginx example:**
```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Then deploy the Node.js server on the same machine and run it on port 3001.

### Option 3: Runtime API URL configuration

You can set the API URL at runtime by adding this to your `index.html` before the app loads:

```html
<script>
  window.__API_URL__ = 'https://your-api-server.com';
</script>
```

## Environment Variables

### Frontend Build Time
- `VITE_API_URL` - Full URL to the API server (e.g., `https://api.example.com`)

### Backend Runtime
- `OPENAI_API_KEY` - Your OpenAI API key for journey generation
- `PORT` - Server port (default: 3001)

## Building and Deploying

### Frontend
```bash
npm run build
# Deploy the `dist/` folder to your static hosting
```

### Backend
```bash
npm run build:server
npm run start:server
# Or use a process manager like PM2, systemd, etc.
```

## Current Issue

If you're getting 404 errors, it means:
1. The Node.js server is not deployed/running
2. The server is deployed but not accessible at the expected URL
3. You need to set `VITE_API_URL` to point to where the server is actually deployed

To fix:
1. Deploy the server somewhere (Railway, Render, Fly.io, etc.)
2. Set `VITE_API_URL` during build or use the runtime configuration method above
3. Rebuild and redeploy the frontend
