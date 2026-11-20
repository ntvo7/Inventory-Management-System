#Bruce Store Inventory Back-End Group 4
#
#Starts the Flask API. The routes live in separate files:
#  auth.py       - login, logout, roles, user management
#  inventory.py  - products, receive / sell / adjust, movements, FIFO / LIFO valuation
#  suppliers.py  - suppliers and purchase orders
#  forecast.py   - sales forecast, reorder suggestions, sales report
#  schema.py     - creates / upgrades the database tables at startup
#
#Two ways to run it:
#  - On your computer: `python Back-End.py` (debug mode, React runs separately on port 5173)
#  - Live (PythonAnywhere): wsgi.py sets PRODUCTION=1. Debug is off, secrets come from
#    environment variables, and Flask also serves the built React site from ./web

import os
import secrets

import flask
from flask import jsonify, make_response, send_from_directory
from mysql.connector import Error

import auth
import forecast
import inventory
import suppliers
from db import close_db
from schema import ensure_schema

PRODUCTION = os.environ.get('PRODUCTION') == '1'
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'web')  # built React site

app = flask.Flask(__name__, static_folder=None)
app.config["DEBUG"] = not PRODUCTION
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

if PRODUCTION:
    # never run live with a made-up key or the public default password
    missing = [name for name in ('SECRET_KEY', 'ADMIN_PASSWORD', 'DB_PASSWORD') if not os.environ.get(name)]
    if missing:
        raise RuntimeError('Set these environment variables before going live: ' + ', '.join(missing))
    app.secret_key = os.environ['SECRET_KEY']
    app.config["SESSION_COOKIE_SECURE"] = True  # login cookie only travels over HTTPS
else:
    # Signs the login session cookie. Set SECRET_KEY to keep people logged in across restarts.
    app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)

for module in (auth, inventory, suppliers, forecast):
    app.register_blueprint(module.bp)
app.teardown_appcontext(close_db)

#return a JSON error instead of crashing when the database or request is bad
@app.errorhandler(Error)
def handle_db_error(e):
    print('Database error:', e)
    body = {'error': 'database error'}
    if not PRODUCTION:
        body['detail'] = str(e)  # don't show database internals on the live site
    return jsonify(body), 500

@app.errorhandler(KeyError)
@app.errorhandler(ValueError)
@app.errorhandler(TypeError)
def handle_bad_request(e):
    return jsonify({'error': str(e).strip("'")}), 400

#Basic Authentication check (kept from the original project)
@app.route('/auth', methods=['GET'])
def processrequest():
    if auth.current_user():
        return '<h1> Authenticated User'
    return make_response('could not find user', 401, {'WWW-Authenticate': 'Basic realm="login required"'})


#the React site: real files (JS, CSS) as-is, every page address gets index.html
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def react_site(path):
    if path.startswith('api/'):
        return jsonify({'error': 'not found'}), 404
    if not os.path.exists(os.path.join(WEB_DIR, 'index.html')):
        return ('The React site is not built. Run "npm run build" in Inventory Front-End-React, '
                'or use the dev server on port 5173.'), 404
    if path and os.path.isfile(os.path.join(WEB_DIR, path)):
        return send_from_directory(WEB_DIR, path)
    return send_from_directory(WEB_DIR, 'index.html')


#create / upgrade tables once (the debug reloader runs this file twice; only the real server does it)
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or PRODUCTION:
    ensure_schema(os.environ.get('ADMIN_PASSWORD') or 'brucestore')

if __name__ == '__main__':
    app.run()
