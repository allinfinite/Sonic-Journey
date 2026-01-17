# Vercel Deployment Setup

This guide explains how to deploy Sonic Journey to Vercel with auto-deployment from GitHub.

## Environment Variables

In your Vercel project settings, add the following environment variable:

### Required
- **`OPENAI_API_KEY`** - Your OpenAI API key (starts with `sk-...`)

### Optional
- **`VITE_API_URL`** - Only needed if you want to override the API URL (usually not needed since API routes are on the same domain)

## Setup Steps

1. **Connect GitHub Repository**
   - Go to Vercel Dashboard
   - Click "Add New Project"
   - Import your GitHub repository
   - Vercel will auto-detect the settings

2. **Set Environment Variables**
   - In Project Settings → Environment Variables
   - Add `OPENAI_API_KEY` with your OpenAI API key
   - Select all environments (Production, Preview, Development)

3. **Configure Build Settings** (usually auto-detected)
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Deploy**
   - Push to GitHub main branch
   - Vercel will automatically build and deploy

## API Routes

The API routes are deployed as Vercel serverless functions:
- `/api/generate-journey` - Generate AI-powered journeys
- `/api/health` - Health check endpoint

These are automatically deployed from the `api/` directory.

## Troubleshooting

### API routes return 404
- Make sure the `api/` directory is in your repository
- Check that `vercel.json` is configured correctly
- Ensure functions are built successfully (check Vercel build logs)

### OpenAI API errors
- Verify `OPENAI_API_KEY` is set in Vercel environment variables
- Check that the key is valid and has credits
- Review function logs in Vercel dashboard

### Function timeout
- Default max duration is 30 seconds (configured in `vercel.json`)
- Journey generation typically takes 5-15 seconds
- If timeout, consider optimizing or increasing timeout limit
