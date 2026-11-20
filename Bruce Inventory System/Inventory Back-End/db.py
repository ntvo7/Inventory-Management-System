"""Database helpers shared by every route.

Each request gets its own MySQL connection (stored on flask.g and closed when the
request ends), so requests running at the same time never share a connection.
Values are passed separately from the SQL text so the driver escapes them.
"""
import os
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from urllib.parse import parse_qs, unquote, urlparse

import mysql.connector
from flask import g


def _config():
    """Where the database is.

    Live: one DATABASE_URL like mysql://user:password@host:port/dbname?ssl-mode=REQUIRED
    (the "Service URI" Aiven shows). On your computer: the local MySQL defaults below.
    """
    url = os.environ.get('DATABASE_URL')
    if url:
        u = urlparse(url)
        config = {
            'host': u.hostname,
            'port': u.port or 3306,
            'user': unquote(u.username or ''),
            'password': unquote(u.password or ''),
            'database': u.path.lstrip('/'),
        }
        # cloud databases (Aiven, TiDB Cloud, ...) require an encrypted connection:
        # use one for any database that isn't on this computer, unless ?ssl-mode=DISABLED
        ssl_mode = parse_qs(u.query).get('ssl-mode', [''])[0].upper()
        local = u.hostname in ('127.0.0.1', 'localhost')
        if ssl_mode != 'DISABLED' and (not local or ssl_mode):
            config['ssl_disabled'] = False
        # the pure-Python driver supports every login method cloud databases use
        # (TiDB Cloud uses mysql_native_password, which MySQL 9 client libraries dropped)
        config['use_pure'] = True
        return config
    return {
        'host': os.environ.get('DB_HOST', '127.0.0.1'),
        'port': int(os.environ.get('DB_PORT', 3306)),
        'user': os.environ.get('DB_USER', 'root'),
        'password': os.environ.get('DB_PASSWORD', '!r00tpwd'),
        'database': os.environ.get('DB_NAME', 'brucestore'),
    }


DB_CONFIG = _config()


def connect():
    return mysql.connector.connect(**DB_CONFIG)


def get_db():
    if 'db' not in g:
        g.db = connect()
    return g.db


def close_db(_error=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()


def _clean(value):
    """Turn MySQL types into JSON-friendly ones (numbers stay numbers, dates become ISO strings)."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def clean_row(row):
    return {k: _clean(v) for k, v in row.items()}


def query(sql, params=(), one=False, raw=False):
    """Run a SELECT. raw=True keeps Decimal/datetime values for calculations."""
    cur = get_db().cursor(dictionary=True)
    try:
        cur.execute(sql, params)
        rows = cur.fetchall()
    finally:
        cur.close()
    if not raw:
        rows = [clean_row(r) for r in rows]
    if one:
        return rows[0] if rows else None
    return rows


def execute(sql, params=(), commit=True):
    """Run an INSERT/UPDATE/DELETE. Returns the new row id for inserts."""
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(sql, params)
        last_id = cur.lastrowid
    finally:
        cur.close()
    if commit:
        db.commit()
    return last_id


@contextmanager
def transaction():
    """Group several execute(..., commit=False) calls: all succeed or none do."""
    db = get_db()
    try:
        yield
        db.commit()
    except Exception:
        db.rollback()
        raise
