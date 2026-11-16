"""Calendars: manual date blocks, feeds imported from other booking sites,
the export link, and who may touch a stay's calendar."""
import re
from datetime import date, timedelta

import pytest

from app.extensions import db
from app.models import CalendarFeed, DateBlock, Hotel
from app.services import calendars, mailer

from test_partners import HOST, STAY, account, approve, make_business

PASSWORD = "olive-grove-ferry-42"


def day(n):
    return date.today() + timedelta(days=n)


def iso(n):
    return day(n).isoformat()


def ics(*events):
    body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Test//EN"]
    for lines in events:
        body += ["BEGIN:VEVENT", *lines, "END:VEVENT"]
    return "\r\n".join(body + ["END:VCALENDAR"]) + "\r\n"


def stamp(n):
    return day(n).strftime("%Y%m%d")


@pytest.fixture(autouse=True)
def _outbox():
    mailer.outbox.clear()
    yield
    mailer.outbox.clear()


@pytest.fixture()
def host(app):
    return account(app, HOST)


@pytest.fixture()
def house(app):
    return Hotel.query.filter(Hotel.business_id.is_(None)).order_by(Hotel.id).first()


@pytest.fixture()
def feed_text(monkeypatch):
    """What the 'other booking site' answers; tests change it to simulate new reservations."""
    state = {"text": ics(), "calls": 0, "error": None}

    def fake_fetch(url, timeout=None):
        state["timeout"] = timeout
        state["calls"] += 1
        if state["error"]:
            raise calendars.FeedError(state["error"])
        return state["text"]

    monkeypatch.setattr(calendars, "fetch", fake_fetch)
    return state


# ---- reading other sites' calendars ---------------------------------------------------
def test_ics_parser_reads_only_dates_and_drops_junk():
    text = ics(
        [f"DTSTART;VALUE=DATE:{stamp(10)}", f"DTEND;VALUE=DATE:{stamp(13)}", "SUMMARY:Reserved"],
        [f"DTSTART:{stamp(20)}T140000Z", f"DTEND:{stamp(22)}T100000Z", "SUMMARY:<script>alert(1)</script>"],
        [f"DTSTART;VALUE=DATE:{stamp(30)}"],  # no end: one night
        [f"DTSTART;VALUE=DATE:{stamp(40)}", f"DTEND;VALUE=DATE:{stamp(42)}", "STATUS:CANCELLED"],
        [f"DTSTART;VALUE=DATE:{stamp(-30)}", f"DTEND;VALUE=DATE:{stamp(-25)}"],  # in the past
        [f"DTSTART;VALUE=DATE:{stamp(50)}", f"DTEND;VALUE=DATE:{stamp(50 + 900)}"],  # absurdly long
        ["DTSTART;VALUE=DATE:20279999", "DTEND;VALUE=DATE:banana"],
        # a folded line, as real feeds send long ones
        [f"DTSTART;VALUE=DATE:{stamp(60)}", f"DTEND;VALUE=DA\r\n TE:{stamp(61)}"],
    )
    assert calendars.parse_ics(text) == [(day(10), day(13)), (day(20), day(22)), (day(30), day(31)), (day(60), day(61))]
    # A stay in progress is trimmed to start today.
    assert calendars.parse_ics(ics([f"DTSTART;VALUE=DATE:{stamp(-2)}", f"DTEND;VALUE=DATE:{stamp(3)}"])) == [(day(0), day(3))]
    for not_a_calendar in ("<html>Sign in</html>", "", "BEGIN:VEVENT\nDTSTART:20270101\nEND:VEVENT"):
        with pytest.raises(calendars.FeedError):
            calendars.parse_ics(not_a_calendar)
    flood = ics(*[[f"DTSTART;VALUE=DATE:{stamp(5)}", f"DTEND;VALUE=DATE:{stamp(6)}"]] * (calendars.MAX_EVENTS + 50))
    assert len(calendars.parse_ics(flood)) == 1  # capped, and duplicates collapse


