from datetime import timedelta
import pytest
from backend.common.models import utcnow


def test_events_are_public_searchable_and_synthetic(api, create_event):
    event = create_event(title="Synthetic Robotics Workshop", classification="Departmental", department_rules=[" csed ", "CSED"])
    assert event["is_synthetic"] is True
    assert event["department_rules"] == ["CSED"]
    results = api.events.get("/events", params={"q": "Robotics", "classification": "Departmental"})
    assert [item["id"] for item in results.json()["items"]] == [event["id"]]
    assert api.events.get(f"/events/{event['id']}").json()["id"] == event["id"]


def test_only_organizer_or_admin_can_create_events(api, actor, event_payload):
    assert api.events.post("/events", json=event_payload).status_code == 401
    for role in ("attendee", "gate_staff"):
        assert api.events.post("/events", json=event_payload, headers=actor(role).headers).status_code == 403
    assert api.events.post("/events", json=event_payload, headers=actor("admin").headers).status_code == 201


@pytest.mark.parametrize("change", [{"capacity": 0}, {"title": "   "}, {"classification": "Unknown"}, {"batch_rules": ["202"]}, {"starts_at": "2030-01-01T12:00:00"}])
def test_invalid_event_definition_is_rejected(api, actor, event_payload, change):
    response = api.events.post("/events", json={**event_payload, **change}, headers=actor("organizer").headers)
    assert response.status_code == 422, response.text


def test_event_dates_have_consistent_order(api, actor, event_payload):
    organizer = actor("organizer")
    invalid = [
        {"ends_at": event_payload["starts_at"]},
        {"registration_deadline": (utcnow() + timedelta(days=3)).isoformat()},
        {"registration_deadline": (utcnow() - timedelta(minutes=1)).isoformat()},
    ]
    for change in invalid:
        assert api.events.post("/events", json={**event_payload, **change}, headers=organizer.headers).status_code == 422


def test_internal_event_endpoint_requires_service_secret(api, create_event):
    event = create_event()
    assert api.events.get(f"/internal/events/{event['id']}").status_code == 403
