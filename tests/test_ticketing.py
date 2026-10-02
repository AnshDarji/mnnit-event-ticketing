import base64
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.common.models import Booking, Event, Inventory, utcnow


def book(api, student, event):
    return api.tickets.post("/tickets/book", json={"event_id": event["id"]}, headers=student.headers)


def scan(api, gate, event, payload):
    return api.tickets.post("/tickets/check-in", json={"event_id": event["id"], "qr_payload": payload}, headers=gate.headers)


def test_complete_booking_qr_check_in_and_statistics_flow(api, actor, create_event):
    organizer, student, gate = actor("organizer"), actor(), actor("gate_staff")
    event = create_event(organizer, department_rules=["CSED"], program_rules=["B.TECH"], batch_rules=["2024"])
    booked = book(api, student, event)
    assert booked.status_code == 201, booked.text
    ticket = booked.json()
    assert ticket["status"] == "active"
    assert ticket["qr_data_url"].startswith("data:image/svg+xml;base64,")
    svg = base64.b64decode(ticket["qr_data_url"].split(",", 1)[1])
    assert b"<svg" in svg
    assert api.tickets.get("/tickets/me", headers=student.headers).json()["items"][0]["id"] == ticket["id"]
    checked = scan(api, gate, event, ticket["qr_payload"])
    assert checked.status_code == 200, checked.text
    assert checked.json()["ticket_id"] == ticket["id"]
    stats = api.tickets.get(f"/tickets/events/{event['id']}/stats", headers=organizer.headers).json()
    assert stats == {"registrations": 1, "check_ins": 1, "capacity": 3, "remaining": 2, "attendance_percentage": 100.0}


@pytest.mark.parametrize("rules, profile", [("department_rules", {"department": "ECED"}), ("program_rules", {"program": "M.TECH"}), ("batch_rules", {"batch": "2025"})])
def test_each_eligibility_rule_is_enforced_server_side(api, actor, create_event, rules, profile):
    allowed = {"department_rules": ["CSED"], "program_rules": ["B.TECH"], "batch_rules": ["2024"]}
    event = create_event(**{rules: allowed[rules]})
    denied = book(api, actor(**profile), event)
    assert denied.status_code == 403, denied.text
    assert book(api, actor(), event).status_code == 201


def test_duplicate_booking_does_not_consume_capacity(api, actor, create_event):
    event, student = create_event(capacity=2), actor()
    assert book(api, student, event).status_code == 201
    assert book(api, student, event).status_code == 409
    assert book(api, actor(), event).status_code == 201
    assert book(api, actor(), event).status_code == 409


def test_final_seat_cannot_be_booked_twice(api, actor, create_event, engine):
    event = create_event(capacity=1)
    assert book(api, actor(), event).status_code == 201
    assert book(api, actor(), event).status_code == 409
    with Session(engine) as db:
        assert db.get(Inventory, event["id"]).booked == 1
        assert db.scalar(select(func.count()).select_from(Booking)) == 1


def test_cancellation_frees_seat_and_rebooking_rotates_qr(api, actor, create_event):
    event, student, gate = create_event(capacity=1), actor(), actor("gate_staff")
    original = book(api, student, event).json()
    cancelled = api.tickets.post(f"/tickets/{original['id']}/cancel", headers=student.headers)
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["qr_payload"] is None
    assert scan(api, gate, event, original["qr_payload"]).status_code == 409
    repeated = api.tickets.post(f"/tickets/{original['id']}/cancel", headers=student.headers)
    assert repeated.status_code == 200
    renewed = book(api, student, event)
    assert renewed.status_code == 201, renewed.text
    assert renewed.json()["qr_payload"] != original["qr_payload"]
    assert scan(api, gate, event, original["qr_payload"]).status_code == 400
    assert scan(api, gate, event, renewed.json()["qr_payload"]).status_code == 200


def test_cancelled_seat_can_be_taken_by_another_student(api, actor, create_event):
    event, first, second = create_event(capacity=1), actor(), actor()
    ticket = book(api, first, event).json()
    assert api.tickets.post(f"/tickets/{ticket['id']}/cancel", headers=first.headers).status_code == 200
    assert book(api, second, event).status_code == 201
    assert book(api, first, event).status_code == 409


