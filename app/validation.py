"""Tiny declarative request validation.

Every mutating endpoint declares the fields it accepts. Unknown fields are
ignored, strings are stripped of control characters and length-capped, and
all errors are reported together so forms can highlight them.
"""
import re
from datetime import date, datetime

from flask import request

EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+'-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,24}$")
PHONE_RE = re.compile(r"^\+?[0-9 ()\-.]{6,25}$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class ValidationError(Exception):
    def __init__(self, errors):
        super().__init__("Invalid request")
        self.errors = errors


def clean_text(value, max_len):
    value = _CONTROL.sub("", str(value)).strip()
    return value[:max_len]


class Field:
    def __init__(self, kind="str", *, required=False, max_len=200, min=None, max=None, choices=None,
                 pattern=None, default=None, item=None, max_items=50, label=None):
        self.kind, self.required, self.max_len = kind, required, max_len
        self.min, self.max, self.choices, self.pattern = min, max, choices, pattern
        self.default, self.item, self.max_items, self.label = default, item, max_items, label

    def parse(self, name, raw):
        label = self.label or name.replace("_", " ").capitalize()
        k = self.kind
        if k in ("str", "text", "email", "phone", "slug", "hhmm"):
            if not isinstance(raw, (str, int, float)):
                raise ValueError(f"{label} must be text")
            val = clean_text(raw, self.max_len if k != "text" else self.max_len)
            if self.required and not val:
                raise ValueError(f"{label} is required")
            if k == "email" and val and not EMAIL_RE.match(val):
                raise ValueError("Enter a valid email address")
            if k == "phone" and val and not PHONE_RE.match(val):
                raise ValueError("Enter a valid phone number")
            if k == "slug" and val and not SLUG_RE.match(val):
                raise ValueError(f"{label} is not valid")
            if k == "hhmm" and val and not HHMM_RE.match(val):
                raise ValueError(f"{label} must be HH:MM")
            if self.choices and val not in self.choices:
                raise ValueError(f"{label} must be one of: {', '.join(self.choices)}")
            if self.pattern and val and not re.fullmatch(self.pattern, val):
                raise ValueError(f"{label} is not valid")
            return val
        if k in ("int", "float"):
            if isinstance(raw, bool):
                raise ValueError(f"{label} must be a number")
            try:
                val = int(raw) if k == "int" else float(raw)
            except (TypeError, ValueError):
                raise ValueError(f"{label} must be a number")
            if self.min is not None and val < self.min:
                raise ValueError(f"{label} must be at least {self.min}")
            if self.max is not None and val > self.max:
                raise ValueError(f"{label} must be at most {self.max}")
            return val
        if k == "bool":
            if isinstance(raw, bool):
                return raw
            if raw in ("true", "1", 1):
                return True
            if raw in ("false", "0", 0):
                return False
            raise ValueError(f"{label} must be true or false")
        if k == "date":
            try:
                return date.fromisoformat(str(raw)[:10])
            except ValueError:
                raise ValueError(f"{label} must be a date (YYYY-MM-DD)")
        if k == "list":
            if not isinstance(raw, list):
                raise ValueError(f"{label} must be a list")
            if len(raw) > self.max_items:
                raise ValueError(f"{label} has too many items (max {self.max_items})")
            if self.min is not None and len(raw) < self.min:
                raise ValueError(f"{label} needs at least {self.min} item(s)")
            return [self.item.parse(f"{name} item", x) for x in raw] if self.item else raw
        if k == "dict":
            if not isinstance(raw, dict):
                raise ValueError(f"{label} must be an object")
            return raw
        raise ValueError(f"Unsupported field type for {label}")


def validate(schema, data):
    if not isinstance(data, dict):
        raise ValidationError({"_": "Expected a JSON object"})
    out, errors = {}, {}
    for name, field in schema.items():
        raw = data.get(name)
        if raw is None or raw == "":
            if field.required:
                errors[name] = f"{field.label or name.replace('_', ' ').capitalize()} is required"
            else:
                out[name] = field.default
            continue
        try:
            out[name] = field.parse(name, raw)
        except ValueError as exc:
            errors[name] = str(exc)
    if errors:
        raise ValidationError(errors)
    return out


def json_body(schema):
    return validate(schema, request.get_json(silent=True))


def query_args(schema):
    return validate(schema, request.args.to_dict())


def parse_iso_date(value, label="date"):
    try:
        return datetime.fromisoformat(str(value)[:10])
    except ValueError:
        raise ValidationError({label: f"{label} must be YYYY-MM-DD"})
