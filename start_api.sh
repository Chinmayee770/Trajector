#!/bin/bash
# Start the Trajector API server
# Fetches live TLE data from Space-Track.org

cd "$(dirname "$0")"

if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Starting Trajector API on http://localhost:5000"
python api.py
