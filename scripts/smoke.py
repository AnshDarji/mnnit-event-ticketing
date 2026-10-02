"""Exercise the running local gateway using synthetic identities only."""
import argparse
from datetime import timedelta

import httpx

from backend.common.models import utcnow


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    if not args.url.startswith(("http://127.0.0.1:", "http://localhost:")):
        raise SystemExit("This smoke test uses local demo identities and must target localhost")
    with httpx.Client(base_url=args.url, timeout=30) as client:
        def request(method, path, token=None, **kwargs):
            response = client.request(method, path, headers={"Authorization": f"Bearer {token}"} if token else {}, **kwargs)
            if response.status_code >= 400:
                raise RuntimeError(f"{method} {path}: {response.status_code} {response.text}")
            return response.json()

        organizer = request("POST", "/auth/demo", json={"role": "organizer"})["access_token"]
        attendee = request("POST", "/auth/demo", json={"role": "attendee"})["access_token"]
        staff = request("POST", "/auth/demo", json={"role": "gate_staff"})["access_token"]
        starts = utcnow() + timedelta(days=1)
        event = request("POST", "/events", organizer, json={"title": "Synthetic integration smoke test", "description": "Temporary synthetic event for checking the complete REST service flow.", "venue": "Local Test Hall", "capacity": 1, "starts_at": starts.isoformat(), "ends_at": (starts + timedelta(hours=2)).isoformat(), "registration_deadline": (starts - timedelta(hours=1)).isoformat(), "classification": "Departmental", "department_rules": ["CSED"], "program_rules": ["B.TECH"], "batch_rules": ["2024"]})
        ticket = request("POST", "/tickets/book", attendee, json={"event_id": event["id"]})
        assert ticket["qr_data_url"].startswith("data:image/svg+xml;base64,")
        cancelled = request("POST", f"/tickets/{ticket['id']}/cancel", attendee)
        assert cancelled["status"] == "cancelled"
        replacement = request("POST", "/tickets/book", attendee, json={"event_id": event["id"]})
        assert replacement["qr_payload"] != ticket["qr_payload"]
        scan = request("POST", "/tickets/check-in", staff, json={"event_id": event["id"], "qr_payload": replacement["qr_payload"]})
        assert scan["message"] == "Check-in successful"
        replay = client.post("/tickets/check-in", headers={"Authorization": f"Bearer {staff}"}, json={"event_id": event["id"], "qr_payload": replacement["qr_payload"]})
        assert replay.status_code == 409
        counts = request("GET", f"/tickets/events/{event['id']}/stats", organizer)
        assert counts["registrations"] == 1 and counts["check_ins"] == 1 and counts["remaining"] == 0
        print("PASS: gateway -> auth -> event -> booking -> cancellation -> replacement QR -> check-in -> replay rejection -> counts")


if __name__ == "__main__":
    main()
