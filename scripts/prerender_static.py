"""Give the static build its own title and description for every public page.

The static upload (Namecheap public_html, no Python app) answers every address
with the same index.html, so search engines and link previews would see one
title for the whole site. This writes ``<page>/index.html`` next to it for each
public address, with the same head tags the Python app sends (see
``app/services/seo.py``), plus ``sitemap.xml`` and ``robots.txt``.

Run after ``npm run build:static``:

    PUBLIC_BASE_URL=https://yourdomain python scripts/prerender_static.py

Without PUBLIC_BASE_URL the pages still get titles and descriptions, but no
canonical links and no sitemap (both need the site's full address).
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


def main(build_dir=None):
    from scripts.export_static import _app

    from app.extensions import db
    from app.seeds.car_rentals import seed_car_rentals
    from app.seeds.guides import seed_guides
    from app.seeds.hotels import seed_hotels
    from app.seeds.tours import seed_tours
    from app.services import seo

    build_dir = os.path.abspath(build_dir or os.path.join(ROOT, "travago-tour-app", "build"))
    index = os.path.join(build_dir, "index.html")
    if not os.path.isfile(index):
        raise SystemExit(f"{index} not found. Run `npm run build:static` first.")
    base = (os.environ.get("PUBLIC_BASE_URL") or "").strip().rstrip("/")
    if base and not base.startswith("https://"):
        raise SystemExit("PUBLIC_BASE_URL must start with https://")

    app = _app()  # the same seeded data the static bundle was exported from
    with app.app_context():
        db.create_all()
        seed_hotels()
        seed_guides()
        seed_tours()
        seed_car_rentals()
        shell = seo.shell(index)
        written = 0
        for path, _ in seo.public_paths():
            if not path:
                continue  # index.html itself stays generic: it also answers private pages
            meta = seo.resolve(path)
            if not meta:
                continue
            folder = os.path.join(build_dir, *path.split("/"))
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, "index.html"), "w", encoding="utf-8") as fh:
                fh.write(seo.render(shell, meta, base))
            written += 1
        with open(os.path.join(build_dir, "robots.txt"), "w", encoding="utf-8") as fh:
            fh.write(seo.robots(base))
        if base:
            with open(os.path.join(build_dir, "sitemap.xml"), "w", encoding="utf-8") as fh:
                fh.write(seo.sitemap(base))
    print(f"wrote {written} pages" + (f", sitemap.xml and robots.txt for {base}" if base else " (no PUBLIC_BASE_URL: no sitemap or canonical links)"))
    return written


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
