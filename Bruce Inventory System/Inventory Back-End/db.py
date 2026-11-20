"""Database helpers shared by every route.

Each request gets its own MySQL connection (stored on flask.g and closed when the
request ends), so requests running at the same time never share a connection.
Values are passed separately from the SQL text so the driver escapes them.
"""
import os
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal

import mysql.connector
from flask import g

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', '127.0.0.1'),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', '!r00tpwd'),
    'database': os.environ.get('DB_NAME', 'brucestore'),
}


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
