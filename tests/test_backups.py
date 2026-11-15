"""Backups and alerts: what a backup holds, that it can be put back, that it never
leaves the server unencrypted, and that the host hears about problems once, not hourly."""
import io
import os
import sqlite3
import tarfile
from datetime import datetime, timedelta

import pytest

from app.extensions import db
from app.models import Booking, CalendarFeed, Hotel, User
from app.models.db import utcnow
from app.services import backups, mailer, monitor
from tests.test_partners import HOST, account
from tests.test_uploads import photo, send

PASSPHRASE = "correct horse battery staple"


@pytest.fixture()
def host(app):
    return account(app, HOST)


@pytest.fixture(autouse=True)
def empty_outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


def names(app):
    return sorted(n for n in os.listdir(app.config["BACKUP_DIR"]) if backups.NAME.match(n))


def cli(app, *args):
    return app.test_cli_runner().invoke(args=list(args))


def book(client, days=20):
    today = utcnow().date()
    r = client.post("/api/bookings/", json={"hotel_id": 1, "start_date": (today + timedelta(days=days)).isoformat(),
                                            "end_date": (today + timedelta(days=days + 3)).isoformat(), "guest_count": 2,
                                            "guest_name": "Ana Guest", "guest_email": "ana@example.test"})
    assert r.status_code == 201, r.get_json()
    return r.get_json()["booking"]["reference"]


# ---- backups -------------------------------------------------------------------
def test_a_backup_holds_the_database_and_the_photos_and_can_be_checked(app, client, host):
    reference = book(client)
    assert send(host, photo(), scope="house").status_code == 201
    result = cli(app, "backup", "run")
    assert result.exit_code == 0, result.output
    made = names(app)
    assert [n.split("-")[0] for n in made] == ["data", "photos"] and all(n.endswith(".tar.gz") for n in made)
    folder = app.config["BACKUP_DIR"]
    assert oct(os.stat(folder).st_mode & 0o777) == "0o700" and oct(os.stat(os.path.join(folder, made[0])).st_mode & 0o777) == "0o600"

    with tarfile.open(os.path.join(folder, made[0])) as tar:
        inside = {m.name: m for m in tar}
        assert set(inside) == {"manifest.json", "database.sqlite3"}
        assert all(m.uname == "" and m.uid == 0 for m in inside.values())  # no account names from the server
        copy = os.path.join(folder, "copy.sqlite3")
        with open(copy, "wb") as fh:
            fh.write(tar.extractfile("database.sqlite3").read())
    conn = sqlite3.connect(copy)
    assert conn.execute("SELECT guest_name FROM bookings WHERE reference = ?", (reference,)).fetchone() == ("Ana Guest",)
    conn.close()
    os.remove(copy)
    with tarfile.open(os.path.join(folder, made[1])) as tar:
        assert sorted(m.name.split("/")[0] for m in tar) == ["manifest.json", "uploads", "uploads"]  # the photo and its small version

    manifest = backups.verify()
    assert manifest["rows"]["bookings"] == 1 and manifest["database"]["type"] == "sqlite"
    assert "is good" in cli(app, "backup", "verify").output and "2 backups" in cli(app, "backup", "list").output
    assert backups.verify(made[1])["files"] == 2


def test_photos_are_archived_again_only_when_they_changed_and_a_week_passed(app, host):
    send(host, photo(), scope="house")
    start = datetime(2026, 11, 1, 3, 0)
    assert len(backups.run(now=start)["made"]) == 2
    assert len(backups.run(now=start + timedelta(days=3))["made"]) == 1                # nothing new: database only
    send(host, photo(size=(900, 600)), scope="house")
    assert len(backups.run(now=start + timedelta(days=4))["made"]) == 1                # new photo, but the last archive is 4 days old
    assert len(backups.run(now=start + timedelta(days=8))["made"]) == 2                # a week on: archived again
    assert len(backups.run(now=start + timedelta(days=20))["made"]) == 1               # unchanged since, however long
    assert len(backups.run(now=start + timedelta(days=21), photos=True)["made"]) == 2  # unless asked for
    send(host, photo(size=(800, 600)), scope="house")
    assert len(backups.run(now=start + timedelta(days=40), photos=False)["made"]) == 1  # or told to leave them out
    assert len([n for n in names(app) if n.startswith("photos-")]) == 2                # only the two newest photo archives stay


