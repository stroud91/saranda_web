"""Guest accounts: sign-up, sign-in, sessions, password reset, e-mail
verification, privacy of bookings, CSRF and host access."""
import re

import pytest

from app.extensions import db
from app.models import AuthToken, Booking, User, UserSession
from app.services import mailer

GOOD = "olive-grove-ferry-42"
ANA = {"name": "Ana Dervishi", "email": "ana@example.com", "password": GOOD}


@pytest.fixture(autouse=True)
def _outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


def register(client, **over):
    return client.post("/api/auth/register", json={**ANA, **over})


def token_from_mail(kind):
    """The token inside the newest verification / reset e-mail."""
    path = {"verify": "verify-email", "reset": "reset-password"}[kind]
    for msg in reversed(mailer.outbox):
        m = re.search(rf"/{path}\?token=([\w-]+)", msg["text"])
        if m:
            return m.group(1)
    raise AssertionError(f"no {kind} mail in outbox")


# ---- sign-up -------------------------------------------------------------------
def test_register_signs_in_and_sends_verification(client, app):
    r = register(client)
    assert r.status_code == 201
    body = r.get_json()
    assert body["user"]["email"] == "ana@example.com" and body["user"]["email_verified"] is False
    assert body["verification_sent"] is True
    cookie = r.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie and "Path=/" in cookie
    assert client.get("/api/auth/me").get_json()["user"]["name"] == "Ana Dervishi"
    assert mailer.outbox[-1]["to"] == "ana@example.com"
    assert "https://megrooms.test/verify-email?token=" in mailer.outbox[-1]["text"]


def test_passwords_are_hashed_and_tokens_stored_only_as_digests(client, app):
    r = register(client)
    raw_cookie = re.search(r"sc_session=([^;]+)", r.headers["Set-Cookie"]).group(1)
    raw_token = token_from_mail("verify")
    with app.app_context():
        user = User.query.filter_by(email="ana@example.com").one()
        assert GOOD not in user.password_hash and user.password_hash.startswith("scrypt:")
        assert UserSession.query.filter_by(token_hash=raw_cookie).count() == 0
        assert AuthToken.query.filter_by(token_hash=raw_token).count() == 0
        assert len(UserSession.query.one().token_hash) == 64


@pytest.mark.parametrize("password,needle", [
    ("short", "at least 10"),
    ("password123", "too common"),
    ("aaaaaaaaaaaa", "too common"),
    ("ana-dervishi-2027", None),  # name isn't matched with a dash; allowed
    ("xx-ana@example-xx", None),
    ("my-name-is-Ana Dervishi", "name or email"),
    ("x" * 129, "at most 128"),
])
def test_password_rules(client, password, needle):
    r = register(client, password=password)
    if needle is None:
        assert r.status_code == 201
    else:
        assert r.status_code == 400 and needle in r.get_json()["fields"]["password"]


def test_duplicate_email_is_rejected_case_insensitively(client):
    assert register(client).status_code == 201
    r = register(client, email="ANA@Example.com")
    assert r.status_code == 409


def test_honeypot_blocks_bots(client):
    assert register(client, website="http://spam").status_code == 400


# ---- sign-in / out ----------------------------------------------------------------
def test_login_logout_roundtrip(client):
    register(client)
    assert client.post("/api/auth/logout").get_json() == {"ok": True}
    assert client.get("/api/auth/me").get_json()["user"] is None
    r = client.post("/api/auth/login", json={"email": "Ana@Example.com", "password": GOOD})
    assert r.status_code == 200 and r.get_json()["user"]["email"] == "ana@example.com"
    assert client.get("/api/account/overview").status_code == 200


def test_login_errors_do_not_reveal_whether_the_account_exists(client):
    register(client)
    client.post("/api/auth/logout")
    wrong = client.post("/api/auth/login", json={"email": "ana@example.com", "password": "not-the-password"})
    unknown = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "not-the-password"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.get_json() == unknown.get_json()


def test_repeated_failures_lock_sign_in_for_known_and_unknown_addresses(client):
    register(client)
    client.post("/api/auth/logout")
    for email in ("ana@example.com", "nobody@example.com"):
        for _ in range(5):
            assert client.post("/api/auth/login", json={"email": email, "password": "wrong-password-1"}).status_code == 401
        locked = client.post("/api/auth/login", json={"email": email, "password": GOOD})
        assert locked.status_code == 429 and "Retry-After" in locked.headers


def test_logout_revokes_the_session_server_side(client, app):
    r = register(client)
    stolen = re.search(r"(sc_session)=([^;]+)", r.headers["Set-Cookie"])
    client.post("/api/auth/logout")
    thief = app.test_client()
    thief.set_cookie(stolen.group(1), stolen.group(2))
    assert thief.get("/api/auth/me").get_json()["user"] is None


