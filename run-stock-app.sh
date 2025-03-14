#!/bin/bash

# Stock Trading App Launcher
# ---------------------------

# Text styling
BOLD='\033[1m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Display banner
echo -e "${BOLD}${BLUE}"
echo "  ____  _             _      _____            _  "
echo " / ___|| |_ ___   ___| | __ |_   _| __ __ _  | | "
echo " \___ \| __/ _ \ / __| |/ /   | || '__/ _\` | | | "
echo "  ___) | || (_) | (__|   <    | || | | (_| | |_| "
echo " |____/ \__\___/ \___|_|\_\   |_||_|  \__,_| (_) "
echo "                                                  "
echo -e "${NC}"

# Configuration variables
APP_DIR="$PWD/stock-trading-app"
BACKEND_DIR="$APP_DIR/server"
FRONTEND_DIR="$APP_DIR/client"
ENV_FILE="$BACKEND_DIR/.env"
DB_SERVER="192.168.1.95"
DB_NAME="aiert"
DB_USER="Martin"
DB_PASSWORD="Twinkle2811"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed.${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed.${NC}"
    echo "Please install npm (usually comes with Node.js)"
    exit 1
fi

echo -e "${YELLOW}Setting up Stock Trading App...${NC}"

# Create directory structure if it doesn't exist
mkdir -p $BACKEND_DIR
mkdir -p $FRONTEND_DIR

# Copy server.js to backend directory
echo -e "Copying server code to $BACKEND_DIR..."
cp server.js $BACKEND_DIR/

# Copy React components to frontend directory
echo -e "Copying React components to $FRONTEND_DIR..."
mkdir -p $FRONTEND_DIR/src/Components/ui
mkdir -p $FRONTEND_DIR/src/views

cp StockTradingApp.jsx $FRONTEND_DIR/src/
cp PortfolioView.jsx $FRONTEND_DIR/src/views/
cp MarketOverview.jsx $FRONTEND_DIR/src/views/
cp TradingView.jsx $FRONTEND_DIR/src/views/
cp Dashboard.jsx $FRONTEND_DIR/src/views/
cp ResearchView.jsx $FRONTEND_DIR/src/views/

# Create .env file for backend
echo -e "Creating .env file for backend..."
cat > $ENV_FILE << EOL
PORT=5001
DB_SERVER=$DB_SERVER
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
JWT_SECRET=your_secure_jwt_secret_key
EOL

# Create package.json for backend
echo -e "Creating package.json for backend..."
cat > $BACKEND_DIR/package.json << EOL
{
  "name": "stock-trading-server",
  "version": "1.0.0",
  "description": "Backend server for stock trading app",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "mssql": "^9.1.1"
  },
  "devDependencies": {
    "nodemon": "^2.0.22"
  }
}
EOL

# Create README file
echo -e "Creating README file..."
cat > $APP_DIR/README.md << EOL
# Stock Trading Application

A simulation app that allows users to trade UK stocks with a virtual cash balance.

## Setup

1. Install dependencies for both backend and frontend:
   \`\`\`
   cd server && npm install
   cd ../client && npm install
   \`\`\`

2. Start the backend server:
   \`\`\`
   cd server && npm start
   \`\`\`

3. Start the frontend development server:
   \`\`\`
   cd client && npm start
   \`\`\`

## Configuration

The backend connects to an MS SQL Server database. Configure the connection in the \`.env\` file.

## Features

- User authentication
- Real-time UK stock data
- Portfolio management
- Trade execution
- Performance tracking
EOL

# Function to install backend dependencies
install_backend_deps() {
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    cd $BACKEND_DIR
    npm install
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Backend dependencies installed successfully.${NC}"
    else
        echo -e "${RED}Failed to install backend dependencies.${NC}"
        exit 1
    fi
}

# Function to check and establish database connection
check_db_connection() {
    echo -e "${YELLOW}Checking database connection...${NC}"
    cd $BACKEND_DIR
    node -e "
    require('dotenv').config();
    const sql = require('mssql');
    
    const config = { 
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      options: { 
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
      }
    };
    
    sql.connect(config).then(() => {
      console.log('Database connection successful');
      process.exit(0);
    }).catch(err => {
      console.error('Database connection failed:', err);
      process.exit(1);
    });
    "
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Database connection successful.${NC}"
    else
        echo -e "${RED}Failed to connect to the database. Please check your settings.${NC}"
        echo "You can modify the database connection in $ENV_FILE"
    fi
}

# Function to start the backend server
start_backend() {
    echo -e "${YELLOW}Starting backend server...${NC}"
    cd $BACKEND_DIR
    if command -v npx &> /dev/null; then
        npx nodemon server.js &
    else
        node server.js &
    fi
    BACKEND_PID=$!
    echo -e "${GREEN}Backend server started with PID: $BACKEND_PID${NC}"
}

# Main function to run the application
run_app() {
    install_backend_deps
    check_db_connection
    start_backend
    
    echo -e "${GREEN}=================================================${NC}"
    echo -e "${GREEN}Stock Trading App is now running!${NC}"
    echo -e "${GREEN}Backend server: http://localhost:5001${NC}"
    echo -e "${GREEN}=================================================${NC}"
    echo -e "To stop the server, press ${BOLD}Ctrl+C${NC}"
    
    # Keep the script running and capture Ctrl+C
    trap 'cleanup' INT TERM
    wait
}

# Cleanup function to stop servers on exit
cleanup() {
    echo -e "\n${YELLOW}Stopping servers...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    echo -e "${GREEN}Application stopped.${NC}"
    exit 0
}

# Display usage information
show_help() {
    echo -e "Usage: ./run-stock-app.sh [OPTION]"
    echo "Options:"
    echo "  setup    Setup the application directories and files"
    echo "  start    Start the application"
    echo "  help     Display this help and exit"
}

# Command line argument handling
if [ $# -eq 0 ]; then
    run_app
else
    case "$1" in
        setup)
            echo -e "${GREEN}Setup completed.${NC}"
            ;;
        start)
            run_app
            ;;
        help)
            show_help
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
fi