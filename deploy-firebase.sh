#!/bin/bash
# Firebase/Google Cloud Deployment Script
# This script deploys your backends to Google Cloud Run

set -e  # Exit on error

echo "🚀 Firebase/Google Cloud Deployment Script"
echo "==========================================="
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed."
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is logged in
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not logged into gcloud."
    echo "Run: gcloud auth login"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No project selected."
    echo "Run: gcloud config set project YOUR_PROJECT_ID"
    exit 1
fi

echo "✅ Using project: $PROJECT_ID"
echo ""

# Prompt for environment variables
echo "📋 Required Environment Variables"
echo "================================="
echo ""
read -p "Enter your FISH_AUDIO_API_KEY: " FISH_AUDIO_API_KEY
read -p "Enter your NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "Enter your NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_KEY

echo ""
echo "Step 1: Deploying RAG Backend (Python)..."
echo "=========================================="

# Build RAG Backend
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/rag-backend \
  --dockerfile Dockerfile.rag \
  .

# Deploy RAG Backend
gcloud run deploy rag-backend \
  --image gcr.io/$PROJECT_ID/rag-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8000 \
  --set-env-vars NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY,FISH_AUDIO_API_KEY=$FISH_AUDIO_API_KEY,PORT=8000

# Get RAG Backend URL
RAG_URL=$(gcloud run services describe rag-backend --platform managed --region us-central1 --format 'value(status.url)')
echo "✅ RAG Backend deployed: $RAG_URL"
echo ""

echo "Step 2: Deploying Voice Server (Node.js)..."
echo "============================================"

# Build Voice Server
gcloud builds submit \
  --tag gcr.io/$PROJECT_ID/voice-server \
  --dockerfile Dockerfile.backend \
  .

# Deploy Voice Server
gcloud run deploy voice-server \
  --image gcr.io/$PROJECT_ID/voice-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars FISH_AUDIO_API_KEY=$FISH_AUDIO_API_KEY,RAG_API_URL=$RAG_URL,PORT=8080

# Get Voice Server URL
VOICE_URL=$(gcloud run services describe voice-server --platform managed --region us-central1 --format 'value(status.url)')
echo "✅ Voice Server deployed: $VOICE_URL"
echo ""

echo "🎉 Deployment Complete!"
echo "======================"
echo ""
echo "📝 Next Steps:"
echo "1. Update your .env.local with:"
echo "   NEXT_PUBLIC_WEBSOCKET_URL=wss://${VOICE_URL#https://}"
echo ""
echo "2. Deploy frontend to Firebase Hosting:"
echo "   firebase experiments:enable webframeworks"
echo "   firebase init hosting"
echo "   firebase deploy"
echo ""
echo "Your backend URLs:"
echo "  Voice Server: $VOICE_URL"
echo "  RAG Backend: $RAG_URL"
