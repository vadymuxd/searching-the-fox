#!/bin/bash

# Release 2 - Install new dependencies for jobspy-service
# Run this script to install the new Python packages locally

echo "Installing new Python dependencies for Release 2..."

cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "jobspy-env" ]; then
    echo "Error: Virtual environment 'jobspy-env' not found!"
    echo "Please run this from the jobspy-service directory"
    exit 1
fi

# Activate virtual environment
source jobspy-env/bin/activate

# Install new dependencies
pip install supabase==2.10.0 python-dotenv==1.0.0

echo "✅ Dependencies installed successfully!"
echo ""
echo "Next steps:"
echo "1. Create a .env file based on .env.example"
echo "2. Add your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
echo "3. Test locally: python main.py"
echo "4. Deploy to Render with the new environment variables"