def test_old_backups_are_thinned_out(app):
    stamps = [datetime(2026, 11, 15, 3) - timedelta(days=n) for n in range(120)]
    kept = sorted(backups.keep(stamps, daily=7, weekly=4, monthly=6), reverse=True)
    assert kept[:7] == stamps[:7]                                    # the last week, every day
    assert len(kept) <= 7 + 4 + 6 and kept[-1] < datetime(2026, 8, 1)  # and it reaches back months
    assert {(k.year, k.month) for k in kept} >= {(2026, 11), (2026, 10), (2026, 9), (2026, 8)}

    app.config.update(BACKUP_KEEP_DAILY=2, BACKUP_KEEP_WEEKLY=1, BACKUP_KEEP_MONTHLY=1)
    for n in range(6):
        backups.run(now=datetime(2026, 11, 15, 3) - timedelta(days=5 - n), photos=False)
    assert names(app) == ["data-20261114-030000.tar.gz", "data-20261115-030000.tar.gz"]


def test_encrypted_backups_open_only_with_the_passphrase(app, client):
    book(client)
    app.config["BACKUP_PASSPHRASE"] = PASSPHRASE
    name = backups.run()["made"][0]
    assert name.endswith(".tar.gz.enc")
    with open(os.path.join(app.config["BACKUP_DIR"], name), "rb") as fh:
        raw = fh.read()
    assert raw.startswith(backups.MAGIC) and b"Ana Guest" not in raw and b"SQLite format" not in raw and b"manifest" not in raw
    assert backups.verify(name)["rows"]["bookings"] == 1

    app.config["BACKUP_PASSPHRASE"] = "not the passphrase"
    with pytest.raises(backups.BackupError, match="Wrong passphrase"):
        backups.verify(name)
    app.config["BACKUP_PASSPHRASE"] = ""
    assert "encrypted" in cli(app, "backup", "verify", name).output and cli(app, "backup", "verify", name).exit_code == 1


def test_a_changed_or_cut_off_encrypted_file_is_refused(app, tmp_path):
    plain, sealed, back = tmp_path / "plain", tmp_path / "sealed", tmp_path / "back"
    data = os.urandom(backups.CHUNK * 2 + 123)
    plain.write_bytes(data)
    backups.encrypt_file(plain, sealed, PASSPHRASE)
    backups.decrypt_file(sealed, back, PASSPHRASE)
    assert back.read_bytes() == data
    whole = sealed.read_bytes()
    piece = backups.CHUNK + 16
    head = len(backups.MAGIC) + 23
    damaged = {
        "one bit flipped": whole[:5000] + bytes([whole[5000] ^ 1]) + whole[5001:],
        "last piece cut off": whole[:head + 2 * piece],
        "pieces swapped": whole[:head] + whole[head + piece:head + 2 * piece] + whole[head:head + piece] + whole[head + 2 * piece:],
        "not a backup": b"PK\x03\x04" + whole[4:],
    }
    for what, content in damaged.items():
        sealed.write_bytes(content)
        with pytest.raises(backups.BackupError):
            backups.decrypt_file(sealed, back, PASSPHRASE)
            pytest.fail(what)
    # Sizes that land exactly on a piece boundary, and an empty file, survive the round trip.
    for size in (0, 1, backups.CHUNK, backups.CHUNK * 2):
        plain.write_bytes(os.urandom(size))
        backups.encrypt_file(plain, sealed, PASSPHRASE)
        backups.decrypt_file(sealed, back, PASSPHRASE)
        assert back.read_bytes() == plain.read_bytes()


