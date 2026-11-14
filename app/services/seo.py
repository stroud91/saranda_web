"""What search engines and link previews see.

The site is a single-page app: left alone, every address would answer with the
same title and description, and a link pasted into WhatsApp or Facebook would
show a generic card. Here each public address gets its own title, description,
canonical link, language alternates and preview image, written into the page
before it is sent. Private pages are marked "noindex", and addresses that lead
nowhere answer 404 instead of pretending to be a page.

Everything written into the page is escaped, including text that hosts and
businesses typed.
"""
import json
import os
import re
from xml.sax.saxutils import escape as xml_escape

from flask import current_app
from markupsafe import escape

from app.data import DESTINATION_INDEX, DESTINATIONS, ITINERARIES, ITINERARY_INDEX
from app.models import Business, Guide, Hotel

SITE = "Saranda Companion"
LANGS = ("en", "sq", "fr", "it", "de")
OG_LOCALE = {"en": "en_GB", "sq": "sq_AL", "fr": "fr_FR", "it": "it_IT", "de": "de_DE"}
DEFAULT_IMAGE = "/og-default.jpg"

# Fixed pages: address -> (title, description).
PAGES = {
    "": ("Saranda Companion · Albania trip planner & Meg'Rooms stays",
         "Your Albania travel companion from Sarandë: live route times, day-by-day timelines, budgets, local guides and Meg'Rooms stays on the Ionian coast."),
    "explore": ("Places to visit in Albania · Saranda Companion",
                "Beaches, UNESCO towns, viewpoints and boat-only bays across southern Albania and beyond, with what each is best for and how long to allow."),
    "routes": ("Driving times in Albania · Saranda Companion",
               "Realistic drive and ferry times between Sarandë, Ksamil, Butrint, Gjirokastër, Himarë, Berat, Tirana and Corfu."),
    "map": ("Map of Albania's highlights · Saranda Companion",
            "An interactive map of beaches, towns, castles and viewpoints, with the routes between them."),
    "atlas": ("3D atlas of Albania · Saranda Companion",
              "Fly over Albania in 3D: the Riviera, the Alps and the routes between the places worth a stop."),
    "plan": ("Albania trip planner · Saranda Companion",
             "Build a day-by-day Albania itinerary with drive times, a timeline for each day and a budget, then share it."),
    "itineraries": ("Albania itineraries from 1 to 14 days · Saranda Companion",
                    "Ready-made routes: a 3-day Sarandë base, a week of southern highlights, a 10-day explorer, a 14-day grand tour and Corfu combinations."),
    "guides": ("Local guides in southern Albania · Saranda Companion",
               "Book a local guide for Butrint, the Riviera, Gjirokastër and boat days. Prices are shown up front and the guide confirms before you pay."),
    "stays": ("Meg'Rooms apartments in Sarandë · book direct",
              "Bright apartments steps from the Sarandë promenade. Check live availability and book directly with the host."),
    "experiences": ("Tours, activities and car rental in Sarandë · Saranda Companion",
                    "Day tours, boat trips and rental cars around Sarandë and the Albanian Riviera, from local businesses."),
    "essentials": ("Albania travel essentials: money, seasons, safety · Saranda Companion",
                   "When to go, what it costs, money and cards, food to try, packing lists, the Corfu ferry and emergency numbers."),
    "partners": ("Local businesses in Sarandë and the Riviera · Saranda Companion",
                 "Independent local hosts, rental companies and tour operators we've checked. Contact them directly."),
    "business": ("List your business · Saranda Companion",
                 "Rent out apartments, cars or boats, or run tours? Add your business for free and manage everything in one place."),
    "contact": ("Contact Meg'Rooms · Saranda Companion",
                "Questions about a stay, a guide or your trip? Send a message or reach us on WhatsApp."),
    "privacy": ("Privacy policy · Saranda Companion",
                "How Meg'Rooms uses the details you share: no advertising, no tracking cookies, and your data is never sold."),
    "terms": ("Booking terms · Saranda Companion",
              "How booking, payment, cancellation and refunds work for Meg'Rooms apartments, guides and local businesses."),
    "credits": ("Credits and licences · Saranda Companion", "Photo, video, map and data credits for Saranda Companion."),
}
# Old addresses that show the same page as a newer one.
ALIASES = {"hotels": "stays", "tours": "experiences", "about-us": "contact"}
# Pages that only make sense to the person looking at them.
PRIVATE = {"account", "signin", "signup", "forgot-password", "reset-password", "verify-email"}
PRIVATE_PREFIXES = ("booking/", "guide-request/", "trip/")
ASSET = re.compile(r"\.(js|mjs|css|map|png|jpe?g|webp|gif|svg|ico|mp4|webm|woff2?|ttf|json|txt|xml|webmanifest)$", re.I)