def test_only_known_booking_sites_can_be_fetched(app):
    ok = ["https://www.airbnb.com/calendar/ical/123.ics?s=abc", "https://www.airbnb.it/calendar/ical/1.ics",
          "https://www.airbnb.co.uk/calendar/ical/1.ics", "https://ical.booking.com/v1/export?t=abc",
          "https://admin.booking.com/hotel/hoteladmin/ical.html?t=abc", "https://www.vrbo.com/icalendar/abc.ics",
          "https://calendar.google.com/calendar/ical/x/basic.ics"]
    bad = ["http://www.airbnb.com/calendar/ical/1.ics",  # not https
           "https://localhost/x.ics", "https://127.0.0.1/x.ics", "https://169.254.169.254/latest/meta-data",
           "https://[::1]/x.ics", "https://10.0.0.5/x.ics", "https://intranet/x.ics",
           "https://evil.example/airbnb.com/x.ics", "https://airbnb.com.evil.example/x.ics", "https://evilairbnb.com/x.ics",
           "https://notbooking.com/x.ics", "https://www.airbnb.com@evil.example/x.ics", "https://user:pw@www.airbnb.com/x.ics",
           "https://www.airbnb.com:8443/x.ics", "https://airbnb.evil.example/x.ics", "ftp://www.airbnb.com/x.ics",
           "file:///etc/passwd", "javascript:alert(1)", "//www.airbnb.com/x.ics", "", "https://"]
    for url in ok:
        assert calendars.feed_host_allowed(url), url
    for url in bad:
        assert not calendars.feed_host_allowed(url), url
        with pytest.raises(calendars.FeedError):
            calendars.fetch(url)  # refused before any request is made
    app.config["CALENDAR_FEED_HOSTS"] = ["smoobu.com"]
    assert calendars.feed_host_allowed("https://login.smoobu.com/ical/1.ics")
    assert not calendars.feed_host_allowed("https://smoobu.com.evil.example/1.ics")


# ---- blocking by hand ---------------------------------------------------------------------
def test_host_blocks_dates_and_guests_cannot_book_them(host, client, house):
    hid = house.id
    r = host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(10), "end_date": iso(13), "note": "Family visit"})
    assert r.status_code == 201
    view = r.get_json()
    assert [(b["start_date"], b["end_date"], b["manual"]) for b in view["blocks"]] == [(iso(10), iso(13), True)]
    nights = client.get(f"/api/hotels/{hid}/availability?from={iso(0)}&to={iso(30)}").get_json()["booked_nights"]
    assert nights == [iso(10), iso(11), iso(12)]  # the 13th is free again
    quote = {"hotel_id": hid, "start_date": iso(12), "end_date": iso(15), "guest_count": 2}
    assert client.post("/api/bookings/quote", json=quote).get_json()["available"] is False
    body = {**quote, "guest_name": "Ana Guest", "guest_email": "ana@example.com"}
    assert client.post("/api/bookings/", json=body).status_code == 409
    # Back-to-back is fine: arriving the day the block ends.
    assert client.post("/api/bookings/", json={**body, "start_date": iso(13), "end_date": iso(15)}).status_code == 201
    # A block can't be laid over a booking, start in the past or run backwards.
    assert host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(14), "end_date": iso(16)}).status_code == 409
    assert host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(-1), "end_date": iso(2)}).status_code == 400
    assert host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(20), "end_date": iso(20)}).status_code == 400
    assert host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(20), "end_date": iso(20 + 500)}).status_code == 400
    # The booking shows in the calendar by first name only.
    view = host.get(f"/api/calendar/stays/{hid}").get_json()
    assert view["bookings"][0]["guest"] == "Ana" and "ana@example.com" not in str(view)
    assert host.delete(f"/api/calendar/stays/{hid}/blocks/{view['blocks'][0]['id']}").status_code == 200
    assert client.post("/api/bookings/quote", json={**quote, "start_date": iso(10), "end_date": iso(12)}).get_json()["available"] is True