def test_restore_puts_the_database_back_and_keeps_what_was_there(app, client, host):
    first = book(client)
    send(host, photo(), scope="house")
    made = backups.run(now=datetime(2026, 11, 1, 3))["made"]
    second = book(client, days=40)
    db.session.commit()
    for name in os.listdir(app.config["UPLOAD_DIR"]):
        os.remove(os.path.join(app.config["UPLOAD_DIR"], name))

    result = cli(app, "backup", "restore", made[0], "--yes")
    assert result.exit_code == 0 and "restored" in result.output, result.output
    assert [b.reference for b in Booking.query.all()] == [first]
    # What was there before the restore was backed up first, so the restore can be undone.
    safety = [n for n in names(app) if n.startswith("data-") and n != made[0]]
    assert len(safety) == 1 and backups.verify(safety[0])["rows"]["bookings"] == 2
    assert "Copied back 2 missing photos" in cli(app, "backup", "restore", made[1]).output
    assert len(os.listdir(app.config["UPLOAD_DIR"])) == 2
    assert "Copied back 0 missing photos" in cli(app, "backup", "restore", made[1]).output  # never overwrites
    assert second and cli(app, "backup", "restore", "data-20200101-000000.tar.gz", "--yes").exit_code == 1


def test_an_archive_cannot_write_outside_its_folder(app, tmp_path):
    """Only the files a backup of this site holds are taken out of an archive."""
    backups.run(photos=False)
    good = os.path.join(app.config["BACKUP_DIR"], names(app)[0])
    with tarfile.open(good) as tar:
        manifest = tar.extractfile("manifest.json").read()
        database = tar.extractfile("database.sqlite3").read()
    evil = os.path.join(app.config["BACKUP_DIR"], "data-20270101-000000.tar.gz")

    def add(tar, name, content=b"x", **attrs):
        info = tarfile.TarInfo(name)
        info.size = len(content)
        for key, value in attrs.items():
            setattr(info, key, value)
        tar.addfile(info, io.BytesIO(content) if info.isfile() else None)

    with tarfile.open(evil, "w:gz") as tar:
        add(tar, "manifest.json", manifest)
        add(tar, "database.sqlite3", database)
        add(tar, "../../escaped.txt")
        add(tar, "/tmp/absolute.txt")
        add(tar, "uploads/../../escaped.jpg")
        add(tar, "uploads/shell.php")
        add(tar, "uploads/" + "a" * 32 + ".jpg", type=tarfile.SYMTYPE, linkname="/etc/passwd")
    target = tmp_path / "out"
    backups.extract("data-20270101-000000.tar.gz", str(target))
    found = sorted(os.path.join(root, f)[len(str(target)) + 1:] for root, _, files in os.walk(target) for f in files)
    assert found == ["database.sqlite3", "manifest.json"]
    assert not (tmp_path / "escaped.txt").exists() and not os.path.exists(os.path.join(app.config["BACKUP_DIR"], "escaped.txt"))
    with pytest.raises(backups.BackupError, match="empty"):
        backups.extract("data-20270101-000000.tar.gz", str(target))


def test_copies_leave_the_server_only_encrypted_and_over_https(app, monkeypatch):
    calls = []

    class Answer:
        status_code = 201

    def fake(method, url, **kwargs):
        body = kwargs["data"].read() if kwargs.get("data") else b""
        calls.append((method, url, kwargs.get("auth"), body[:10], kwargs.get("allow_redirects")))
        return Answer()

    monkeypatch.setattr(backups.requests, "request", fake)
    app.config.update(BACKUP_UPLOAD_URL="https://dav.example.test/megrooms", BACKUP_UPLOAD_USER="u", BACKUP_UPLOAD_PASSWORD="p")
    result = cli(app, "backup", "run")
    assert result.exit_code == 1 and "BACKUP_PASSPHRASE" in result.output and not calls  # refused: it would leave unencrypted
    assert "last backup failed" in monitor.checks()[0]["message"]

    app.config["BACKUP_PASSPHRASE"] = PASSPHRASE
    app.config["BACKUP_UPLOAD_URL"] = "http://dav.example.test/megrooms"
    assert cli(app, "backup", "run").exit_code == 1 and not calls                       # refused: not https

    app.config.update(BACKUP_UPLOAD_URL="https://dav.example.test/megrooms", BACKUP_KEEP_DAILY=1, BACKUP_KEEP_WEEKLY=0, BACKUP_KEEP_MONTHLY=0)
    for name in names(app):
        os.remove(os.path.join(app.config["BACKUP_DIR"], name))  # the unencrypted ones from the refused runs
    one = backups.run(now=datetime(2026, 11, 14, 3), photos=False)
    assert one["sent"] == one["made"] and calls[-1][:3] == ("PUT", f"https://dav.example.test/megrooms/{one['made'][0]}", ("u", "p"))
    assert calls[-1][3] == backups.MAGIC and calls[-1][4] is False  # encrypted bytes; redirects (which would carry the password along) not followed
    two = backups.run(now=datetime(2026, 11, 15, 3), photos=False)
    assert [c[:2] for c in calls[-2:]] == [("PUT", f"https://dav.example.test/megrooms/{two['made'][0]}"),
                                           ("DELETE", f"https://dav.example.test/megrooms/{one['made'][0]}")]
    # A copy that fails is tried again by the next run, and the host hears about it.
    app.config["BACKUP_KEEP_DAILY"] = 7
    Answer.status_code = 507
    with pytest.raises(backups.BackupError, match="answered 507"):
        backups.run(now=datetime(2026, 11, 16, 3), photos=False)
    assert "answered 507" in monitor.checks()[0]["message"]
    Answer.status_code = 201
    assert len(backups.run(now=datetime(2026, 11, 16, 4), photos=False)["sent"]) == 2


