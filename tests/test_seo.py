"""What crawlers and link previews are served: per-page titles and descriptions,
canonical links, language alternates, structured data, sitemap and robots."""
import json
import os
import re
import shutil
import xml.etree.ElementTree as ET

import pytest

import app as app_module
from app.extensions import db
from app.models import Hotel
from app.services import seo
from tests.test_partners import HOST, STAY, account, approve, make_business

ROOT = os.path.dirname(os.path.dirname(__file__))
BASE = "https://megrooms.test"  # TestConfig.PUBLIC_BASE_URL


@pytest.fixture(autouse=True)
def built_site(tmp_path, monkeypatch):
    """A stand-in for the built frontend: the real page shell, and one script file."""
    site = tmp_path / "site"
    (site / "assets").mkdir(parents=True)
    shutil.copy(os.path.join(ROOT, "travago-tour-app", "index.html"), site / "index.html")
    (site / "assets" / "app.js").write_text("console.log(1)")
    monkeypatch.setattr(app_module, "STATIC_DIR", str(site))


def head(client, path, **kwargs):
    r = client.get(path, **kwargs)
    html = r.get_data(as_text=True)
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', html)
    canon = re.search(r'<link rel="canonical" href="([^"]*)"', html)
    return r, html, title and title.group(1), desc and desc.group(1), canon and canon.group(1)


def test_every_public_page_has_its_own_title_description_and_canonical(client):
    r, html, title, desc, canon = head(client, "/")
    assert r.status_code == 200 and r.mimetype == "text/html" and r.headers["Cache-Control"] == "no-cache"
    assert "Albania trip planner" in title and canon == f"{BASE}/" and "noindex" not in html
    assert '<div id="root"></div>' in html and html.count("<title>") == 1 and html.count('name="description"') == 1
    assert len(re.findall(r'rel="alternate" hreflang="', html)) == 6  # five languages and x-default
    assert f'hreflang="de" href="{BASE}/?lang=de"' in html and f'property="og:image" content="{BASE}/og-default.jpg"' in html
    seen = {title}
    for path in ("/explore", "/stays", "/itineraries", "/essentials", "/experiences", "/plan", "/privacy", "/terms", "/partners", "/guides"):
        r, html, title, desc, canon = head(client, path)
        assert r.status_code == 200 and canon == BASE + path and 40 < len(desc) <= 160, path
        assert title not in seen, path
        seen.add(title)
    r, html, title, desc, canon = head(client, "/explore/butrint")
    assert title.startswith("Butrint ·") and "UNESCO" in desc and canon == f"{BASE}/explore/butrint" and 'og:type" content="article"' in html
    r, html, title, desc, canon = head(client, "/itineraries/7-day-highlights")
    assert "7-Day Albania Highlights" in title and r.status_code == 200
    # Old addresses point search engines at the current one.
    assert head(client, "/hotels")[4] == f"{BASE}/stays" and head(client, "/hotels/1")[4] == f"{BASE}/stays/1"


def test_stay_pages_carry_price_language_and_structured_data(client):
    r, html, title, desc, canon = head(client, "/stays/1")
    assert r.status_code == 200 and "Apartment 4 — Sea View in Sarandë · from €65 a night · Meg&#39;Rooms" == title
    assert desc.startswith("Wake up to stunning Ionian Sea views") and len(desc) <= 160
    data = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1))
    assert data["@type"] == "LodgingBusiness" and data["name"] == "Apartment 4 — Sea View" and data["url"] == f"{BASE}/stays/1"
    assert data["address"]["addressLocality"] == "Sarandë" and data["address"]["addressCountry"] == "AL" and data["image"] == [f"{BASE}/og-default.jpg"]
    # In another language: the host's translation, the right html lang, and a canonical of its own.
    r, html, title, desc, canon = head(client, "/stays/1?lang=de")
    assert title.startswith("Apartment 4 — Meerblick in Sarandë") and desc.startswith("Wachen Sie in diesem hellen")
    assert '<html lang="de"' in html and canon == f"{BASE}/stays/1?lang=de" and 'og:locale" content="de_DE"' in html
    assert '<html lang="en"' in head(client, "/stays/1?lang=xx")[1]  # an unknown language is just English


def test_addresses_that_lead_nowhere_answer_404_and_private_pages_are_not_indexed(app, client):
    for path in ("/nowhere", "/explore/atlantis", "/stays/9999", "/stays/abc", "/itineraries/x/y", "/guides/nobody", "/partners/nobody", "/explore/butrint/extra"):
        r, html, title, *_ = head(client, path)
        assert r.status_code == 404 and "noindex" in html and '<div id="root"></div>' in html and "not found" in title.lower(), path
    for path in ("/account", "/signin", "/booking/BABC123", "/trip/abc123", "/guide-request/GXYZ"):
        r, html, *_ = head(client, path)
        assert r.status_code == 200 and "noindex, nofollow" in html and "hreflang" not in html, path
    # A missing script or image is a plain 404, never a web page pretending to be the file.
    for path in ("/assets/gone-abc123.js", "/assets/gone.css", "/old-photo.jpg", "/favicon-missing.ico"):
        r = client.get(path)
        assert r.status_code == 404 and r.is_json, path
    assert client.get("/assets/app.js").status_code == 200
    # Paused and unapproved stays have no page.
    stay = db.session.get(Hotel, 2)
    stay.is_active = False
    db.session.commit()
    assert client.get("/stays/2").status_code == 404
    host, owner = account(app, HOST), account(app, "owner@bluebay.example")
    business = make_business(owner)
    pending = owner.post("/api/partner/listings/stays", json=STAY).get_json()
    assert client.get(f"/stays/{pending['id']}").status_code == 404 and client.get("/partners/blue-bay-rentals").status_code == 404
    approve(host, "business", business["id"])
    approve(host, "stays", pending["id"])
    r, html, title, *_ = head(client, f"/stays/{pending['id']}")
    assert r.status_code == 200 and title.endswith("· Blue Bay Rentals")
    assert "Blue Bay Rentals · Ksamil" in head(client, "/partners/blue-bay-rentals")[2]