def test_protected_endpoints_need_a_session(client):
    for method, path in (("get", "/api/account/overview"), ("get", "/api/account/sessions"),
                         ("post", "/api/auth/password"), ("get", "/api/account/export")):
        assert getattr(client, method)(path, json={}).status_code == 401


# ---- password change / reset --------------------------------------------------------
def test_change_password_signs_out_other_devices(client, app):
    register(client)
    other = app.test_client()
    assert other.post("/api/auth/login", json={"email": "ana@example.com", "password": GOOD}).status_code == 200
    bad = client.post("/api/auth/password", json={"current_password": "nope", "new_password": "harbour-lights-77"})
    assert bad.status_code == 400
    ok = client.post("/api/auth/password", json={"current_password": GOOD, "new_password": "harbour-lights-77"})
    assert ok.status_code == 200
    assert client.get("/api/auth/me").get_json()["user"] is not None      # this device stays signed in
    assert other.get("/api/auth/me").get_json()["user"] is None            # the other one is signed out
    assert "password was changed" in mailer.outbox[-1]["subject"]


def test_forgot_password_answers_the_same_for_any_address(client):
    register(client)
    known = client.post("/api/auth/password/forgot", json={"email": "ana@example.com"})
    unknown = client.post("/api/auth/password/forgot", json={"email": "nobody@example.com"})
    assert known.status_code == unknown.status_code == 202
    assert known.get_json() == unknown.get_json()
    assert sum("Reset your password" in m["subject"] for m in mailer.outbox) == 1


def test_reset_link_is_single_use_and_signs_everyone_out(client, app):
    register(client)
    client.post("/api/auth/password/forgot", json={"email": "ana@example.com"})
    token = token_from_mail("reset")
    fresh = app.test_client()
    weak = fresh.post("/api/auth/password/reset", json={"token": token, "password": "short"})
    assert weak.status_code == 400                                   # a weak password doesn't burn the link
    r = fresh.post("/api/auth/password/reset", json={"token": token, "password": "new-castle-walk-9"})
    assert r.status_code == 200 and r.get_json()["user"]["email_verified"] is True
    assert client.get("/api/auth/me").get_json()["user"] is None     # old session revoked
    again = app.test_client().post("/api/auth/password/reset", json={"token": token, "password": "another-pass-123"})
    assert again.status_code == 400
    assert app.test_client().post("/api/auth/login", json={"email": "ana@example.com", "password": GOOD}).status_code == 401


def test_reset_rejects_garbage_tokens(client):
    for token in (None, "", "x" * 10, "x" * 300, {"a": 1}):
        r = client.post("/api/auth/password/reset", json={"token": token, "password": "new-castle-walk-9"})
        assert r.status_code == 400


def test_reset_links_never_use_the_request_host_in_production(app, client):
    register(client)
    app.config.update(IS_PRODUCTION=True, PUBLIC_BASE_URL="")
    mailer.outbox.clear()
    r = client.post("/api/auth/password/forgot", json={"email": "ana@example.com"}, headers={"Host": "evil.example"})
    assert r.status_code == 202 and mailer.outbox == []              # no link is better than a poisoned link


# ---- e-mail verification -------------------------------------------------------------
def test_verify_email(client):
    register(client)
    token = token_from_mail("verify")
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 200
    assert client.get("/api/auth/me").get_json()["user"]["email_verified"] is True
    assert client.post("/api/auth/verify", json={"token": token}).status_code == 400


# ---- privacy: whose bookings can an account see? -----------------------------------------
def _book(client, email, **over):
    stay = client.get("/api/hotels/").get_json()[0]
    body = {"hotel_id": stay["id"], "start_date": "2031-06-10", "end_date": "2031-06-13", "guest_count": 2,
            "guest_name": "Guest", "guest_email": email, **over}
    r = client.post("/api/bookings/", json=body)
    assert r.status_code == 201, r.get_json()
    return r.get_json()["booking"]["reference"]


def test_unverified_account_cannot_see_bookings_made_with_its_address(client, app):
    victim_ref = _book(app.test_client(), "ana@example.com")           # made by the real Ana, not signed in
    register(client)                                                    # someone registers with her address
    assert client.get("/api/account/overview").get_json()["bookings"] == []
    client.post("/api/auth/verify", json={"token": token_from_mail("verify")})
    refs = [b["reference"] for b in client.get("/api/account/overview").get_json()["bookings"]]
    assert refs == [victim_ref]                                         # visible once the inbox is proven


def test_bookings_made_while_signed_in_belong_to_the_account(client, app):
    register(client)
    ref = _book(client, "someone-else@example.com", start_date="2031-07-01", end_date="2031-07-04")
    overview = client.get("/api/account/overview").get_json()
    assert [b["reference"] for b in overview["bookings"]] == [ref]
    other = app.test_client()
    register(other, email="ben@example.com", name="Ben")
    assert other.get("/api/account/overview").get_json()["bookings"] == []