def test_qr_rejects_forged_wrong_event_and_repeat_scan(api, actor, create_event):
    event, other_event, student, gate = create_event(), create_event(), actor(), actor("gate_staff")
    ticket = book(api, student, event).json()
    payload, signature = ticket["qr_payload"].split(".")
    forged = f"{payload}.{'0' if signature[0] != '0' else '1'}{signature[1:]}"
    assert scan(api, gate, event, forged).status_code == 400
    assert scan(api, gate, other_event, ticket["qr_payload"]).status_code == 400
    assert scan(api, gate, event, ticket["qr_payload"]).status_code == 200
    assert scan(api, gate, event, ticket["qr_payload"]).status_code == 409


def test_signed_payload_cannot_be_modified(api, actor, create_event):
    event, student, gate = create_event(), actor(), actor("gate_staff")
    ticket = book(api, student, event).json()
    encoded, signature = ticket["qr_payload"].split(".")
    data = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)))
    data["event_id"] = "attacker-selected-event"
    encoded = base64.urlsafe_b64encode(json.dumps(data).encode()).decode().rstrip("=")
    assert scan(api, gate, event, f"{encoded}.{signature}").status_code == 400


def test_attendee_cannot_scan_and_foreign_organizer_cannot_scan(api, actor, create_event):
    event, student = create_event(), actor()
    ticket = book(api, student, event).json()
    assert scan(api, student, event, ticket["qr_payload"]).status_code == 403
    assert scan(api, actor("organizer"), event, ticket["qr_payload"]).status_code == 403


def test_another_student_cannot_read_or_cancel_a_ticket(api, actor, create_event):
    event, owner, stranger = create_event(), actor(), actor()
    ticket = book(api, owner, event).json()
    assert api.tickets.get("/tickets/me", headers=stranger.headers).json()["items"] == []
    assert api.tickets.post(f"/tickets/{ticket['id']}/cancel", headers=stranger.headers).status_code == 404


def test_checked_in_ticket_cannot_be_cancelled(api, actor, create_event):
    event, student, gate = create_event(), actor(), actor("gate_staff")
    ticket = book(api, student, event).json()
    assert scan(api, gate, event, ticket["qr_payload"]).status_code == 200
    assert api.tickets.post(f"/tickets/{ticket['id']}/cancel", headers=student.headers).status_code == 409


def test_registration_deadline_is_enforced_even_if_event_exists(api, actor, create_event, engine):
    event = create_event()
    with Session(engine) as db:
        db.get(Event, event["id"]).registration_deadline = utcnow() - timedelta(minutes=1)
        db.commit()
    assert book(api, actor(), event).status_code == 409


def test_ended_event_rejects_check_in(api, actor, create_event, engine):
    event, student, gate = create_event(), actor(), actor("gate_staff")
    ticket = book(api, student, event).json()
    with Session(engine) as db:
        db.get(Event, event["id"]).ends_at = utcnow() - timedelta(minutes=1)
        db.commit()
    assert scan(api, gate, event, ticket["qr_payload"]).status_code == 409


def test_unknown_event_and_missing_session_are_rejected(api, actor):
    assert api.tickets.post("/tickets/book", json={"event_id": "missing"}, headers=actor().headers).status_code == 404
    assert api.tickets.post("/tickets/book", json={"event_id": "missing"}).status_code == 401


@pytest.mark.skipif(not os.getenv("TEST_POSTGRES_URL"), reason="Set TEST_POSTGRES_URL to run real PostgreSQL final-seat contention")
def test_postgres_simultaneous_requests_allocate_exactly_one_final_seat(api, actor, create_event, engine):
    event = create_event(capacity=1)
    students = [actor() for _ in range(8)]
    barrier = Barrier(len(students))
    def attempt(student):
        barrier.wait(timeout=20)
        return book(api, student, event).status_code
    with ThreadPoolExecutor(max_workers=len(students)) as executor:
        statuses = list(executor.map(attempt, students))
    assert statuses.count(201) == 1, statuses
    assert statuses.count(409) == 7, statuses
    with Session(engine) as db:
        assert db.get(Inventory, event["id"]).booked == 1
        active = db.scalar(select(func.count()).select_from(Booking).where(Booking.event_id == event["id"], Booking.status == "active"))
        assert active == 1
