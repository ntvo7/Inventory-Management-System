#Bruce Store Inventory Back-End Group 4
#
#Starts the Flask API. The routes live in separate files:
#  auth.py       - login, logout, roles, user management
#  inventory.py  - products, receive / sell / adjust, movements, FIFO / LIFO valuation
#  suppliers.py  - suppliers and purchase orders
#  forecast.py   - sales forecast, reorder suggestions, sales report
#  schema.py     - creates / upgrades the database tables at startup

import os
import secrets

import flask
from flask import jsonify, make_response, request
from mysql.connector import Error

import auth
import forecast
import inventory
import suppliers
from db import close_db
from schema import ensure_schema

app = flask.Flask(__name__)
app.config["DEBUG"] = True
# Signs the login session cookie. Set SECRET_KEY to keep people logged in across restarts.
app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

for module in (auth, inventory, suppliers, forecast):
    app.register_blueprint(module.bp)
app.teardown_appcontext(close_db)

#return a JSON error instead of crashing when the database or request is bad
@app.errorhandler(Error)
def handle_db_error(e):
    print('Database error:', e)
    return jsonify({'error': 'database error', 'detail': str(e)}), 500

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


#create / upgrade tables once (the debug reloader runs this file twice; only the real server does it)
if os.environ.get('WERKZEUG_RUN_MAIN') == 'true' or not app.config["DEBUG"]:
    ensure_schema()

if __name__ == '__main__':
    app.run()
