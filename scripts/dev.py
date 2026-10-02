"""Run a local SQLite-backed preview. PostgreSQL is used by Docker and Render."""
import argparse
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--demo", action="store_true", help="Enable synthetic local identities")
    parser.add_argument("--backend-only", action="store_true")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env")
    environment = os.environ.copy()
    environment.update({
        "ENVIRONMENT": "development",
        "DATABASE_URL": "sqlite:///./pilot.db",
        "DEMO_AUTH_ENABLED": "true" if args.demo else "false",
        "NEXT_PUBLIC_DEMO_MODE": "true" if args.demo else "false",
        "AUTH_SERVICE_URL": "http://127.0.0.1:8001",
        "EVENT_SERVICE_URL": "http://127.0.0.1:8002",
        "TICKETING_SERVICE_URL": "http://127.0.0.1:8003",
        "GATEWAY_URL": "http://127.0.0.1:8000",
    })
    environment.setdefault("NEXT_PUBLIC_GOOGLE_CLIENT_ID", environment.get("GOOGLE_CLIENT_ID", ""))
    subprocess.run([sys.executable, "-m", "scripts.migrate"], cwd=ROOT, env=environment, check=True)
    subprocess.run([sys.executable, "-m", "scripts.seed"], cwd=ROOT, env=environment, check=True)
    children = []
    try:
        for service, port in (("auth", 8001), ("events", 8002), ("ticketing", 8003), ("gateway", 8000)):
            children.append(subprocess.Popen([sys.executable, "-m", "uvicorn", f"backend.{service}.main:app", "--host", "127.0.0.1", "--port", str(port)], cwd=ROOT, env=environment))
        if not args.backend_only:
            npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
            if not npm:
                raise RuntimeError("Install Node.js 22 or later to run the frontend")
            children.append(subprocess.Popen([npm, "run", "dev"], cwd=ROOT / "frontend", env=environment, shell=os.name == "nt"))
        print("Local pilot: http://localhost:3000 | API: http://127.0.0.1:8000", flush=True)
        while all(child.poll() is None for child in children):
            time.sleep(1)
        raise RuntimeError("A service stopped; inspect its output above")
    except KeyboardInterrupt:
        pass
    finally:
        for child in children:
            if child.poll() is None:
                child.terminate()
        for child in children:
            try:
                child.wait(timeout=5)
            except subprocess.TimeoutExpired:
                child.kill()


if __name__ == "__main__":
    main()
