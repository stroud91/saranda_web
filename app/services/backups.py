"""Backups of what a deploy can't recreate: the database and the uploaded photos.

Files in BACKUP_DIR (default ``instance/backups``, never served to the web):

    data-20261115-031500.tar.gz      the database; one for every run
    photos-20261115-031500.tar.gz    every uploaded photo; only when photos changed,
                                     and at most once every BACKUP_PHOTOS_EVERY_DAYS

With BACKUP_PASSPHRASE set, each file is encrypted (AES-256-GCM, key from the
passphrase with scrypt) and its name ends in ``.enc``. Backups hold guests'
personal details, so they only ever leave this server encrypted.

Old files are thinned out: the newest BACKUP_KEEP_DAILY, then one per week and
one per month. BACKUP_UPLOAD_URL (an https WebDAV folder) gets a copy of every
new file, because a backup on the same server doesn't survive losing the server.

Run from cron: ``flask backup run``. Check one: ``flask backup verify``.
"""
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta

import requests
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from flask import current_app

from app.models import Booking, Hotel, User, db
from app.models.db import utcnow
from app.services import uploads

NAME = re.compile(r"^(data|photos)-(\d{8}-\d{6})\.tar\.gz(\.enc)?$")
PHOTO = re.compile(r"^uploads/([a-f0-9]{32}(?:_s)?\.jpg)$")  # the only names uploads.py ever writes
MAGIC = b"SCBACKUP1\n"
CHUNK = 1024 * 1024
STAMP = "%Y%m%d-%H%M%S"


class BackupError(Exception):
    pass


def _cfg(name, default=None):
    return current_app.config.get(name, default)


def folder():
    path = _cfg("BACKUP_DIR") or os.path.join(current_app.instance_path, "backups")
    os.makedirs(path, mode=0o700, exist_ok=True)
    return path


def listing():
    """Backups on this server, newest first."""
    rows = []
    for name in os.listdir(folder()):
        m = NAME.match(name)
        if m:
            rows.append({"name": name, "kind": m.group(1), "at": datetime.strptime(m.group(2), STAMP),
                         "bytes": os.path.getsize(os.path.join(folder(), name)), "encrypted": bool(m.group(3))})
    return sorted(rows, key=lambda r: (r["at"], r["name"]), reverse=True)


def latest(kind="data"):
    return next((row for row in listing() if row["kind"] == kind), None)


