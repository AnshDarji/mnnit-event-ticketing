"""Start a Render service without shell-dependent command quoting."""
import argparse
import os
import sys

from scripts.migrate import migrate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--service", choices=["auth", "events", "ticketing", "gateway"], required=True)
    args = parser.parse_args()
    if args.service != "gateway":
        migrate(args.service)
    os.execvp(sys.executable, [sys.executable, "-m", "uvicorn", f"backend.{args.service}.main:app", "--host", "0.0.0.0", "--port", os.getenv("PORT", "8000")])


if __name__ == "__main__":
    main()
