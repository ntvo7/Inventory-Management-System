#Bruce Store Inventory Back-End Group 4

import flask
from flask import jsonify
from flask import request, make_response, session
from functools import wraps
import hmac
import os
import secrets

import mysql.connector
from mysql.connector import Error
import hashlib

from datetime import datetime

app = flask.Flask(__name__)
app.config["DEBUG"] = True
# Signs the login session cookie. Set SECRET_KEY to keep people logged in across restarts.
app.secret_key = os.environ.get('SECRET_KEY') or secrets.token_hex(32)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

#connect to database (based on classwork)
def create_con(hostname,uname,passwd,dname):
    connection = None

    try:
        connection = mysql.connector.connect(
            host = hostname,
            user = uname,
            password = passwd,
            database = dname
        )
        print("Connection was successful")
    except Error as e:
        print("Connection failed with error: ", e)
    return connection

con = create_con('127.0.0.1','root','!r00tpwd',"brucestore")

#reconnect if MySQL dropped the connection (e.g. after the idle timeout)
def get_con():
    global con
    if con is None:
        con = create_con('127.0.0.1','root','!r00tpwd',"brucestore")
    else:
        con.ping(reconnect=True, attempts=3, delay=1)
    return con

#execute sql function (based on classwork)
#params are passed separately so values are escaped by the driver (no SQL injection, apostrophes work)
def execute_myquery(query, params=()):
    connection = get_con()
    mycursor = connection.cursor()
    try:
        mycursor.execute(query, params)
        connection.commit()
    finally:
        mycursor.close()

#execute select/readall funtion (based on classwork)
def execute_read_myquery(query, params=()):
    connection = get_con()
    mycursor = connection.cursor(dictionary=True)
    try:
        mycursor.execute(query, params)
        return mycursor.fetchall()
    finally:
        mycursor.close()

#return a JSON error instead of crashing when the database or request is bad
@app.errorhandler(Error)
def handle_db_error(e):
    print('Database error:', e)
    return jsonify({'error': 'database error', 'detail': str(e)}), 500

@app.errorhandler(KeyError)
@app.errorhandler(ValueError)
@app.errorhandler(TypeError)
def handle_bad_request(e):
    return jsonify({'error': 'bad request', 'detail': str(e)}), 400

masterUsername = 'admin'
masterPassword = '5393a423c38ab58e5bddd35c160deabcdd11f7242fa37250dfa49c9e7313cda4' #hash SHA256 value of 'brucestore' as the password

#check a username/password against the master login
def valid_login(username, password):
    if not username or not password:
        return False
    hashvalue = hashlib.sha256(password.encode()).hexdigest() #hash the password, compare to stored hash
    return username == masterUsername and hmac.compare_digest(hashvalue, masterPassword)

#Basic Authentication which uses username and password of request
@app.route('/auth', methods=['GET'])
def processrequest():
    if request.authorization and valid_login(request.authorization.username, request.authorization.password):
        return '<h1> Authenticated User'
    return make_response('could not find user', 401, {'WWW-Authenticate': 'Basic realm="login required"'})

#API routes need a logged-in session (React site) or Basic Auth (Express site)
def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if session.get('user') == masterUsername:
            return f(*args, **kwargs)
        auth = request.authorization
        if auth and valid_login(auth.username, auth.password):
            return f(*args, **kwargs)
        # no WWW-Authenticate header, so browsers don't pop up a login box
        return jsonify({'error': 'login required'}), 401
    return wrapper

#API login: checks the password and starts a session cookie
@app.route('/api/login', methods=['POST'])
def api_login():
    request_data = request.get_json(silent=True) or {}
    if valid_login(request_data.get('username'), request_data.get('password')):
        session.clear()
        session['user'] = masterUsername
        return jsonify({'user': masterUsername})
    return jsonify({'error': 'Incorrect username or password'}), 401

#API logout: ends the session
@app.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'ok': True})

#API: who is logged in (used by React when the page loads)
@app.route('/api/me', methods=['GET'])
def api_me():
    if session.get('user') == masterUsername:
        return jsonify({'user': masterUsername})
    return jsonify({'error': 'login required'}), 401

#API POST fuction to add products into database
@app.route('/api/stock', methods=['POST'])
@login_required
def add_product():
    request_data = request.get_json()
    newsname = request_data['s_name']
    newsprice = float(request_data['s_price'])
    newsoh = int(request_data['instock'])
    newscat = request_data['s_category']

    sql = "insert into stock (s_name, s_price, instock, s_category) values (%s, %s, %s, %s)"
    execute_myquery(sql, (newsname, newsprice, newsoh, newscat))

    return "Add request successful"

#API DELETE function to delete product by id
@app.route('/api/stock', methods=['DELETE'])
@login_required
def delete_product_byid():
    request_data = request.get_json()
    protodelete = int(request_data['s_id'])

    sql = "delete from stock where s_id = %s"
    execute_myquery(sql, (protodelete,))

    return "Delete request successful"

#API GET to retrieve all products
@app.route('/api/stock', methods=['GET'])
@login_required
def all_stock():
    #creating dictionary list of all current products
    sql = "select * from stock"
    all = execute_read_myquery(sql)
    products = []
    for eachrow in all:
        if eachrow not in products:
            products.append(eachrow)

    return jsonify(products)

#PUT funtion that updates product on hand
@app.route('/api/stock', methods=['PUT'])
@login_required
def api_put_product_byname():
    request_data = request.get_json()
    sid = int(request_data['s_id'])
    sname = request_data['s_name']
    newonhand = int(request_data['instock'])
    newsprice = float(request_data['s_price'])
    newcategory = request_data['s_category']

    sql_check_stock = "SELECT instock, s_price FROM stock WHERE s_id = %s"
    current_stock = execute_read_myquery(sql_check_stock, (sid,))
    if not current_stock:
        return jsonify({'error': 'product %s not found' % sid}), 404

    today = datetime.today().strftime('%Y-%m-%d')
    if current_stock[0]['instock'] != newonhand:
        sql2 = "insert into stock_change (s_name, s_id, newstock, up_date) values (%s, %s, %s, %s)"
        execute_myquery(sql2, (sname, sid, newonhand, today))
    if current_stock[0]['s_price'] != newsprice:
        sql3 = "insert into price_change (s_name, s_id, newprice, up_date) values (%s, %s, %s, %s)"
        execute_myquery(sql3, (sname, sid, newsprice, today))

    # Update the SQL query to modify all relevant fields
    sql = "UPDATE stock SET s_name = %s, s_price = %s, instock = %s, s_category = %s WHERE s_id = %s"
    execute_myquery(sql, (sname, newsprice, newonhand, newcategory, sid))


    return "Put active request successful!"

#API GET to retrieve all stock change history
@app.route('/api/stock_change', methods=['GET'])
@login_required
def all_stock_change():
    #creating dictionary list of all stock change history
    sql = "select * from stock_change order by up_date, up_id"
    all = execute_read_myquery(sql)
    stockchanges = []
    for eachrow in all:
        if eachrow not in stockchanges:
            stockchanges.append(eachrow)

    return jsonify(stockchanges)

#API GET to retrieve all price change history
@app.route('/api/price_change', methods=['GET'])
@login_required
def all_price_change():
    #creating dictionary list of all price change history
    sql = "select * from price_change order by up_date, p_id"
    all = execute_read_myquery(sql)
    pricechange = []
    for eachrow in all:
        if eachrow not in pricechange:
            pricechange.append(eachrow)

    return jsonify(pricechange)


if __name__ == '__main__':
    app.run()
