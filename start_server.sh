#!/bin/bash

# IMX8MP Web Server Startup Script
# This script starts the web server with proper environment setup

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="$SCRIPT_DIR/server.py"
CONFIG_FILE="$SCRIPT_DIR/config.json"
LOG_FILE="$SCRIPT_DIR/server.log"
PID_FILE="$SCRIPT_DIR/server.pid"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Python is available
check_python() {
    if command -v python3 &> /dev/null; then
        PYTHON_CMD="python3"
    elif command -v python &> /dev/null; then
        PYTHON_CMD="python"
    else
        print_error "Python is not installed or not in PATH"
        exit 1
    fi
    print_status "Using Python: $($PYTHON_CMD --version)"
}

# Function to check if required files exist
check_files() {
    if [ ! -f "$SERVER_SCRIPT" ]; then
        print_error "Server script not found: $SERVER_SCRIPT"
        exit 1
    fi
    
    if [ ! -f "$CONFIG_FILE" ]; then
        print_error "Configuration file not found: $CONFIG_FILE"
        exit 1
    fi
    
    print_success "All required files found"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing Python dependencies..."
    if [ -f "$SCRIPT_DIR/requirements.txt" ]; then
        $PYTHON_CMD -m pip install -r "$SCRIPT_DIR/requirements.txt"
        if [ $? -eq 0 ]; then
            print_success "Dependencies installed successfully"
        else
            print_error "Failed to install dependencies"
            exit 1
        fi
    else
        print_warning "requirements.txt not found, skipping dependency installation"
    fi
}

# Function to check if server is already running
check_running() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            print_warning "Server is already running with PID: $PID"
            return 0
        else
            print_status "Removing stale PID file"
            rm -f "$PID_FILE"
        fi
    fi
    return 1
}

# Function to start the server
start_server() {
    print_status "Starting IMX8MP Web Server..."
    
    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Start the server in background
    nohup $PYTHON_CMD "$SERVER_SCRIPT" > "$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    
    # Save PID to file
    echo $SERVER_PID > "$PID_FILE"
    
    # Wait a moment to check if server started successfully
    sleep 2
    
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        print_success "Server started successfully with PID: $SERVER_PID"
        print_status "Log file: $LOG_FILE"
        print_status "PID file: $PID_FILE"
        
        # Get server configuration
        if [ -f "$CONFIG_FILE" ]; then
            HOST=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['server_config']['host'])" 2>/dev/null || echo "0.0.0.0")
            PORT=$(python3 -c "import json; print(json.load(open('$CONFIG_FILE'))['server_config']['port'])" 2>/dev/null || echo "8080")
            print_status "Server URL: http://$HOST:$PORT"
        fi
    else
        print_error "Failed to start server"
        rm -f "$PID_FILE"
        exit 1
    fi
}

# Function to stop the server
stop_server() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            print_status "Stopping server with PID: $PID"
            kill $PID
            sleep 2
            
            if ps -p $PID > /dev/null 2>&1; then
                print_warning "Server did not stop gracefully, forcing termination"
                kill -9 $PID
            fi
            
            rm -f "$PID_FILE"
            print_success "Server stopped"
        else
            print_warning "Server is not running"
            rm -f "$PID_FILE"
        fi
    else
        print_warning "PID file not found, server may not be running"
    fi
}

# Function to restart the server
restart_server() {
    print_status "Restarting server..."
    stop_server
    sleep 2
    start_server
}

# Function to show server status
show_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            print_success "Server is running with PID: $PID"
            
            # Show recent logs
            if [ -f "$LOG_FILE" ]; then
                print_status "Recent log entries:"
                tail -n 10 "$LOG_FILE"
            fi
        else
            print_warning "Server is not running (stale PID file)"
            rm -f "$PID_FILE"
        fi
    else
        print_warning "Server is not running"
    fi
}

# Function to show logs
show_logs() {
    if [ -f "$LOG_FILE" ]; then
        if [ "$1" = "follow" ]; then
            print_status "Following log file (Ctrl+C to stop)..."
            tail -f "$LOG_FILE"
        else
            print_status "Recent log entries:"
            tail -n 50 "$LOG_FILE"
        fi
    else
        print_warning "Log file not found: $LOG_FILE"
    fi
}

# Function to show help
show_help() {
    echo "IMX8MP Web Server Management Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start the web server"
    echo "  stop      Stop the web server"
    echo "  restart   Restart the web server"
    echo "  status    Show server status"
    echo "  logs      Show recent logs"
    echo "  follow    Follow log file in real-time"
    echo "  install   Install dependencies"
    echo "  help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 status"
    echo "  $0 logs follow"
}

# Main script logic
case "${1:-start}" in
    start)
        check_python
        check_files
        if ! check_running; then
            install_dependencies
            start_server
        fi
        ;;
    stop)
        stop_server
        ;;
    restart)
        check_python
        check_files
        restart_server
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    follow)
        show_logs follow
        ;;
    install)
        check_python
        install_dependencies
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac 