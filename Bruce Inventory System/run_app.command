#!/bin/bash
# Mac version of run_app.bat.
# Double-click this file in Finder, or run ./run_app.command in Terminal.
# Requires Python 3, Node.js and MySQL. Press Ctrl+C (or close the window) to stop both servers.

cd "$(dirname "$0")" || exit 1

fail() { echo "ERROR: $1"; read -r -p "Press Enter to close..."; exit 1; }

command -v node >/dev/null    || fail "Node.js is not installed (brew install node)."
command -v python3 >/dev/null || fail "Python 3 is not installed (brew install python)."

# Make sure MySQL is running (starts it with Homebrew if it isn't)
if ! nc -z 127.0.0.1 3306 2>/dev/null; then
    if command -v brew >/dev/null && brew list mysql >/dev/null 2>&1; then
        echo "Starting MySQL..."
        brew services start mysql >/dev/null
        for _ in $(seq 1 20); do nc -z 127.0.0.1 3306 2>/dev/null && break; sleep 1; done
    fi
    nc -z 127.0.0.1 3306 2>/dev/null || fail "MySQL is not running on port 3306. Start it and try again."
fi

# Set up the Node.js environment
echo "Checking for Node.js dependencies..."
if [ ! -d "Inventory Front-End/node_modules" ]; then
    echo "Installing Node.js dependencies..."
    (cd "Inventory Front-End" && npm install) || fail "npm install failed."
fi

# Set up the Python virtual environment
if [ ! -d venv ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv || fail "Could not create the virtual environment."
fi

# Activate the virtual environment and install Python dependencies
source venv/bin/activate
echo "Installing Python dependencies..."
pip install -q -r requirements.txt || fail "pip install failed."

# Stop both servers when this script exits
cleanup() {
    echo
    echo "Stopping servers..."
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
    wait 2>/dev/null
}
trap cleanup EXIT
trap 'exit 0' INT TERM HUP

# Run the Python backend
echo "Starting Python backend..."
(cd "Inventory Back-End" && exec python Back-End.py) &
BACKEND_PID=$!

# Run the Node.js server
echo "Starting Node.js server..."
(cd "Inventory Front-End" && exec node server.js) &
FRONTEND_PID=$!

# Wait for the site to come up, then open it in the browser
for _ in $(seq 1 20); do nc -z 127.0.0.1 9000 2>/dev/null && break; sleep 1; done
open "http://127.0.0.1:9000"

echo
echo "Both servers are now running at http://127.0.0.1:9000"
echo "Press Ctrl+C or close this window to stop them."
wait