def test_calendar_is_only_for_whoever_runs_the_stay(app, host, client, house):
    owner = account(app, "owner@bluebay.example")
    business = make_business(owner)
    approve(host, "business", business["id"])
    mine = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    rival = account(app, "rival@example.com")
    make_business(rival, name="Rival Rentals")
    block = {"start_date": iso(5), "end_date": iso(7)}

    # Not signed in, an ordinary account, another business: nothing.
    assert client.get(f"/api/calendar/stays/{house.id}").status_code == 401
    assert client.post(f"/api/calendar/stays/{house.id}/blocks", json=block).status_code == 401
    for who in (owner, rival):
        assert who.get(f"/api/calendar/stays/{house.id}").status_code == 404
        assert who.post(f"/api/calendar/stays/{house.id}/blocks", json=block).status_code == 404
    for path in ("", "/blocks", "/feeds", "/sync"):
        method = rival.get if path == "" else rival.post
        assert method(f"/api/calendar/stays/{mine['id']}{path}", **({} if path == "" else {"json": block})).status_code == 404
    # The owner manages their own stay; the site's host leaves partners' calendars alone.
    assert owner.post(f"/api/calendar/stays/{mine['id']}/blocks", json=block).status_code == 201
    assert host.get(f"/api/calendar/stays/{mine['id']}").status_code == 404
    block_id = DateBlock.query.filter_by(hotel_id=mine["id"]).one().id
    assert rival.delete(f"/api/calendar/stays/{mine['id']}/blocks/{block_id}").status_code == 404
    assert DateBlock.query.count() == 1
    assert client.get("/api/calendar/stays/999999").status_code == 401


# ---- other booking sites -----------------------------------------------------------------------
def test_importing_a_feed_blocks_those_nights_and_follows_changes(host, client, house, feed_text):
    hid = house.id
    feed_text["text"] = ics([f"DTSTART;VALUE=DATE:{stamp(10)}", f"DTEND;VALUE=DATE:{stamp(12)}", "SUMMARY:Reserved"])
    for bad in ("https://evil.example/cal.ics", "http://www.airbnb.com/cal.ics", "https://127.0.0.1/cal.ics", "not a link"):
        r = host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "Airbnb", "url": bad})
        assert r.status_code == 400 and "url" in r.get_json()["fields"], bad
    assert feed_text["calls"] == 0  # a refused link is never fetched

    url = "https://www.airbnb.com/calendar/ical/123.ics?s=secret"
    r = host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "Airbnb", "url": url})
    assert r.status_code == 201
    view = r.get_json()
    feed = view["feeds"][0]
    assert feed["events"] == 1 and feed["last_error"] is None and feed["last_ok_at"]
    assert [(b["start_date"], b["end_date"], b["manual"]) for b in view["blocks"]] == [(iso(10), iso(12), False)]
    assert host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "Again", "url": url}).status_code == 400
    body = {"hotel_id": hid, "start_date": iso(11), "end_date": iso(14), "guest_count": 2, "guest_name": "Ana", "guest_email": "ana@example.com"}
    assert client.post("/api/bookings/", json=body).status_code == 409
    # Imported nights can't be deleted here; that is done on the other site.
    assert host.delete(f"/api/calendar/stays/{hid}/blocks/{view['blocks'][0]['id']}").status_code == 404

    # The other site cancels that reservation and takes a new one.
    feed_text["text"] = ics([f"DTSTART;VALUE=DATE:{stamp(20)}", f"DTEND;VALUE=DATE:{stamp(23)}"])
    view = host.post(f"/api/calendar/stays/{hid}/sync").get_json()
    assert [(b["start_date"], b["end_date"]) for b in view["blocks"]] == [(iso(20), iso(23))]
    assert client.post("/api/bookings/", json=body).status_code == 201

    # If the other site is down, the last known nights stay blocked and the problem is shown.
    feed_text["error"] = "The calendar link couldn't be reached"
    view = host.post(f"/api/calendar/stays/{hid}/sync").get_json()
    assert view["feeds"][0]["last_error"] == "The calendar link couldn't be reached"
    assert len(view["blocks"]) == 1
    # Disconnecting removes what it imported.
    view = host.delete(f"/api/calendar/stays/{hid}/feeds/{feed['id']}").get_json()
    assert view["feeds"] == [] and view["blocks"] == [] and DateBlock.query.count() == 0


