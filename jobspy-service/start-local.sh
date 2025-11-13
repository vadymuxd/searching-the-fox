#!/bin/bash

# Script to run the JobSpy API service locally
# This allows you to test job searches from your local Next.js app

echo "🦊 Starting JobSpy API Service Locally..."
echo ""

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: main.py not found. Please run this script from the jobspy-service directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "📝 Please edit jobspy-service/.env with your Supabase credentials"
    exit 1
fi

# Check if virtual environment exists
if [ ! -d "jobspy-env" ]; then
    echo "📦 Virtual environment not found. Creating one..."
    python3 -m venv jobspy-env
    
    echo "📥 Installing dependencies..."
    source jobspy-env/bin/activate
    pip install -r requirements.txt
else
    echo "✅ Virtual environment found. Activating..."
    source jobspy-env/bin/activate
fi

echo ""
echo "🚀 Starting server on http://localhost:8001"
echo ""
echo "📋 Next steps:"
echo "   1. Make sure your Next.js app is running (npm run dev)"
echo "   2. Your .env.local should have: NEXT_PUBLIC_API_URL=http://localhost:8001"
echo "   3. Try searching for jobs from your local app!"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8001