def test_trips_saved_while_signed_in_are_listed_and_editable_without_the_key(client, app):
    register(client)
    trip = {"title": "Riviera", "days": [{"stops": ["sarande", "ksamil"]}]}
    share_id = client.post("/api/trips", json=trip).get_json()["share_id"]
    assert [t["share_id"] for t in client.get("/api/account/overview").get_json()["trips"]] == [share_id]
    assert client.put(f"/api/trips/{share_id}", json={**trip, "title": "Riviera v2"}).status_code == 200
    stranger = app.test_client()
    assert stranger.put(f"/api/trips/{share_id}", json={**trip, "title": "hacked"}).status_code == 403


# ---- devices, export, deletion ---------------------------------------------------------------
def test_sessions_can_be_listed_and_revoked(client, app):
    register(client)
    phone = app.test_client()
    phone.post("/api/auth/login", json={"email": "ana@example.com", "password": GOOD},
               headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Safari/605.1"})
    sessions = client.get("/api/account/sessions").get_json()["sessions"]
    assert len(sessions) == 2 and sum(s["current"] for s in sessions) == 1
    target = next(s for s in sessions if not s["current"])
    assert target["device"] == "Safari on iPhone"
    assert client.delete(f"/api/account/sessions/{target['id']}").status_code == 200
    assert phone.get("/api/auth/me").get_json()["user"] is None
    assert client.delete("/api/account/sessions/999999").status_code == 404


def test_export_and_delete_account(client, app):
    register(client)
    ref = _book(client, "ana@example.com", start_date="2031-08-01", end_date="2031-08-03")
    export = client.get("/api/account/export")
    assert export.status_code == 200 and "attachment" in export.headers["Content-Disposition"]
    data = export.get_json()
    assert data["account"]["email"] == "ana@example.com" and data["bookings"][0]["reference"] == ref
    assert "password" not in export.get_data(as_text=True).lower()
    assert client.post("/api/account/delete", json={"password": "wrong"}).status_code == 400
    assert client.post("/api/account/delete", json={"password": GOOD}).status_code == 200
    assert client.get("/api/auth/me").get_json()["user"] is None
    with app.app_context():
        assert User.query.count() == 0 and UserSession.query.count() == 0
        kept = Booking.query.filter_by(reference=ref).one()               # business record stays, unlinked
        assert kept.user_id is None


# ---- cross-site request forgery ---------------------------------------------------------------
def test_cross_site_writes_are_blocked(client):
    register(client)
    evil = client.post("/api/auth/logout", json={}, headers={"Origin": "https://evil.example"})
    assert evil.status_code == 403
    assert client.get("/api/auth/me").get_json()["user"] is not None      # still signed in
    fetch = client.post("/api/auth/logout", json={}, headers={"Sec-Fetch-Site": "cross-site"})
    assert fetch.status_code == 403
    assert client.post("/api/auth/logout", json={}, headers={"Origin": "null"}).status_code == 403
    same = client.post("/api/auth/logout", json={}, headers={"Origin": "http://localhost"})
    assert same.status_code == 200


def test_form_posts_cannot_log_in(client):
    r = client.post("/api/auth/login", data={"email": "ana@example.com", "password": GOOD})
    assert r.status_code == 415


# ---- host access ----------------------------------------------------------------------------------
def test_host_desk_needs_a_verified_allow_listed_address(client, app):
    assert client.get("/api/admin/bookings").status_code == 401
    register(client, email="host@megrooms.test", name="Host")
    assert client.get("/api/auth/me").get_json()["user"]["is_admin"] is False
    assert client.get("/api/admin/bookings").status_code == 403          # address not proven yet
    client.post("/api/auth/verify", json={"token": token_from_mail("verify")})
    assert client.get("/api/auth/me").get_json()["user"]["is_admin"] is True
    assert client.get("/api/admin/bookings").status_code == 200
    guest = app.test_client()
    register(guest)
    assert guest.get("/api/admin/bookings").status_code == 403


def test_cli_creates_a_host_account(app):
    runner = app.test_cli_runner()
    weak = runner.invoke(args=["users", "create-host", "owner@example.com", "--password", "short"])
    assert weak.exit_code != 0
    made = runner.invoke(args=["users", "create-host", "owner@example.com", "--password", "lemon-tree-terrace-8"])
    assert made.exit_code == 0, made.output
    c = app.test_client()
    assert c.post("/api/auth/login", json={"email": "owner@example.com", "password": "lemon-tree-terrace-8"}).status_code == 200
    assert c.get("/api/admin/bookings").status_code == 200


def test_public_config_reports_accounts(client):
    cfg = client.get("/api/meta/config").get_json()
    assert cfg["auth"] == {"enabled": True, "email": True}