def test_a_new_booking_checks_stale_calendars_first(app, host, client, house, feed_text):
    hid = house.id
    host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "Booking.com", "url": "https://ical.booking.com/v1/export?t=abc"})
    assert feed_text["calls"] == 1
    body = {"hotel_id": hid, "start_date": iso(30), "end_date": iso(33), "guest_count": 2, "guest_name": "Ana", "guest_email": "ana@example.com"}
    # Fresh: no second fetch.
    assert client.post("/api/bookings/quote", json={k: body[k] for k in ("hotel_id", "start_date", "end_date", "guest_count")}).status_code == 200
    assert feed_text["calls"] == 1
    # Stale: the other site sold these nights a minute ago, and the booking here is refused.
    feed = CalendarFeed.query.one()
    feed.last_synced_at -= timedelta(hours=2)
    db.session.commit()
    feed_text["text"] = ics([f"DTSTART;VALUE=DATE:{stamp(31)}", f"DTEND;VALUE=DATE:{stamp(32)}"])
    assert client.post("/api/bookings/", json=body).status_code == 409
    assert feed_text["calls"] == 2
    assert feed_text["timeout"] == calendars.TIMEOUT_QUICK  # a guest is waiting: slow sites get less time
    # The scheduled job re-reads every calendar, without that hurry.
    result = app.test_cli_runner().invoke(args=["calendars", "sync"])
    assert result.exit_code == 0 and "Synced 1 of 1" in result.output and feed_text["calls"] == 3
    assert feed_text["timeout"] == calendars.TIMEOUT
    # With several stale calendars, a booking stops checking once its time budget is spent.
    for n in range(2):
        host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": f"Slow {n}", "url": f"https://www.airbnb.com/calendar/ical/{n}.ics"})
    for stale in CalendarFeed.query.all():
        stale.last_synced_at -= timedelta(hours=2)
    db.session.commit()
    before = feed_text["calls"]
    assert calendars.sync_stay(hid, older_than_minutes=30, budget_seconds=-1) == 0 and feed_text["calls"] == before
    assert calendars.sync_stay(hid, older_than_minutes=30, budget_seconds=6) == 3
    for feed in CalendarFeed.query.filter(CalendarFeed.name.like("Slow%")).all():
        host.delete(f"/api/calendar/stays/{hid}/feeds/{feed.id}")
    # Six calendars per stay at most.
    for n in range(calendars.MAX_FEEDS_PER_STAY - 1):
        assert host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": f"Site {n}", "url": f"https://www.vrbo.com/icalendar/{n}.ics"}).status_code == 201
    assert host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "One more", "url": "https://www.vrbo.com/icalendar/x.ics"}).status_code == 409


def test_export_link_shows_busy_nights_and_nothing_else(host, client, house, feed_text):
    hid = house.id
    feed_text["text"] = ics([f"DTSTART;VALUE=DATE:{stamp(40)}", f"DTEND;VALUE=DATE:{stamp(42)}"])
    view = host.post(f"/api/calendar/stays/{hid}/feeds", json={"name": "Airbnb", "url": "https://www.airbnb.com/calendar/ical/1.ics"}).get_json()
    host.post(f"/api/calendar/stays/{hid}/blocks", json={"start_date": iso(5), "end_date": iso(7), "note": "Painting the SECRET room"})
    client.post("/api/bookings/", json={"hotel_id": hid, "start_date": iso(10), "end_date": iso(12), "guest_count": 2,
                                        "guest_name": "Ana Privateperson", "guest_email": "ana@example.com", "notes": "arriving late"})
    path = re.sub(r"^https?://[^/]+", "", view["export_url"])
    assert re.fullmatch(r"/api/calendar/feed/[\w-]{30,}\.ics", path)
    r = client.get(path)
    assert r.status_code == 200 and r.mimetype == "text/calendar"
    text = r.get_data(as_text=True)
    for start, end in ((5, 7), (10, 12), (40, 42)):
        assert f"DTSTART;VALUE=DATE:{stamp(start)}\r\nDTEND;VALUE=DATE:{stamp(end)}" in text
    # Dates only: no names, e-mail addresses, notes, prices or references.
    for private in ("Ana", "Privateperson", "example.com", "SECRET", "arriving", "EUR", "Painting"):
        assert private not in text
    assert calendars.parse_ics(text) == [(day(5), day(7)), (day(10), day(12)), (day(40), day(42))]
    # Airbnb's own link leaves out what came from Airbnb, so nothing is echoed back.
    own = client.get(re.sub(r"^https?://[^/]+", "", view["feeds"][0]["export_url"])).get_data(as_text=True)
    assert stamp(40) not in own and stamp(10) in own
    # The link is the key: a wrong one gives nothing away.
    assert client.get("/api/calendar/feed/" + "x" * 32 + ".ics").status_code == 404
    assert client.get("/api/calendar/feed/.ics").status_code == 404
    assert client.get(path + "?skip=1%20OR%201=1").status_code == 200
