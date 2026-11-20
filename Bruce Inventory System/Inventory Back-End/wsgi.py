"""Entry point for a real web server (PythonAnywhere, gunicorn, ...).

The web server imports `application` from this file. It turns on production mode,
then loads Back-End.py (its name has a dash, so it can't be imported the normal way).
Secrets (SECRET_KEY, ADMIN_PASSWORD, DB_*) must already be set as environment variables:
see DEPLOY.md.
"""
import importlib.util
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
os.environ.setdefault('PRODUCTION', '1')

_spec = importlib.util.spec_from_file_location('backend_app', os.path.join(HERE, 'Back-End.py'))
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)

application = _module.app
