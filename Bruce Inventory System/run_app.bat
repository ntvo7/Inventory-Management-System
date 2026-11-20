@echo off
REM Run from the "Bruce Inventory System" folder. Requires Python, Node.js and a running MySQL server.
cd /d "%~dp0"

REM Set up the Node.js environment
echo Checking for Node.js dependencies...
if not exist "Inventory Front-End\node_modules" (
    echo Installing Node.js dependencies...
    pushd "Inventory Front-End"
    call npm install
    popd
)

REM Set up the Python virtual environment
if not exist venv (
    echo Creating Python virtual environment...
    python -m venv venv
)

REM Activate the virtual environment
call venv\Scripts\activate

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt

REM Run the Python backend
echo Starting Python backend...
start "Backend" cmd /k "call "%~dp0venv\Scripts\activate" && cd /d "%~dp0Inventory Back-End" && python Back-End.py"

REM Run the Node.js server
echo Starting Node.js server...
start "Frontend" cmd /k "cd /d "%~dp0Inventory Front-End" && node server.js"

REM Keep the main window open
echo Both servers are now running. Open http://127.0.0.1:9000 in your browser.
echo Close the Backend and Frontend windows to stop them.
pause
