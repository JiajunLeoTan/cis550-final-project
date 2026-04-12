#!/bin/bash
# Setup script for CIS 5500 Data-Driven Shopping Assistant
# Run this once to set up your Python environment for data cleaning and ingestion.

set -e

echo "=== CIS 5500 Project Setup ==="

# 1. Create Python virtual environment
echo "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# 2. Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# 3. Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# 4. Create project directory structure
echo "Creating directory structure..."
mkdir -p data/raw
mkdir -p data/cleaned
mkdir -p notebooks
mkdir -p scripts
mkdir -p server
mkdir -p client

# 5. Create a template .env file
if [ ! -f .env ]; then
  cat > .env <<EOF
# Database credentials — fill these in with your AWS RDS info
DB_HOST=your-rds-endpoint.amazonaws.com
DB_PORT=5432
DB_NAME=shopping_assistant
DB_USER=postgres
DB_PASSWORD=your-strong-password

# Guest credentials (for Milestone 3 submission)
GUEST_USER=guest
GUEST_PASSWORD=your-guest-password
EOF
  echo "Created .env template — fill in your AWS RDS credentials."
else
  echo ".env already exists, skipping."
fi

echo ""
echo "=== Setup complete ==="
echo "To activate the virtual environment:  source venv/bin/activate"
echo "To start Jupyter:                     jupyter lab"
echo "Put raw datasets in:                  data/raw/"
echo "Cleaned CSVs will go in:              data/cleaned/"
echo "Don't forget to fill in .env with your RDS credentials."