def test_text_typed_by_a_host_cannot_break_out_of_the_page(app, client):
    host = account(app, HOST)
    nasty = '</title></script><script>alert(1)</script>"><img src=x onerror=alert(2)>'
    assert host.put("/api/admin/listings/stays/1", json={"hotel_name": nasty[:120], "description": nasty + " A nice place."}).status_code == 200
    r, html, title, desc, canon = head(client, "/stays/1")
    assert r.status_code == 200
    assert "<script>alert(1)</script>" not in html and "<img src=x" not in html and html.count("</title>") == 1
    assert html.count("<script") == html.count("</script>") == 3  # boot.js, the app, and the data block
    block = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S).group(1)
    assert "<" not in block and json.loads(block)["name"]
    # A forged Host header never ends up in the links.
    r, html, *_ = head(client, "/stays/1", headers={"Host": "evil.example"})
    assert "evil.example" not in html


def test_sitemap_and_robots(app, client):
    r = client.get("/sitemap.xml")
    assert r.status_code == 200 and r.mimetype == "application/xml"
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "x": "http://www.w3.org/1999/xhtml"}
    root = ET.fromstring(r.get_data(as_text=True))
    urls = [u.find("s:loc", ns).text for u in root.findall("s:url", ns)]
    assert f"{BASE}/" in urls and f"{BASE}/explore/butrint" in urls and f"{BASE}/stays/1" in urls and f"{BASE}/itineraries/7-day-highlights" in urls
    assert len(urls) == len(set(urls)) and all(u.startswith(BASE) for u in urls)
    assert not [u for u in urls if re.search(r"/(account|signin|booking|trip|api|hotels|tours)\b", u)]
    assert all(len(u.findall("x:link", ns)) == 5 for u in root.findall("s:url", ns))
    # Every address in the sitemap really is a page.
    for url in urls:
        assert client.get(url[len(BASE):] or "/").status_code == 200, url
    robots = client.get("/robots.txt")
    text = robots.get_data(as_text=True)
    assert robots.mimetype == "text/plain" and "Disallow: /api/" in text and "Disallow: /account" in text and f"Sitemap: {BASE}/sitemap.xml" in text
    # Without a configured address, a production site publishes no sitemap rather than trust the Host header.
    app.config.update(PUBLIC_BASE_URL="", IS_PRODUCTION=True)
    assert client.get("/sitemap.xml", headers={"Host": "evil.example"}).status_code == 404
    assert "Sitemap" not in client.get("/robots.txt").get_data(as_text=True)
    assert "evil.example" not in client.get("/", headers={"Host": "evil.example"}).get_data(as_text=True)


def test_every_route_of_the_app_is_known_to_the_server():
    """A page added to the frontend must be given a title here (or marked private),
    otherwise the server would answer 404 for it."""
    source = open(os.path.join(ROOT, "travago-tour-app", "src", "App.jsx"), encoding="utf-8").read()
    routes = re.findall(r'<Route path="([^"*]+)"', source)
    assert len(routes) > 30
    known = set(seo.PAGES) | set(seo.ALIASES) | seo.PRIVATE
    dynamic = {"explore", "itineraries", "stays", "hotels", "guides", "partners"} | {p.rstrip("/") for p in seo.PRIVATE_PREFIXES}
    for route in routes:
        first, _, rest = route.strip("/").partition("/")
        assert (first in known) if not rest else (first in dynamic and rest.startswith(":")), route


def test_static_build_gets_a_page_per_address(tmp_path, monkeypatch):
    from scripts import prerender_static

    build = tmp_path / "build"
    build.mkdir()
    shutil.copy(os.path.join(ROOT, "travago-tour-app", "index.html"), build / "index.html")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://example-stays.test")
    written = prerender_static.main(str(build))
    assert written > 40
    stay = (build / "stays" / "1" / "index.html").read_text(encoding="utf-8")
    assert "<title>Apartment 4 — Sea View in Sarandë" in stay and 'rel="canonical" href="https://example-stays.test/stays/1"' in stay
    assert "Butrint ·" in (build / "explore" / "butrint" / "index.html").read_text(encoding="utf-8")
    assert "canonical" not in (build / "index.html").read_text(encoding="utf-8")  # the fallback page stays generic
    assert not (build / "account").exists() and (build / "guides" / "index.html").exists()  # private pages get none
    sitemap = (build / "sitemap.xml").read_text(encoding="utf-8")
    assert "<loc>https://example-stays.test/stays/1</loc>" in sitemap and ET.fromstring(sitemap) is not None
    assert "Sitemap: https://example-stays.test/sitemap.xml" in (build / "robots.txt").read_text(encoding="utf-8")
    monkeypatch.setenv("PUBLIC_BASE_URL", "http://insecure.test")
    with pytest.raises(SystemExit):
        prerender_static.main(str(build))
