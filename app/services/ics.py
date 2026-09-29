"""iCalendar export for saved trips (RFC 5545)."""
from datetime import date, datetime, timedelta, timezone


def _esc(text):
    return (str(text or "").replace("\\", "\\\\").replace(";", "\;").replace(",", "\\,")
            .replace("\r", "").replace("\n", "\\n"))[:900]


def _fold(line):
    out, raw = [], line.encode("utf-8")
    while len(raw) > 73:
        cut = 73
        while cut > 0 and (raw[cut] & 0xC0) == 0x80:
            cut -= 1
        out.append(raw[:cut].decode("utf-8"))
        raw = raw[cut:]
    out.append(raw.decode("utf-8"))
    return "\r\n ".join(out)


def trip_calendar(title, start, days, share_id, names):
    """``days``: list of {title, stops, plan}. ``names``: slug → display name."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Saranda Companion//Trip Planner//EN",
             "CALSCALE:GREGORIAN", f"X-WR-CALNAME:{_esc(title)}"]
    for i, day in enumerate(days):
        d = start + timedelta(days=i)
        stops = " → ".join(names.get(s, s) for s in day.get("stops", []))
        lines += [
            "BEGIN:VEVENT",
            f"UID:{share_id}-day{i + 1}@saranda-companion",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{d.strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{(d + timedelta(days=1)).strftime('%Y%m%d')}",
            _fold(f"SUMMARY:{_esc('Day ' + str(i + 1) + ': ' + (day.get('title') or stops))}"),
            _fold(f"DESCRIPTION:{_esc((day.get('notes') or '') + (chr(10) if day.get('notes') else '') + stops)}"),
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def parse_start(value):
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None