class Meta:
    def __init__(self, title, description, path, *, image=None, noindex=False, kind="website", data=None):
        self.title, self.description, self.path = title, description, path
        self.image, self.noindex, self.kind, self.data = image, noindex, kind, data or []


NOT_FOUND = Meta(f"Page not found · {SITE}", "This page doesn't exist. Head back to the start to plan your trip.", "", noindex=True)


def _short(text, limit=158):
    text = " ".join((text or "").split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0].rstrip(",;:—-")
    return cut + "…"


def _local(obj, field, lang):
    """A record's text in ``lang`` when its host wrote one, else the original."""
    words = (obj.translations or {}).get(lang) if lang else None
    return (words or {}).get(field) or getattr(obj, field)


def _stay(hotel_id, lang):
    from app.services import partners  # local import: partners imports the models too

    hotel = Hotel.query.filter(Hotel.id == hotel_id, Hotel.is_active.isnot(False), partners.public_filter(Hotel)).first()
    if not hotel:
        return None
    name, text = _local(hotel, "hotel_name", lang), _local(hotel, "description", lang)
    price = f"{float(hotel.price_per_night):g}"
    photos = [u for u in (hotel.image_urls or []) if isinstance(u, str)]
    host = hotel.business.name if hotel.business else "Meg'Rooms"
    data = {
        "@context": "https://schema.org", "@type": "LodgingBusiness", "name": name, "description": _short(text, 300),
        "address": {"@type": "PostalAddress", "streetAddress": hotel.address, "addressLocality": hotel.city, "addressCountry": "AL"},
        "priceRange": f"from €{price} per night", "image": photos[:6],
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": a, "value": True} for a in (hotel.amenities or [])[:20]],
    }
    return Meta(f"{name} in {hotel.city} · from €{price} a night · {host}", _short(text), f"stays/{hotel.id}",
                image=photos[0] if photos else None, kind="place", data=[data])


def resolve(path, lang=None):
    """The title and description for an address, or None if no page lives there."""
    path = (path or "").strip("/")
    head, _, rest = path.partition("/")
    head = ALIASES.get(head, head)
    if not rest:
        if head in PAGES:
            return Meta(*PAGES[head], head)
        if head in PRIVATE:
            return Meta(SITE, PAGES[""][1], head, noindex=True)
        return None
    if path.startswith(PRIVATE_PREFIXES) and "/" not in rest:
        return Meta(SITE, PAGES[""][1], path, noindex=True)
    if "/" in rest:
        return None
    if head == "explore" and rest in DESTINATION_INDEX:
        place = DESTINATION_INDEX[rest]
        return Meta(f"{place['name']} · Albania travel guide · {SITE}", _short(place["summary"]), path, kind="article")
    if head == "itineraries" and rest in ITINERARY_INDEX:
        plan = ITINERARY_INDEX[rest]
        return Meta(f"{plan['title']} · {SITE}", _short(f"{plan['tagline']}. {plan['why']}"), path, kind="article")
    if head == "stays" and rest.isdigit() and len(rest) < 10:
        return _stay(int(rest), lang)
    if head == "guides":
        guide = Guide.listed().filter(Guide.slug == rest).first() if re.fullmatch(r"[a-z0-9-]{1,80}", rest) else None
        if guide:
            return Meta(f"{guide.name} · local guide in {guide.base_city} · {SITE}", _short(_local(guide, "headline", lang) + ". " + _local(guide, "bio", lang)),
                        path, kind="profile")
    if head == "partners":
        from app.services import partners

        business = (Business.query.filter_by(slug=rest, status="approved").first()
                    if partners.enabled() and re.fullmatch(r"[a-z0-9-]{1,80}", rest) else None)
        if business:
            about = _local(business, "tagline", lang) or _local(business, "description", lang)
            return Meta(f"{business.name} · {business.city} · {SITE}", _short(about), path, kind="profile")
    return None


def is_asset(path):
    """A file request (script, image…) rather than a page: a missing one is a plain 404."""
    return path.startswith("assets/") or bool(ASSET.search(path))


# ---- writing it into the page ---------------------------------------------------
_shell = {"path": None, "mtime": None, "html": None}


def shell(index_path):
    mtime = os.path.getmtime(index_path)
    if _shell["path"] != index_path or _shell["mtime"] != mtime:
        with open(index_path, encoding="utf-8") as fh:
            _shell.update(path=index_path, mtime=mtime, html=fh.read())
    return _shell["html"]


def _abs(base, url):
    return url if url.startswith("http") else f"{base}{url}"


