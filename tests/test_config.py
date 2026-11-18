"""Settings read from .env: blank values fall back to the defaults, and a wrong value names
the setting instead of crashing with a bare ValueError."""
import os
import runpy

import pytest

from app import config

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_blank_numbers_mean_the_default(monkeypatch):
    monkeypatch.setenv("SMTP_PORT", "")
    monkeypatch.setenv("PAYPAL_EUR_USD_RATE", "   ")
    assert config._int("SMTP_PORT", 465) == 465
    assert config._float("PAYPAL_EUR_USD_RATE", 0) == 0
    monkeypatch.setenv("SMTP_PORT", "587")
    assert config._int("SMTP_PORT", 465) == 587
    monkeypatch.delenv("SMTP_PORT")
    assert config._int("SMTP_PORT", 465) == 465


def test_a_wrong_number_names_the_setting(monkeypatch):
    monkeypatch.setenv("CANCEL_FULL_REFUND_DAYS", "two weeks")
    with pytest.raises(ValueError, match="CANCEL_FULL_REFUND_DAYS in .env must be a whole number"):
        config._int("CANCEL_FULL_REFUND_DAYS", 14)


def test_the_example_env_file_loads_as_it_is(monkeypatch):
    """`cp .env.example .env` is the first step of the README: every value in it must load."""
    with open(os.path.join(ROOT, ".env.example"), encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                name, value = line.split("=", 1)
                monkeypatch.setenv(name.strip(), value.strip())
    settings = runpy.run_path(os.path.join(ROOT, "app", "config.py"))["Config"]
    assert settings.PAYPAL_EUR_USD_RATE is None and settings.SMTP_PORT == 465
    assert settings.CANCEL_FULL_REFUND_DAYS == 14 and settings.BACKUP_KEEP_DAILY == 7
