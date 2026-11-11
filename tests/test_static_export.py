"""The static-hosting bundle must match the current API and engines.

If this fails, regenerate it:  python scripts/export_static.py
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import export_static  # noqa: E402


def test_static_bundle_is_up_to_date():
    static_api, fixtures = export_static.build()
    for path, obj in ((export_static.STATIC_API, static_api), (export_static.FIXTURES, fixtures)):
        assert os.path.exists(path), f"{os.path.relpath(path, ROOT)} is missing — run scripts/export_static.py"
        with open(path, encoding="utf-8") as f:
            committed = f.read()
        assert committed == export_static.dumps(obj), (
            f"{os.path.relpath(path, ROOT)} is stale — run: python scripts/export_static.py")


def test_static_config_has_no_server_features():
    static_api, _ = export_static.build()
    cfg = static_api["responses"]["/meta/config"]
    assert cfg["mode"] == "static"
    assert cfg["payments"]["enabled"] is False and cfg["payments"]["publishable_key"] is None
    assert [m["id"] for m in cfg["payments"]["methods"]] == ["request"]
    assert cfg["auth"] == {"enabled": False, "email": False}
    assert cfg["concierge"]["ai"] is False