def render(html, meta, base, lang="en"):
    """The page shell with this address's own head tags. ``base`` is the site's address, without a slash."""
    lang = lang if lang in LANGS else "en"
    url = f"{base}/{meta.path}" if meta.path else f"{base}/"
    here = url if lang == "en" else f"{url}?lang={lang}"
    title, text = escape(meta.title), escape(meta.description)
    tags = [
        f'<link rel="canonical" href="{escape(here)}" />',
        f'<meta property="og:url" content="{escape(here)}" />',
        f'<meta property="og:type" content="{escape(meta.kind)}" />',
        f'<meta property="og:site_name" content="{SITE}" />',
        f'<meta property="og:locale" content="{OG_LOCALE[lang]}" />',
        f'<meta property="og:image" content="{escape(_abs(base, meta.image or DEFAULT_IMAGE))}" />',
        '<meta name="twitter:card" content="summary_large_image" />',
    ]
    if meta.noindex:
        tags.append('<meta name="robots" content="noindex, nofollow" />')
    else:
        tags.append(f'<link rel="alternate" hreflang="x-default" href="{escape(url)}" />')
        tags += [f'<link rel="alternate" hreflang="{code}" href="{escape(url if code == "en" else f"{url}?lang={code}")}" />' for code in LANGS]
        for block in meta.data:
            block = {**block, "url": here, "image": [_abs(base, u) for u in block.get("image", [])] or [_abs(base, DEFAULT_IMAGE)]}
            # "<" is written as < so text typed by a host can never close the script tag.
            tags.append('<script type="application/ld+json">' + json.dumps(block, ensure_ascii=False).replace("<", "\\u003c") + "</script>")
    html = re.sub(r"<title>.*?</title>", lambda _: f"<title>{title}</title>", html, count=1, flags=re.S)
    html = re.sub(r'<meta name="description" content="[^"]*" ?/?>', lambda _: f'<meta name="description" content="{text}" />', html, count=1)
    html = re.sub(r'<meta property="og:title" content="[^"]*" ?/?>', lambda _: f'<meta property="og:title" content="{title}" />', html, count=1)
    html = re.sub(r'<meta property="og:description" content="[^"]*" ?/?>', lambda _: f'<meta property="og:description" content="{text}" />', html, count=1)
    html = re.sub(r'<html lang="[^"]*"', lambda _: f'<html lang="{lang}"', html, count=1)
    return html.replace("</head>", "    " + "\n    ".join(tags) + "\n  </head>", 1)


# ---- sitemap and robots ---------------------------------------------------------
def public_paths():
    """Every indexable address with the day it last changed (or None)."""
    from app.services import partners

    out = [(path, None) for path in PAGES]
    out += [(f"explore/{d['slug']}", None) for d in DESTINATIONS]
    out += [(f"itineraries/{i['slug']}", None) for i in ITINERARIES]
    stays = Hotel.query.filter(Hotel.is_active.isnot(False), partners.public_filter(Hotel)).order_by(Hotel.id).all()
    out += [(f"stays/{h.id}", h.updated_at) for h in stays]
    out += [(f"guides/{g.slug}", g.updated_at) for g in Guide.listed().order_by(Guide.id).all()]
    if partners.enabled():
        out += [(f"partners/{b.slug}", b.updated_at) for b in Business.query.filter_by(status="approved").order_by(Business.id).all()]
    return out


def sitemap(base):
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for path, changed in public_paths():
        url = xml_escape(f"{base}/{path}" if path else f"{base}/")
        lines.append(f"  <url><loc>{url}</loc>")
        if changed:
            lines.append(f"    <lastmod>{(changed.date() if hasattr(changed, 'date') else changed).isoformat()}</lastmod>")
        for code in LANGS:
            lines.append(f'    <xhtml:link rel="alternate" hreflang="{code}" href="{url if code == "en" else url + "?lang=" + code}" />')
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def robots(base):
    """Everything public may be crawled; private pages and the API may not."""
    blocked = ["/api/"] + [f"/{p}" for p in sorted(PRIVATE)] + [f"/{p}" for p in PRIVATE_PREFIXES]
    lines = ["User-agent: *"] + [f"Disallow: {p}" for p in blocked] + [""]
    if base:
        lines += [f"Sitemap: {base}/sitemap.xml", ""]
    return "\n".join(lines)


def base_url(request):
    """The site's own address, or "" when it isn't known.

    In production it only ever comes from PUBLIC_BASE_URL: a forged Host header
    must not be able to put someone else's domain into canonical links or the sitemap.
    """
    configured = (current_app.config.get("PUBLIC_BASE_URL") or "").rstrip("/")
    if configured or current_app.config.get("IS_PRODUCTION"):
        return configured
    return request.url_root.rstrip("/")