# ---- alerts ----------------------------------------------------------------------
def test_the_host_hears_about_a_problem_once_then_daily_then_when_it_is_solved(app):
    now = utcnow()
    found = monitor.checks(now=now)
    assert [p["key"] for p in found] == ["backup"] and "No backup has been made yet" in found[0]["message"]
    assert monitor.notify(found, now=now) == "alert"
    assert mailer.outbox[-1]["to"] == app.config["CONTACT_EMAIL"] and "1 thing needs you" in mailer.outbox[-1]["subject"]
    assert "No backup has been made yet" in mailer.outbox[-1]["text"]
    # The same problem an hour later: no second e-mail. A day later: a reminder.
    assert monitor.notify(monitor.checks(now=now), now=now + timedelta(hours=1)) is None
    assert monitor.notify(monitor.checks(now=now), now=now + timedelta(hours=25)) == "alert"
    assert len(mailer.outbox) == 2

    backups.run(photos=False)
    assert monitor.checks() == []
    assert monitor.notify([], now=now + timedelta(hours=26)) == "clear" and "all clear" in mailer.outbox[-1]["subject"]
    assert monitor.notify([], now=now + timedelta(hours=27)) is None and len(mailer.outbox) == 3

    app.config["ALERT_EMAIL"] = "alerts@megrooms.test"
    assert monitor.recipient() == "alerts@megrooms.test"


def test_what_the_check_looks_at(app, client):
    backups.run(photos=False)
    now = utcnow()
    assert monitor.checks(now=now) == []
    # A backup that is too old.
    late = monitor.checks(now=now + timedelta(hours=40))
    assert [p["key"] for p in late] == ["backup"] and "seems to have stopped" in late[0]["message"]
    # A calendar that stopped updating: nights sold elsewhere would look free here.
    db.session.add(CalendarFeed(hotel_id=1, name="Airbnb", url="https://www.airbnb.com/calendar/ical/1.ics", last_ok_at=now - timedelta(hours=30),
                                last_synced_at=now, last_error="The calendar address answered 404"))
    db.session.add(CalendarFeed(hotel_id=1, name="Booking.com", url="https://ical.booking.com/v1/export?t=1", last_ok_at=now - timedelta(hours=2)))
    # Guests left waiting, and a refund not sent.
    reference = book(client)
    waiting = Booking.query.filter_by(reference=reference).one()
    waiting.status, waiting.created_at = "requested", now - timedelta(hours=30)
    other = Booking.query.filter_by(reference=book(client, days=60)).one()
    other.status, other.refund_status, other.cancelled_at = "cancelled", "due", now - timedelta(days=4)
    db.session.commit()
    found = {p["key"]: p for p in monitor.checks(now=now)}
    assert set(found) == {"calendar:1", "waiting", "refunds"}
    assert "Airbnb" in found["calendar:1"]["message"] and "answered 404" in found["calendar:1"]["message"]
    assert found["waiting"]["level"] == "reminder" and "1 booking request has waited" in found["waiting"]["message"]
    # Low disk space, a missing mail server and a clean-up that stopped, on the live site.
    app.config.update(ALERT_MIN_FREE_MB=10 ** 9, IS_PRODUCTION=True)
    keys = {p["key"] for p in monitor.checks(now=now)}
    assert {"disk", "mail", "cleanup"} <= keys
    assert cli(app, "users", "cleanup").exit_code == 0
    assert "cleanup" not in {p["key"] for p in monitor.checks()}
    app.config.update(ALERT_MIN_FREE_MB=1, IS_PRODUCTION=False)

    result = cli(app, "monitor", "check", "--local")
    assert result.exit_code == 1 and "!! The calendar" in result.output and " - 1 refund is still" in result.output and "E-mail sent" in result.output
    text = mailer.outbox[-1]["text"]
    assert "3 things need you" in mailer.outbox[-1]["subject"] and "Also waiting for you:" in text and "/account?tab=host" in text


