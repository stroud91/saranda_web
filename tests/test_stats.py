"""Visitor statistics: what is counted, what is not, and that nothing identifies a visitor."""
from datetime import date, timedelta

import pytest

from app.extensions import db
from app.models import StatCounter, StatVisitor
from app.services import stats
from tests.test_partners import HOST, account

CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
IPAD = "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/604.1"


def hit(client, path, agent=CHROME, ip="203.0.113.7", **body):
    return client.post("/api/meta/hit", json={"path": path, **body}, headers={"User-Agent": agent}, environ_base={"REMOTE_ADDR": ip})


def count(kind, key=""):
    row = StatCounter.query.filter_by(day=date.today(), kind=kind, key=key).first()
    return row.count if row else 0


@pytest.fixture()
def host(app):
    return account(app, HOST)


def test_page_views_and_visitors_are_counted_without_a_cookie(app, client):
    r = hit(client, "/stays/1", referrer="https://www.google.com/search?q=saranda+apartments", lang="de")
    assert r.status_code == 204 and "Set-Cookie" not in r.headers
    hit(client, "/explore/butrint", referrer="https://megrooms.test/stays/1", lang="de")
    hit(client, "/stays/1")
    hit(client, "/stays/1", agent=IPHONE, ip="198.51.100.9", referrer="https://l.instagram.com/?u=abc", lang="it")
    hit(client, "/", agent=IPAD, ip="198.51.100.10")
    assert (count("views"), count("visitors")) == (5, 3)
    assert (count("page", "/stays/1"), count("page", "/explore/butrint"), count("page", "/")) == (3, 1, 1)
    assert (count("entry", "/stays/1"), count("entry", "/")) == (2, 1)
    # Where a visitor came from is the other site's name only, counted once per visitor.
    assert (count("ref", "google.com"), count("ref", "l.instagram.com"), count("ref", "(direct)")) == (1, 1, 1)
    assert (count("lang", "de"), count("lang", "it"), count("lang", "en")) == (1, 1, 1)
    assert (count("device", "computer"), count("device", "phone"), count("device", "tablet")) == (1, 1, 1)
    # What is stored about people: three codes that say nothing by themselves.
    stored = " ".join(v.code for v in StatVisitor.query.all()) + " ".join(c.key for c in StatCounter.query.all())
    assert StatVisitor.query.count() == 3 and "203.0.113" not in stored and "Chrome" not in stored and "saranda+apartments" not in stored


def test_private_addresses_are_grouped_and_unknown_ones_ignored(app, client):
    hit(client, "/booking/7KQ2-9XWD-P3MA?paypal=return")
    hit(client, "/trip/AbCdEf123")
    hit(client, "/review/7KQ2-9XWD-P3MA?key=secret-key-value")
    hit(client, "/hotels/1")          # an old address is counted with the page it shows
    hit(client, "/wp-login.php")      # not a page of this site
    hit(client, "/stays/9999")
    hit(client, "/" + "x" * 300)
    keys = {c.key for c in StatCounter.query.filter_by(kind="page").all()}
    assert keys == {"/booking/…", "/trip/…", "/review/…", "/stays/1"}
    assert not [k for k in keys if "7KQ2" in k or "secret" in k]
    assert count("views") == 4
    assert client.post("/api/meta/hit", json={}).status_code == 400


def test_robots_and_the_host_are_not_counted(app, client, host):
    for agent in ("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "facebookexternalhit/1.1", "curl/8.5.0",
                  "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/130.0", "python-requests/2.34", ""):
        assert hit(client, "/", agent=agent).status_code == 204
    host.post("/api/meta/hit", json={"path": "/stays"}, headers={"User-Agent": CHROME})
    # A browser that asks not to be tracked isn't counted at all.
    for ask in ({"Sec-GPC": "1"}, {"DNT": "1"}):
        assert client.post("/api/meta/hit", json={"path": "/"}, headers={"User-Agent": CHROME, **ask}).status_code == 204
    assert count("views") == 0 and StatVisitor.query.count() == 0
    app.config["STATS_ENABLED"] = False
    hit(client, "/")
    assert count("views") == 0 and client.get("/api/meta/config").get_json()["stats"] is False


def test_yesterdays_visitor_cannot_be_recognised_today(app, client):
    today, yesterday = date.today(), date.today() - timedelta(days=1)
    assert stats.visitor_code("203.0.113.7", CHROME, today) != stats.visitor_code("203.0.113.7", CHROME, yesterday)
    assert stats.visitor_code("203.0.113.7", CHROME, today) == stats.visitor_code("203.0.113.7", CHROME, today)
    stats.record("/", ip="203.0.113.7", agent=CHROME, today=yesterday)
    stats.record("/", ip="203.0.113.7", agent=CHROME, today=today)
    assert StatVisitor.query.count() == 2  # counted as a new visitor each day
    # The daily clean-up deletes the codes of days gone by, and counters past their keep time.
    db.session.add(StatCounter(day=today - timedelta(days=900), kind="views", key="", count=5))
    db.session.commit()
    result = app.test_cli_runner().invoke(args=["users", "cleanup"])
    assert result.exit_code == 0
    assert [v.day for v in StatVisitor.query.all()] == [today]
    assert StatCounter.query.filter(StatCounter.day < today - timedelta(days=800)).count() == 0
    assert StatCounter.query.filter_by(day=yesterday, kind="visitors").one().count == 1  # the totals stay


def test_host_report(app, client, host):
    today = date.today()
    for offset, visitors in ((0, 3), (1, 5), (40, 9)):
        day = today - timedelta(days=offset)
        for n in range(visitors):
            stats.record("/stays/1" if n % 2 else "/", ip=f"198.51.100.{n}", agent=CHROME, referrer="https://www.booking.com/x" if n == 0 else "",
                         lang="sq" if n == 1 else "en", today=day)
    book = client.post("/api/bookings/", json={"hotel_id": 1, "start_date": (today + timedelta(days=20)).isoformat(),
                                               "end_date": (today + timedelta(days=23)).isoformat(), "guest_count": 2,
                                               "guest_name": "Ana Guest", "guest_email": "ana@example.test"})
    assert book.status_code == 201
    report = host.get("/api/admin/stats?days=30").get_json()
    assert report["enabled"] and report["days"] == 30 and len(report["series"]) == 30
    assert report["series"][-1] == {"day": today.isoformat(), "visitors": 3, "views": 3, "bookings": 1}
    assert report["series"][-2]["visitors"] == 5 and report["totals"] == {"visitors": 8, "views": 8, "bookings": 1}
    assert report["pages"][0] == {"key": "/", "count": 5} and report["pages"][1] == {"key": "/stays/1", "count": 3}
    assert {"key": "booking.com", "count": 2} in report["referrers"] and report["referrers"][0]["key"] == "(direct)"
    assert {"key": "sq", "count": 2} in report["languages"] and report["devices"] == [{"key": "computer", "count": 8}]
    assert host.get("/api/admin/stats?days=90").get_json()["totals"]["visitors"] == 17
    assert host.get("/api/admin/stats?days=9999").status_code == 400
    assert client.get("/api/admin/stats").status_code == 401
    assert account(app, "eve@example.test").get("/api/admin/stats").status_code == 403
