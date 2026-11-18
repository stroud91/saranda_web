"""The cPanel deploy: the start file Passenger loads, and what deploy/cpanel_deploy.sh puts where."""
import os
import shutil
import subprocess
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_HTACCESS = os.path.join(ROOT, "travago-tour-app", "public", ".htaccess")
PASSENGER_BLOCK = """# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION BEGIN
PassengerAppRoot "/home/someone/megrooms_flask"
PassengerBaseURI "/"
PassengerPython "/home/someone/virtualenv/megrooms_flask/3.11/bin/python"
# DO NOT REMOVE. CLOUDLINUX PASSENGER CONFIGURATION END
"""


def test_passenger_start_file_serves_the_app(tmp_path):
    """Passenger imports passenger_wsgi.py from the app folder (not the current directory)
    and calls `application`. -I keeps the current directory off sys.path, as Passenger may."""
    env = {**os.environ, "FLASK_ENV": "production", "SECRET_KEY": "x" * 40,
           "DATABASE_URL": f"sqlite:///{tmp_path / 'p.db'}"}
    code = ("import runpy, sys; ns = runpy.run_path(sys.argv[1]); app = ns['application']; "
            "c = app.test_client(); r = c.get('/api/meta/health', base_url='https://example.test'); "
            "print(app.import_name, r.status_code)")
    r = subprocess.run([sys.executable, "-I", "-c", code, os.path.join(ROOT, "passenger_wsgi.py")],
                       cwd=tmp_path, env=env, capture_output=True, text=True, timeout=120)
    assert r.returncode == 0, r.stderr[-2000:]
    assert r.stdout.split()[-2:] == ["app", "200"]


@pytest.mark.skipif(not shutil.which("bash"), reason="needs bash")
def test_deploy_script_uses_the_accounts_own_folders(tmp_path):
    home = tmp_path / "home"
    (home / "public_html").mkdir(parents=True)
    shutil.copy(STATIC_HTACCESS, home / "public_html" / ".htaccess")
    env = {**os.environ, "ACCOUNT_HOME": str(home), "SKIP_FRONTEND_BUILD": "1"}

    def deploy():
        r = subprocess.run(["bash", os.path.join(ROOT, "deploy", "cpanel_deploy.sh")], env=env,
                           capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, r.stdout[-2000:] + r.stderr[-2000:]
        return r.stdout

    out = deploy()
    app_root = home / "megrooms_flask"
    assert f"App root: {app_root}" in out
    for name in ("wsgi.py", "passenger_wsgi.py", "requirements.txt", "app/__init__.py", "migrations/env.py"):
        assert (app_root / name).is_file(), name
    # The folder the website build is uploaded into exists even when the server can't build it.
    assert (app_root / "travago-tour-app").is_dir()
    assert ".env is missing" in out
    assert "no virtualenv under" in out
    # The old static site's .htaccess would hide the app's /api/ addresses: the deploy says so.
    assert "still has the old static site's rules" in out

    # With only cPanel's Passenger block left, there is nothing to warn about.
    (home / "public_html" / ".htaccess").write_text(PASSENGER_BLOCK)
    assert "static site's rules" not in deploy()


def _cpanel_tasks():
    tasks, inside = [], False
    with open(os.path.join(ROOT, ".cpanel.yml")) as f:
        for line in f:
            if line.strip() == "tasks:":
                inside = True
            elif inside and line.strip().startswith("- "):
                tasks.append(line.strip()[2:])
    return tasks


@pytest.mark.skipif(not shutil.which("bash"), reason="needs bash")
def test_cpanel_deploy_button_runs_the_deploy(tmp_path):
    """"Deploy HEAD Commit" runs each task from the repository folder with only the account's
    own environment: no variable names the repository, so the tasks mustn't rely on one."""
    home = tmp_path / "home"
    home.mkdir()
    env = {k: v for k, v in os.environ.items() if k != "DEPLOYMENT_SOURCE"}
    env.update(ACCOUNT_HOME=str(home), SKIP_FRONTEND_BUILD="1")
    tasks = _cpanel_tasks()
    assert tasks
    for task in tasks:
        r = subprocess.run(["bash", "-c", task], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, task + "\n" + r.stdout[-2000:] + r.stderr[-2000:]
    assert (home / "megrooms_flask" / "passenger_wsgi.py").is_file()
    assert (home / "megrooms_flask" / "app" / "__init__.py").is_file()
