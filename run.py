#!/usr/bin/env python
"""
Railway entry point - ensures venv is properly activated before starting the app.
"""
import sys
import os

# Ensure the venv packages are available
venv_path = "/opt/venv/lib/python3.13/site-packages"
if venv_path not in sys.path:
    sys.path.insert(0, venv_path)

# Change to backend directory
backend_dir = os.path.join(os.path.dirname(__file__), "backend")
os.chdir(backend_dir)
sys.path.insert(0, backend_dir)

# Now import and run uvicorn
from uvicorn.main import main

if __name__ == "__main__":
    sys.argv = [
        "uvicorn",
        "main:app",
        "--host", "0.0.0.0",
        "--port", os.environ.get("PORT", "8000"),
        "--workers", "4"
    ]
    main()
