"""Logins, roles and user management.

- The React site logs in with /api/login and gets a session cookie.
- The old Express site sends HTTP Basic Auth on every call.
- Roles: 'admin' (the owner) can manage users and delete things; 'employee' runs the store.
"""
from functools import wraps

from flask import Blueprint, g, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash as _generate

from db import execute, query

bp = Blueprint('auth', __name__)

PUBLIC_FIELDS = 'user_id, username, full_name, role, active, created_at, last_login'
MIN_PASSWORD_LENGTH = 6


def generate_password_hash(password):
    # pbkdf2 works on every Python build (the default, scrypt, is missing on some Macs)
    return _generate(password, method='pbkdf2:sha256')


def _check_login(username, password):
    """Return the user row if the username/password is right and the account is active."""
    if not username or not password:
        return None
    user = query("SELECT * FROM app_user WHERE username = %s", (username.strip(),), one=True)
    if user and user['active'] and check_password_hash(user['password_hash'], password):
        return user
    return None


def current_user():
    """The logged-in user for this request (session first, then Basic Auth), or None."""
    if 'user' in g:
        return g.user
    user = None
    if session.get('user_id'):
        user = query(
            f"SELECT {PUBLIC_FIELDS} FROM app_user WHERE user_id = %s AND active = 1",
            (session['user_id'],), one=True,
        )
        if user is None:
            session.clear()  # account was deactivated or deleted
    elif request.authorization:
        found = _check_login(request.authorization.username, request.authorization.password)
        if found:
            user = {k: found[k] for k in PUBLIC_FIELDS.split(', ')}
    g.user = user
    return user


def login_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        if current_user() is None:
            # no WWW-Authenticate header, so browsers don't pop up a login box
            return jsonify({'error': 'login required'}), 401
        return f(*args, **kwargs)
    return wrapper


def admin_required(f):
    @wraps(f)
    @login_required
    def wrapper(*args, **kwargs):
        if current_user()['role'] != 'admin':
            return jsonify({'error': 'Only the owner (admin) can do this'}), 403
        return f(*args, **kwargs)
    return wrapper


def current_user_id():
    user = current_user()
    return user['user_id'] if user else None


# ---------- login / logout ----------

@bp.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json(silent=True) or {}
    user = _check_login(data.get('username'), data.get('password'))
    if not user:
        return jsonify({'error': 'Incorrect username or password'}), 401
    session.clear()
    session['user_id'] = user['user_id']
    execute("UPDATE app_user SET last_login = NOW() WHERE user_id = %s", (user['user_id'],))
    return jsonify(query(f"SELECT {PUBLIC_FIELDS} FROM app_user WHERE user_id = %s", (user['user_id'],), one=True))


@bp.route('/api/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'ok': True})


@bp.route('/api/me', methods=['GET'])
def api_me():
    user = current_user() if session.get('user_id') else None
    if not user:
        return jsonify({'error': 'login required'}), 401
    return jsonify(user)


@bp.route('/api/me/password', methods=['POST'])
@login_required
def change_own_password():
    data = request.get_json(silent=True) or {}
    me = query("SELECT * FROM app_user WHERE user_id = %s", (current_user_id(),), one=True)
    if not check_password_hash(me['password_hash'], data.get('current_password') or ''):
        return jsonify({'error': 'Current password is incorrect'}), 400
    new = data.get('new_password') or ''
    if len(new) < MIN_PASSWORD_LENGTH:
        return jsonify({'error': f'New password must be at least {MIN_PASSWORD_LENGTH} characters'}), 400
    execute("UPDATE app_user SET password_hash = %s WHERE user_id = %s", (generate_password_hash(new), me['user_id']))
    return jsonify({'ok': True})


# ---------- user management (owner only) ----------

@bp.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    return jsonify(query(f"SELECT {PUBLIC_FIELDS} FROM app_user ORDER BY role, full_name"))


@bp.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lower()
    full_name = (data.get('full_name') or '').strip()
    password = data.get('password') or ''
    role = data.get('role') or 'employee'
    if not username or not full_name:
        return jsonify({'error': 'Username and full name are required'}), 400
    if role not in ('admin', 'employee'):
        return jsonify({'error': 'Role must be admin or employee'}), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({'error': f'Password must be at least {MIN_PASSWORD_LENGTH} characters'}), 400
    if query("SELECT 1 FROM app_user WHERE username = %s", (username,), one=True):
        return jsonify({'error': f'Username "{username}" is already taken'}), 400
    user_id = execute(
        "INSERT INTO app_user (username, full_name, password_hash, role) VALUES (%s, %s, %s, %s)",
        (username, full_name, generate_password_hash(password), role),
    )
    return jsonify(query(f"SELECT {PUBLIC_FIELDS} FROM app_user WHERE user_id = %s", (user_id,), one=True)), 201


def _active_admin_count(excluding=None):
    row = query(
        "SELECT COUNT(*) AS n FROM app_user WHERE role = 'admin' AND active = 1 AND user_id <> %s",
        (excluding or 0,), one=True,
    )
    return row['n']


@bp.route('/api/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    user = query("SELECT * FROM app_user WHERE user_id = %s", (user_id,), one=True)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    full_name = (data.get('full_name') or user['full_name']).strip()
    role = data.get('role', user['role'])
    active = 1 if data.get('active', user['active']) else 0
    if role not in ('admin', 'employee'):
        return jsonify({'error': 'Role must be admin or employee'}), 400

    # the store must always keep at least one active owner account
    losing_admin = user['role'] == 'admin' and user['active'] and (role != 'admin' or not active)
    if losing_admin and _active_admin_count(excluding=user_id) == 0:
        return jsonify({'error': 'There must be at least one active admin'}), 400
    if user_id == current_user_id() and not active:
        return jsonify({'error': 'You cannot deactivate your own account'}), 400

    execute(
        "UPDATE app_user SET full_name = %s, role = %s, active = %s WHERE user_id = %s",
        (full_name, role, active, user_id),
    )
    password = data.get('password')
    if password:
        if len(password) < MIN_PASSWORD_LENGTH:
            return jsonify({'error': f'Password must be at least {MIN_PASSWORD_LENGTH} characters'}), 400
        execute("UPDATE app_user SET password_hash = %s WHERE user_id = %s", (generate_password_hash(password), user_id))
    return jsonify(query(f"SELECT {PUBLIC_FIELDS} FROM app_user WHERE user_id = %s", (user_id,), one=True))
