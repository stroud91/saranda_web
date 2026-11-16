"""Two-step sign-in with an authenticator app."""
import re
import time

import pytest

from app.extensions import db
from app.models import User
from app.services import mailer, twofactor
from tests.test_partners import HOST, PASSWORD, account

EMAIL = "ana@example.test"


def code_for(secret, offset=0):
    return twofactor.code_at(secret, twofactor.current_step() + offset)


def switch_on(client):
    """Set up two-step sign-in for the signed-in account; returns (secret, recovery codes)."""
    setup = client.post("/api/auth/two-step/setup", json={"password": PASSWORD})
    assert setup.status_code == 200, setup.get_json()
    secret = setup.get_json()["secret"]
    done = client.post("/api/auth/two-step/enable", json={"code": code_for(secret)})
    assert done.status_code == 200, done.get_json()
    return secret, done.get_json()["recovery_codes"]


def sign_in(app, email=EMAIL, password=PASSWORD):
    client = app.test_client()
    return client, client.post("/api/auth/login", json={"email": email, "password": password})


def test_codes_match_the_published_test_vectors():
    # RFC 6238, appendix B (SHA-1, shared secret "12345678901234567890"), last six digits.
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    for at, code in ((59, "287082"), (1111111109, "081804"), (1234567890, "005924"), (2000000000, "279037")):
        assert twofactor.code_at(secret, at // 30) == code


def test_setting_it_up_needs_the_password_and_a_working_code(app):
    client = account(app, EMAIL)
    assert client.get("/api/auth/me").get_json()["user"]["two_step"] is False
    assert client.post("/api/auth/two-step/setup", json={"password": "wrong-password-123"}).status_code == 400
    setup = client.post("/api/auth/two-step/setup", json={"password": PASSWORD}).get_json()
    assert re.fullmatch(r"[A-Z2-7]{32}", setup["secret"]) and setup["qr"].startswith("data:image/svg+xml")
    assert setup["uri"].startswith("otpauth://totp/Saranda%20Companion%3Aana%40example.test?secret=" + setup["secret"])
    # Until a code is confirmed, nothing has changed for sign-in.
    assert sign_in(app)[1].get_json().get("user")
    assert client.post("/api/auth/two-step/enable", json={"code": "000000"}).status_code == 400
    assert client.post("/api/auth/two-step/enable", json={"code": "12345"}).status_code == 400
    other = account(app, "second-device@example.test")  # an unrelated account can't enable it without setup
    assert other.post("/api/auth/two-step/enable", json={"code": code_for(setup["secret"])}).status_code == 409
    mailer.outbox.clear()
    app.config.update(SMTP_HOST="smtp.test", SMTP_FROM="bookings@megrooms.test")
    done = client.post("/api/auth/two-step/enable", json={"code": code_for(setup["secret"])}).get_json()
    assert done["user"]["two_step"] is True and len(done["recovery_codes"]) == 10 and len(set(done["recovery_codes"])) == 10
    assert all(re.fullmatch(r"[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}", c) for c in done["recovery_codes"])
    assert any(m["subject"] == "Two-step sign-in was switched on" for m in mailer.outbox)
    # Nothing readable is stored: the secret is encrypted and the recovery codes are hashes.
    row = User.query.filter_by(email=EMAIL).one()
    assert setup["secret"] not in row.totp_secret and twofactor.unseal(row.totp_secret) == setup["secret"]
    assert not set(done["recovery_codes"]) & set(row.recovery_codes) and all(len(h) == 64 for h in row.recovery_codes)
    assert client.post("/api/auth/two-step/setup", json={"password": PASSWORD}).status_code == 409  # already on


def test_sign_in_asks_for_the_code_and_a_code_works_once(app):
    client = account(app, EMAIL)
    secret, _ = switch_on(client)
    fresh, first = sign_in(app)
    body = first.get_json()
    assert first.status_code == 200 and body["two_step"] is True and "user" not in body and not first.headers.get("Set-Cookie")
    assert fresh.get("/api/account/overview").status_code == 401  # the password alone opens nothing
    ticket = body["ticket"]
    wrong = fresh.post("/api/auth/login/code", json={"ticket": ticket, "code": "000000"})
    assert wrong.status_code == 401 and fresh.get("/api/account/overview").status_code == 401
    # The code from setup was already used: its time step can't be replayed. The next one works.
    assert fresh.post("/api/auth/login/code", json={"ticket": ticket, "code": code_for(secret)}).status_code == 401
    good = fresh.post("/api/auth/login/code", json={"ticket": ticket, "code": code_for(secret, 1)})
    assert good.status_code == 200 and good.get_json()["user"]["email"] == EMAIL and good.get_json()["codes_left"] == 10
    assert fresh.get("/api/account/overview").status_code == 200
    # The ticket is spent, and so is that code.
    again = app.test_client().post("/api/auth/login/code", json={"ticket": ticket, "code": code_for(secret, 1)})
    assert again.status_code == 401 and again.get_json()["code"] == "expired"
    third, started = sign_in(app)
    assert third.post("/api/auth/login/code", json={"ticket": started.get_json()["ticket"], "code": code_for(secret, 1)}).status_code == 401
    # A wrong password never reaches the code step.
    assert "two_step" not in sign_in(app, password="not-the-password")[1].get_json()
    # A made-up ticket, or one for another purpose, is refused.
    assert app.test_client().post("/api/auth/login/code", json={"ticket": "x" * 40, "code": code_for(secret, 1)}).status_code == 401


def test_guessing_codes_locks_the_address_like_guessing_passwords(app):
    client = account(app, EMAIL)
    secret, _ = switch_on(client)
    fresh, first = sign_in(app)
    ticket = first.get_json()["ticket"]
    codes = [fresh.post("/api/auth/login/code", json={"ticket": ticket, "code": f"{n:06d}"}).status_code for n in range(7)]
    assert codes[:5] == [401] * 5 and 429 in codes
    locked = fresh.post("/api/auth/login/code", json={"ticket": ticket, "code": code_for(secret, 1)})
    assert locked.status_code == 429 and locked.headers["Retry-After"]
    assert sign_in(app)[1].status_code == 429  # the password step is locked too


def test_recovery_codes_work_once_each_and_can_be_replaced(app):
    client = account(app, EMAIL)
    secret, codes = switch_on(client)
    fresh, first = sign_in(app)
    ok = fresh.post("/api/auth/login/code", json={"ticket": first.get_json()["ticket"], "code": codes[0].upper().replace("-", " ")})
    assert ok.status_code == 200 and ok.get_json()["codes_left"] == 9
    again, started = sign_in(app)
    assert again.post("/api/auth/login/code", json={"ticket": started.get_json()["ticket"], "code": codes[0]}).status_code == 401
    assert again.post("/api/auth/login/code", json={"ticket": started.get_json()["ticket"], "code": codes[1]}).status_code == 200
    # New codes replace the old ones.
    assert fresh.post("/api/auth/two-step/recovery-codes", json={"password": "nope-nope-nope"}).status_code == 400
    new = fresh.post("/api/auth/two-step/recovery-codes", json={"password": PASSWORD}).get_json()["recovery_codes"]
    assert len(new) == 10 and not set(new) & set(codes)
    third, started = sign_in(app)
    assert third.post("/api/auth/login/code", json={"ticket": started.get_json()["ticket"], "code": codes[2]}).status_code == 401
    assert third.post("/api/auth/login/code", json={"ticket": started.get_json()["ticket"], "code": new[0]}).status_code == 200


def test_switching_it_off_needs_password_and_code_and_signs_other_devices_out_when_on(app):
    first_device = account(app, EMAIL)
    second_device, signed = sign_in(app)
    assert signed.get_json()["user"] and second_device.get("/api/account/overview").status_code == 200
    secret, codes = switch_on(first_device)
    assert second_device.get("/api/account/overview").status_code == 401  # must sign in again, with a code
    assert first_device.get("/api/account/overview").status_code == 200
    for body in ({"password": PASSWORD, "code": "000000"}, {"password": "wrong-password-12", "code": codes[0]}, {"password": PASSWORD}):
        assert first_device.post("/api/auth/two-step/disable", json=body).status_code == 400, body
    assert User.query.filter_by(email=EMAIL).one().totp_enabled_at is not None
    off = first_device.post("/api/auth/two-step/disable", json={"password": PASSWORD, "code": codes[0]})
    assert off.status_code == 200 and off.get_json()["user"]["two_step"] is False
    row = User.query.filter_by(email=EMAIL).one()
    assert (row.totp_secret, row.totp_enabled_at, row.recovery_codes) == (None, None, None)
    assert sign_in(app)[1].get_json().get("user")
    # A password reset does not switch it off: an inbox alone must not be enough to get in.
    switch_on(first_device)
    app.config.update(SMTP_HOST="smtp.test", SMTP_FROM="bookings@megrooms.test")
    mailer.outbox.clear()
    app.test_client().post("/api/auth/password/forgot", json={"email": EMAIL})
    token = re.search(r"token=([\w-]+)", next(m["text"] for m in mailer.outbox if "reset" in m["subject"].lower())).group(1)
    attacker = app.test_client()  # someone who got into the mailbox
    reset = attacker.post("/api/auth/password/reset", json={"token": token, "password": "brand-new-harbour-42"})
    assert reset.status_code == 200 and reset.get_json() == {"ok": True, "two_step": True}
    assert "Set-Cookie" not in reset.headers or "sc_session=;" in reset.headers.get("Set-Cookie", "")
    assert attacker.get("/api/account/overview").status_code == 401  # the link alone signs nobody in
    assert attacker.get("/api/auth/me").get_json().get("user") is None
    assert first_device.get("/api/account/overview").status_code == 401  # and every device was signed out
    assert sign_in(app, password="brand-new-harbour-42")[1].get_json().get("two_step") is True


def test_hosts_can_be_required_to_use_it_and_the_server_owner_can_reset_it(app):
    host = account(app, HOST)
    assert host.get("/api/admin/bookings").status_code == 200
    app.config["REQUIRE_TWO_STEP_FOR_HOSTS"] = True
    blocked = host.get("/api/admin/bookings")
    assert blocked.status_code == 403 and blocked.get_json()["code"] == "two_step_required"
    secret, codes = switch_on(host)
    assert host.get("/api/admin/bookings").status_code == 200
    assert host.post("/api/auth/two-step/disable", json={"password": PASSWORD, "code": codes[0]}).status_code == 409  # hosts must keep it
    # Lost phone and lost codes: only someone with access to the server can reset it.
    result = app.test_cli_runner().invoke(args=["users", "disable-two-step", HOST])
    assert result.exit_code == 0 and "off for" in result.output
    assert User.query.filter_by(email=HOST).one().totp_secret is None
    assert host.get("/api/account/overview").status_code == 401  # every device was signed out
    assert sign_in(app, email=HOST)[1].get_json().get("user")


def test_a_changed_server_key_fails_closed(app):
    client = account(app, EMAIL)
    secret, _ = switch_on(client)
    app.config["SECRET_KEY"] = "a-different-key"
    row = User.query.filter_by(email=EMAIL).one()
    assert twofactor.unseal(row.totp_secret) is None and twofactor.check(row, code_for(secret, 1)) is False
