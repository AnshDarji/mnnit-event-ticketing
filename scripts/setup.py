#!/usr/bin/env python3
"""
MNNIT Event Ticketing - Local Environment Setup Assistant
"""
import os
import shutil

def main():
    print("Initializing MNNIT Event Ticketing local setup check...")
    if not os.path.exists(".env") and os.path.exists(".env.example"):
        shutil.copy(".env.example", ".env")
        print("[SUCCESS] Created .env from .env.example template.")
    else:
        print("[INFO] .env file already exists or .env.example missing.")
    print("Setup preparation complete. Run 'docker compose up --build' to start services.")

if __name__ == "__main__":
    main()
