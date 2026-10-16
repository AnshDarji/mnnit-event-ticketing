import pytest

from backend.auth import main as auth
from backend.common.config import settings

REAL_GOOGLE_VERIFIER = auth.verify_google_credential


def identity(**changes):
    return {"sub": "google-subject", "email": "student@mnnit.ac.in", "email_verified": True, "hd": "mnnit.ac.in", "name": "Campus Student", **changes}



def test_mnnit_google_identity_can_sign_in_and_returns_same_user(api, monkeypatch):
    monkeypatch.setattr(auth, "verify_google_credential", lambda credential: identity())
    first = api.auth.post("/auth/google", json={"credential": "signed-token"})
    second = api.auth.post("/auth/google", json={"credential": "signed-token"})
    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["user"]["role"] == "attendee"
    me = api.auth.get("/auth/me", headers={"Authorization": f"Bearer {first.json()['access_token']}"})
    assert me.json()["email"] == "student@mnnit.ac.in"



@pytest.mark.parametrize("changes", [{"hd": "gmail.com"}, {"hd": None}, {"email": "student@gmail.com"}, {"email_verified": False}, {"email_verified": "true"}])
def test_google_sign_in_requires_workspace_domain_and_verified_institute_email(api, monkeypatch, changes):
    monkeypatch.setattr(auth, "verify_google_credential", lambda credential: identity(**changes))
    response = api.auth.post("/auth/google", json={"credential": "signed-token"})
    assert response.status_code == 403



def test_missing_google_subject_is_rejected(api, monkeypatch):
    monkeypatch.setattr(auth, "verify_google_credential", lambda credential: identity(sub=""))
    assert api.auth.post("/auth/google", json={"credential": "signed-token"}).status_code == 401



def test_google_verifier_passes_expected_client_id_to_google_library(api, monkeypatch):
    called = {}
    def verify(credential, request, audience):
        called.update(credential=credential, audience=audience)
        return identity()
    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", verify)
    assert REAL_GOOGLE_VERIFIER("actual-id-token")["hd"] == "mnnit.ac.in"
    assert called == {"credential": "actual-id-token", "audience": settings.google_client_id}



def test_google_verification_failure_returns_401(api, monkeypatch):
    def fail(*args, **kwargs):
        raise ValueError("bad signature")
    monkeypatch.setattr(auth.id_token, "verify_oauth2_token", fail)
    monkeypatch.setattr(auth, "verify_google_credential", REAL_GOOGLE_VERIFIER)
    assert api.auth.post("/auth/google", json={"credential": "forged-token"}).status_code == 401



def test_profile_normalizes_rules_and_issues_role_token(api, actor):
    student = actor(department=" csed ", program=" b.tech ")
    response = api.auth.put("/auth/me", json={"role": "organizer"}, headers=student.headers)
    assert response.status_code == 200
    user = response.json()["user"]
    assert (user["department"], user["program"], user["role"]) == ("CSED", "B.TECH", "organizer")
    assert response.json()["access_token"] != student.token



def test_role_selection_can_be_disabled(api, actor, monkeypatch):
    student = actor()
    monkeypatch.setattr(settings, "pilot_role_selection", False)
    response = api.auth.put("/auth/me", json={"role": "admin"}, headers=student.headers)
    assert response.status_code == 403



def test_invalid_role_and_batch_are_rejected(api, actor):
    student = actor()
    for body in ({"role": "superuser"}, {"batch": "nineteen"}):
        assert api.auth.put("/auth/me", json=body, headers=student.headers).status_code == 422


def test_demo_sign_in_is_local_only(api, monkeypatch):
    assert api.auth.post("/auth/demo", json={"role": "admin"}).status_code == 404
    monkeypatch.setattr(settings, "demo_auth_enabled", True)
    assert api.auth.post("/auth/demo", json={"role": "admin"}).status_code == 200
    monkeypatch.setattr(settings, "environment", "production")
    response = api.auth.post("/auth/demo", json={"role": "admin"}, headers={"X-Gateway-Secret": settings.internal_secret})
    assert response.status_code == 404


def test_invalid_or_missing_session_cannot_access_profile(api):
    assert api.auth.get("/auth/me").status_code == 401
    assert api.auth.get("/auth/me", headers={"Authorization": "Bearer tampered"}).status_code == 401


def test_internal_user_endpoint_requires_service_secret(api, actor):
    student = actor()
    assert api.auth.get(f"/internal/users/{student.user['id']}").status_code == 403