def test_an_unexpected_error_is_reported_without_what_the_guest_typed(app, client, monkeypatch):
    app.config["PROPAGATE_EXCEPTIONS"] = False

    def broken(*args, **kwargs):
        raise KeyError("ana@example.test paid with card 4111 1111 1111 1111")

    monkeypatch.setattr("app.services.stats.record", broken)
    agent = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36"}
    r = client.post("/api/meta/hit", json={"path": "/stays", "referrer": "https://secret.example/?q=private"}, headers=agent)
    assert r.status_code == 500 and r.get_json() == {"error": "Something went wrong on our side. Please try again."}
    assert len(mailer.outbox) == 1
    mail = mailer.outbox[0]
    assert mail["to"] == app.config["CONTACT_EMAIL"] and mail["subject"] == "Site error: KeyError at POST /api/meta/hit"
    assert "In the code: app/api/meta_routes.py:" in mail["text"]
    assert "4111" not in mail["text"] and "ana@example.test" not in mail["text"] and "secret.example" not in mail["text"]
    # More errors within the hour are counted, not mailed one by one.
    for _ in range(3):
        client.post("/api/meta/hit", json={"path": "/stays"}, headers=agent)
    assert len(mailer.outbox) == 1
    backups.run(photos=False)
    found = monitor.checks()
    assert [p["key"] for p in found] == ["errors"] and "4 unexpected errors" in found[0]["message"] and "4111" not in found[0]["message"]
    # Once the hourly check has reported them, counting starts afresh.
    assert monitor.notify(found) == "alert" and monitor.checks() == []
    # After the quiet hour the next error is mailed again, with how many were held back.
    with monitor._state() as notes:
        notes["error_mail_at"] = (utcnow() - timedelta(minutes=61)).replace(microsecond=0).isoformat()
    client.post("/api/meta/hit", json={"path": "/stays"}, headers=agent)
    assert "3 more happened" in mailer.outbox[-1]["text"]


def test_heartbeat_and_host_desk_summary(app, client, host, monkeypatch):
    pings = []
    monkeypatch.setattr(monitor.requests, "get", lambda url, **kw: pings.append(url))
    assert monitor.heartbeat(True) is False                    # not set up: nothing is called
    app.config["ALERT_HEARTBEAT_URL"] = "http://hc.example.test/abc"
    assert monitor.heartbeat(True) is False and not pings      # plain http is refused
    app.config["ALERT_HEARTBEAT_URL"] = "https://hc.example.test/abc"
    found, action = monitor.run(deep=False)
    assert action == "alert" and pings == ["https://hc.example.test/abc/fail"]
    backups.run(photos=False)
    monitor.run(deep=False)
    assert pings[-1] == "https://hc.example.test/abc"

    summary = host.get("/api/admin/health").get_json()
    assert summary["ok"] is True and summary["problems"] == [] and summary["backup"]["encrypted"] is False
    assert summary["backups_kept"] == 1 and summary["offsite"] is False and summary["disk_free_mb"] > 0
    assert client.get("/api/admin/health").status_code == 401
    assert account(app, "eve@example.test").get("/api/admin/health").status_code == 403
    assert "Test alert sent to " + app.config["CONTACT_EMAIL"] in cli(app, "monitor", "test").output
    assert User.query.count() == 2 and Hotel.query.count() > 0