# ---- what happened last time (read by the health check) ------------------------
def state():
    try:
        with open(os.path.join(folder(), "state.json"), encoding="utf-8") as fh:
            data = json.load(fh)
            return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _save_state(**changes):
    data = {**state(), **changes}
    path = os.path.join(folder(), "state.json")
    with open(os.open(path + ".part", os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as fh:
        json.dump(data, fh)
    os.replace(path + ".part", path)
    return data


# ---- encryption ------------------------------------------------------------------
# File layout: MAGIC, 16-byte salt, 7-byte nonce prefix, then the data in pieces of
# up to 1 MiB, each sealed with AES-256-GCM. A piece's nonce is the prefix, its
# number and a flag that is 1 only on the last piece, so pieces can't be dropped,
# reordered or cut off the end without the check failing.
def _key(passphrase, salt):
    return Scrypt(salt=salt, length=32, n=2 ** 15, r=8, p=1).derive(passphrase.encode("utf-8"))


def _nonce(prefix, number, last):
    return prefix + number.to_bytes(4, "big") + (b"\x01" if last else b"\x00")


def encrypt_file(src, dst, passphrase):
    salt, prefix = os.urandom(16), os.urandom(7)
    aead = AESGCM(_key(passphrase, salt))
    with open(src, "rb") as fin, open(dst, "wb") as fout:
        fout.write(MAGIC + salt + prefix)
        number, piece = 0, fin.read(CHUNK)
        while True:
            following = fin.read(CHUNK)
            fout.write(aead.encrypt(_nonce(prefix, number, not following), piece, MAGIC))
            if not following:
                break
            number, piece = number + 1, following


def decrypt_file(src, dst, passphrase):
    with open(src, "rb") as fin:
        head = fin.read(len(MAGIC) + 23)
        if len(head) != len(MAGIC) + 23 or not head.startswith(MAGIC):
            raise BackupError("That file isn't an encrypted backup from this site.")
        salt, prefix = head[len(MAGIC):len(MAGIC) + 16], head[len(MAGIC) + 16:]
        aead = AESGCM(_key(passphrase, salt))
        with open(dst, "wb") as fout:
            number, piece = 0, fin.read(CHUNK + 16)
            while True:
                following = fin.read(CHUNK + 16)
                try:
                    fout.write(aead.decrypt(_nonce(prefix, number, not following), piece, MAGIC))
                except InvalidTag:
                    raise BackupError("Wrong passphrase, or the backup file is damaged.") from None
                if not following:
                    break
                number, piece = number + 1, following


# ---- making a backup ---------------------------------------------------------------
def _sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for piece in iter(lambda: fh.read(CHUNK), b""):
            digest.update(piece)
    return digest.hexdigest()


def _snapshot(workdir):
    """A consistent copy of the database in ``workdir``. Returns (file name, database type)."""
    url = db.engine.url
    backend = url.get_backend_name()
    if backend == "sqlite":
        dest = os.path.join(workdir, "database.sqlite3")
        raw = db.engine.raw_connection()
        try:
            target = sqlite3.connect(dest)
            try:
                raw.driver_connection.backup(target)  # SQLite's online backup: safe while the site is in use
                verdict = target.execute("PRAGMA integrity_check").fetchone()[0]
            finally:
                target.close()
        finally:
            raw.close()
        if verdict != "ok":
            raise BackupError(f"The database copy failed its integrity check: {verdict[:120]}")
        return "database.sqlite3", "sqlite"
    if backend == "postgresql":
        tool = shutil.which("pg_dump")
        if not tool:
            raise BackupError("pg_dump isn't installed on this server. Back this database up with your host's own tool (cPanel → Backup).")
        dest = os.path.join(workdir, "database.dump")
        # The password travels in the environment, never on the command line where other accounts could read it.
        done = subprocess.run([tool, "--format=custom", "--no-owner", "--no-privileges", "--file", dest, "--host", url.host or "localhost",
                               "--port", str(url.port or 5432), "--username", url.username or "", url.database or ""],
                              env={**os.environ, "PGPASSWORD": url.password or ""}, capture_output=True, timeout=1800, check=False)
        if done.returncode != 0:
            raise BackupError("pg_dump failed: " + done.stderr.decode("utf-8", "replace").strip()[-200:])
        return "database.dump", "postgresql"
    raise BackupError(f"Backups aren't built in for {backend} databases. Use your host's own backup tool.")


def _migration():
    try:
        return db.session.execute(db.text("SELECT version_num FROM alembic_version")).scalar()
    except Exception:  # a database made without migrations (tests, a first local run)
        db.session.rollback()
        return None


def _anonymous(info):
    info.uid = info.gid = 0
    info.uname = info.gname = ""
    return info


def _write_archive(dest, manifest, files, level):
    """A tar.gz with manifest.json first, then ``files`` as (path on disk, name inside)."""
    with tempfile.TemporaryDirectory() as tmp:
        note = os.path.join(tmp, "manifest.json")
        with open(note, "w", encoding="utf-8") as fh:
            json.dump(manifest, fh, indent=1)
        with tarfile.open(dest, "w:gz", compresslevel=level) as tar:
            tar.add(note, arcname="manifest.json", recursive=False, filter=_anonymous)
            for path, inside in files:
                tar.add(path, arcname=inside, recursive=False, filter=_anonymous)


def _seal(plain, kind, now):
    """Move a finished archive into place under its final name, encrypted if a passphrase is set."""
    passphrase = _cfg("BACKUP_PASSPHRASE") or ""
    name = f"{kind}-{now.strftime(STAMP)}.tar.gz" + (".enc" if passphrase else "")
    final = os.path.join(folder(), name)
    if passphrase:
        encrypt_file(plain, final + ".part", passphrase)
        os.remove(plain)
    else:
        os.replace(plain, final + ".part")
    os.chmod(final + ".part", 0o600)
    os.replace(final + ".part", final)
    return name


def _backup_data(now):
    with tempfile.TemporaryDirectory(dir=folder()) as work:
        file, kind = _snapshot(work)
        path = os.path.join(work, file)
        manifest = {"format": 1, "kind": "data", "created": now.isoformat(timespec="seconds"), "migration": _migration(),
                    "database": {"type": kind, "file": file, "bytes": os.path.getsize(path), "sha256": _sha256(path)},
                    "rows": {"bookings": Booking.query.count(), "accounts": User.query.count(), "stays": Hotel.query.count()}}
        plain = os.path.join(work, "archive.tar.gz")
        _write_archive(plain, manifest, [(path, file)], level=6)
        return _seal(plain, "data", now)


def _photo_files():
    root = uploads.folder()
    names = sorted(n for n in os.listdir(root) if PHOTO.match("uploads/" + n) and os.path.isfile(os.path.join(root, n)) and not os.path.islink(os.path.join(root, n)))
    return root, names


def _fingerprint(root, names):
    digest = hashlib.sha256()
    for name in names:
        digest.update(f"{name}:{os.path.getsize(os.path.join(root, name))}\n".encode())
    return digest.hexdigest()


def _photos_due(now):
    """Photos never change once saved, so a new archive is made only when the set of
    files differs from the last one, and not more often than BACKUP_PHOTOS_EVERY_DAYS."""
    root, names = _photo_files()
    last = latest("photos")
    if not names:
        return False
    if not last:
        return True
    if state().get("photos_fingerprint") == _fingerprint(root, names):
        return False
    return now - last["at"] >= timedelta(days=int(_cfg("BACKUP_PHOTOS_EVERY_DAYS", 7)))


def _backup_photos(now):
    root, names = _photo_files()
    if not names:
        return None
    mark = _fingerprint(root, names)
    with tempfile.TemporaryDirectory(dir=folder()) as work:
        manifest = {"format": 1, "kind": "photos", "created": now.isoformat(timespec="seconds"), "files": len(names),
                    "bytes": sum(os.path.getsize(os.path.join(root, n)) for n in names), "fingerprint": mark}
        plain = os.path.join(work, "archive.tar.gz")
        _write_archive(plain, manifest, [(os.path.join(root, n), "uploads/" + n) for n in names], level=1)  # JPEGs barely compress
        name = _seal(plain, "photos", now)
    _save_state(photos_fingerprint=mark)
    return name


# ---- thinning out old ones -----------------------------------------------------------
def keep(stamps, daily, weekly, monthly):
    """Which of ``stamps`` (newest first) stay: the newest ``daily``, then the newest
    of each of the last ``weekly`` weeks and of each of the last ``monthly`` months."""
    kept = set(stamps[:max(1, daily)])
    weeks, months = {}, {}
    for stamp in stamps:
        weeks.setdefault(tuple(stamp.isocalendar())[:2], stamp)
        months.setdefault((stamp.year, stamp.month), stamp)
    kept.update(list(weeks.values())[:weekly])
    kept.update(list(months.values())[:monthly])
    return kept


def prune():
    """Delete backups past their keep time. Returns the names removed."""
    rows = listing()
    data = [r for r in rows if r["kind"] == "data"]
    staying = keep([r["at"] for r in data], int(_cfg("BACKUP_KEEP_DAILY", 7)), int(_cfg("BACKUP_KEEP_WEEKLY", 4)), int(_cfg("BACKUP_KEEP_MONTHLY", 6)))
    gone = [r["name"] for r in data if r["at"] not in staying]
    gone += [r["name"] for r in [r for r in rows if r["kind"] == "photos"][max(1, int(_cfg("BACKUP_KEEP_PHOTOS", 2))):]]
    for name in gone:
        os.remove(os.path.join(folder(), name))
    cutoff = utcnow().timestamp() - 86400
    for name in os.listdir(folder()):  # leftovers of a run that was cut short
        path = os.path.join(folder(), name)
        if (name.endswith(".part") or name.startswith("tmp")) and os.path.getmtime(path) < cutoff:
            shutil.rmtree(path, ignore_errors=True) if os.path.isdir(path) else os.remove(path)
    return gone


# ---- a copy somewhere else -----------------------------------------------------------
def offsite():
    """The folder address backups are copied to, or None when that isn't set up."""
    url = (_cfg("BACKUP_UPLOAD_URL") or "").strip()
    if not url:
        return None
    if not url.startswith("https://"):
        raise BackupError("BACKUP_UPLOAD_URL must start with https://")
    if not _cfg("BACKUP_PASSPHRASE"):
        raise BackupError("Set BACKUP_PASSPHRASE before copying backups to another server: they hold guests' personal details and must leave this server encrypted.")
    return url.rstrip("/") + "/"


def _remote(method, name, **kwargs):
    user = _cfg("BACKUP_UPLOAD_USER") or ""
    return requests.request(method, offsite() + name, auth=(user, _cfg("BACKUP_UPLOAD_PASSWORD") or "") if user else None,
                            timeout=(10, 900), allow_redirects=False, headers={"User-Agent": "SarandaCompanion-backup/1"}, **kwargs)


def send_offsite():
    """Copy every backup that isn't there yet, and delete the ones thinned out here.
    Returns the names sent. Raises BackupError if a copy fails."""
    if not offsite():
        return []
    here = [r["name"] for r in listing()]
    there = [n for n in state().get("uploaded", []) if NAME.match(str(n))]
    sent = []
    try:
        for name in reversed([n for n in here if n not in there]):  # oldest first
            with open(os.path.join(folder(), name), "rb") as fh:
                answer = _remote("PUT", name, data=fh)
            if answer.status_code not in (200, 201, 204):
                raise BackupError(f"The backup server answered {answer.status_code} when sending {name}.")
            sent.append(name)
            there.append(name)
        for name in [n for n in there if n not in here]:
            try:
                _remote("DELETE", name)
            except requests.RequestException:
                pass  # an old copy left behind does no harm
            there.remove(name)
    except requests.RequestException as exc:
        raise BackupError(f"Couldn't reach the backup server ({exc.__class__.__name__}).") from None
    finally:
        _save_state(uploaded=there)
    return sent


def run(photos=None, now=None):
    """Make a backup now. ``photos``: True or False to decide, None to include them when due.
    Returns {"made", "removed", "sent"}; raises BackupError (and remembers it) on failure."""
    now = (now or utcnow()).replace(microsecond=0)
    made = []
    try:
        made.append(_backup_data(now))
        if photos or (photos is None and _photos_due(now)):
            name = _backup_photos(now)
            if name:
                made.append(name)
        removed = prune()
        sent = send_offsite()
    except Exception as exc:
        db.session.rollback()
        message = str(exc) if isinstance(exc, BackupError) else f"{exc.__class__.__name__}: {exc}"
        _save_state(last_error={"at": now.isoformat(), "message": message[:300]})
        raise BackupError(message) from exc
    _save_state(last_ok=now.isoformat(), last_error=None)
    return {"made": made, "removed": removed, "sent": sent}


# ---- opening one again ------------------------------------------------------------------
@contextmanager
def opened(name=None):
    """Unpack a backup into a temporary folder: yields (folder, manifest). Only the files
    a backup of this site contains are taken out, whatever else an archive may hold."""
    row = next((r for r in listing() if r["name"] == name), None) if name else latest("data")
    if not row:
        raise BackupError("No such backup here. See: flask backup list")
    source = os.path.join(folder(), row["name"])
    with tempfile.TemporaryDirectory(dir=folder()) as work:
        if row["encrypted"]:
            if not _cfg("BACKUP_PASSPHRASE"):
                raise BackupError("This backup is encrypted. Put its BACKUP_PASSPHRASE in .env to open it.")
            plain = os.path.join(work, "archive.tar.gz")
            decrypt_file(source, plain, _cfg("BACKUP_PASSPHRASE"))
            source = plain
        out = os.path.join(work, "files")
        os.makedirs(os.path.join(out, "uploads"))
        try:
            with tarfile.open(source, "r:gz") as tar:
                for member in tar:
                    wanted = member.name in ("manifest.json", "database.sqlite3", "database.dump") or PHOTO.match(member.name)
                    if not (member.isfile() and wanted):
                        continue
                    with tar.extractfile(member) as fin, open(os.path.join(out, member.name), "wb") as fout:
                        shutil.copyfileobj(fin, fout)
            with open(os.path.join(out, "manifest.json"), encoding="utf-8") as fh:
                manifest = json.load(fh)
        except (tarfile.TarError, OSError, ValueError, EOFError) as exc:
            raise BackupError(f"The backup file is damaged ({exc.__class__.__name__}).") from None
        yield out, {**manifest, "name": row["name"]}


def _check(out, manifest):
    if manifest.get("kind") == "photos":
        found = len(os.listdir(os.path.join(out, "uploads")))
        if found != manifest.get("files"):
            raise BackupError(f"The backup should hold {manifest.get('files')} photos but has {found}.")
        return
    info = manifest.get("database") or {}
    path = os.path.join(out, info.get("file") or "")
    if not os.path.isfile(path) or _sha256(path) != info.get("sha256"):
        raise BackupError("The database inside the backup doesn't match its checksum.")
    if info.get("type") == "sqlite":
        conn = sqlite3.connect(path)
        try:
            verdict = conn.execute("PRAGMA integrity_check").fetchone()[0]
        finally:
            conn.close()
        if verdict != "ok":
            raise BackupError(f"The database inside the backup is damaged: {verdict[:120]}")


def verify(name=None):
    """Open a backup the way a restore would and check what is inside. Returns its manifest."""
    with opened(name) as (out, manifest):
        _check(out, manifest)
        return manifest


def extract(name, dest):
    """Unpack a backup into ``dest`` (a new or empty folder) to look at or restore by hand."""
    if os.path.exists(dest) and os.listdir(dest):
        raise BackupError("Choose a folder that doesn't exist yet or is empty.")
    with opened(name) as (out, manifest):
        _check(out, manifest)
        os.makedirs(dest, mode=0o700, exist_ok=True)
        for item in os.listdir(out):
            if item != "uploads" or os.listdir(os.path.join(out, item)):
                shutil.move(os.path.join(out, item), os.path.join(dest, item))
        return manifest


def restore(name):
    """Put a backup back. A data backup replaces the whole database (a fresh backup of
    the current one is made first, so this can be undone). A photos backup copies back
    every photo that is missing and touches nothing else."""
    with opened(name) as (out, manifest):
        _check(out, manifest)
        if manifest.get("kind") == "photos":
            root, copied = uploads.folder(), 0
            for item in os.listdir(os.path.join(out, "uploads")):
                if not os.path.exists(os.path.join(root, item)):
                    shutil.copyfile(os.path.join(out, "uploads", item), os.path.join(root, item))
                    copied += 1
            return {**manifest, "restored": copied}
        if (manifest.get("database") or {}).get("type") != "sqlite" or db.engine.url.get_backend_name() != "sqlite":
            raise BackupError("Only SQLite databases are restored from here. Unpack it with `flask backup extract` and load database.dump with pg_restore.")
        safety = _backup_data(utcnow().replace(microsecond=0))
        source = sqlite3.connect(os.path.join(out, manifest["database"]["file"]))
        db.session.remove()
        raw = db.engine.raw_connection()
        try:
            source.backup(raw.driver_connection)
        finally:
            source.close()
            raw.close()
        return {**manifest, "safety": safety}
