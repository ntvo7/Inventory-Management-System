"""Products, stock actions (receive / sell / adjust), movements and FIFO/LIFO valuation.

/api/stock keeps the same request and response shape the old Express site uses,
with extra fields added.
"""
import math
from datetime import date

from flask import Blueprint, jsonify, request

from auth import admin_required, current_user_id, login_required
from db import execute, query, transaction
from schema import OPENING_COST_RATIO
from valuation import value_product

bp = Blueprint('inventory', __name__)

PRODUCT_SELECT = """
    SELECT s.s_id, s.s_name, s.s_price, s.instock, s.s_category, s.sku, s.unit, s.min_stock,
           s.supplier_id, sup.name AS supplier_name
    FROM stock s LEFT JOIN supplier sup ON sup.supplier_id = s.supplier_id
"""


def _error(message, status=400):
    return jsonify({'error': message}), status


def _int(value, name, minimum=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        raise ValueError(f'{name} must be a whole number')
    if minimum is not None and number < minimum:
        raise ValueError(f'{name} must be at least {minimum}')
    return number


def _money(value, name):
    try:
        number = round(float(value), 2)
    except (TypeError, ValueError):
        raise ValueError(f'{name} must be a number')
    if number < 0 or math.isnan(number):
        raise ValueError(f'{name} cannot be negative')
    return number


def _optional_supplier(value):
    if value in (None, '', 0, '0'):
        return None
    supplier_id = _int(value, 'Supplier')
    if not query("SELECT 1 FROM supplier WHERE supplier_id = %s", (supplier_id,), one=True):
        raise ValueError('Supplier not found')
    return supplier_id


def get_product(s_id, lock=False):
    sql = "SELECT * FROM stock WHERE s_id = %s" + (" FOR UPDATE" if lock else "")
    return query(sql, (s_id,), one=True)


def last_cost(s_id, fallback_price=0):
    row = query(
        "SELECT unit_cost FROM stock_lot WHERE s_id = %s ORDER BY received_at DESC, lot_id DESC LIMIT 1",
        (s_id,), one=True,
    )
    if row:
        return float(row['unit_cost'])
    return round(float(fallback_price or 0) * OPENING_COST_RATIO, 2)


def record_stock_change(product, new_qty, m_type, qty, *, unit_price=None, unit_cost=None,
                        reason=None, po_id=None, supplier_id=None, lot_note=None):
    """Write one stock change. Call inside transaction(); adds a cost lot for stock coming in."""
    s_id, name = product['s_id'], product['s_name']
    execute("UPDATE stock SET instock = %s WHERE s_id = %s", (new_qty, s_id), commit=False)
    execute(
        "INSERT INTO stock_movement (s_id, s_name, m_type, qty, unit_price, unit_cost, reason, user_id, po_id) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
        (s_id, name, m_type, qty, unit_price, unit_cost, reason, current_user_id(), po_id), commit=False,
    )
    if qty > 0 and m_type != 'sale':
        execute(
            "INSERT INTO stock_lot (s_id, supplier_id, po_id, qty_received, unit_cost, note) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (s_id, supplier_id, po_id, qty, unit_cost or 0, lot_note or reason), commit=False,
        )
    # the original history table, still used by the old Express History page
    execute(
        "INSERT INTO stock_change (s_name, s_id, newstock, up_date) VALUES (%s, %s, %s, %s)",
        (name, s_id, new_qty, date.today().isoformat()), commit=False,
    )


# ---------- products ----------

@bp.route('/api/stock', methods=['GET'])
@login_required
def all_stock():
    return jsonify(query(PRODUCT_SELECT + " ORDER BY s.s_name"))


@bp.route('/api/stock', methods=['POST'])
@login_required
def add_product():
    data = request.get_json(silent=True) or {}
    name = (data.get('s_name') or '').strip()
    if not name:
        return _error('Product name is required')
    price = _money(data.get('s_price'), 'Price')
    qty = _int(data.get('instock', 0), 'On hand', minimum=0)
    category = data.get('s_category') or 'Other'
    min_stock = _int(data.get('min_stock', 10), 'Minimum stock', minimum=0)
    supplier_id = _optional_supplier(data.get('supplier_id'))
    unit_cost = data.get('unit_cost')
    unit_cost = _money(unit_cost, 'Unit cost') if unit_cost not in (None, '') else round(price * OPENING_COST_RATIO, 2)

    with transaction():
        s_id = execute(
            "INSERT INTO stock (s_name, s_price, instock, s_category, sku, unit, min_stock, supplier_id) "
            "VALUES (%s, %s, 0, %s, %s, %s, %s, %s)",
            (name, price, category, (data.get('sku') or '').strip() or None, data.get('unit') or 'each',
             min_stock, supplier_id), commit=False,
        )
        if qty > 0:
            product = {'s_id': s_id, 's_name': name}
            record_stock_change(product, qty, 'opening', qty, unit_cost=unit_cost,
                                reason='Opening stock', supplier_id=supplier_id)
    return jsonify(query(PRODUCT_SELECT + " WHERE s.s_id = %s", (s_id,), one=True)), 201


@bp.route('/api/stock', methods=['PUT'])
@login_required
def update_product():
    data = request.get_json(silent=True) or {}
    s_id = _int(data.get('s_id'), 'Product id')
    with transaction():
        product = get_product(s_id, lock=True)
        if not product:
            return _error(f'product {s_id} not found', 404)

        name = (data.get('s_name') or product['s_name']).strip()
        price = _money(data.get('s_price', product['s_price']), 'Price')
        category = data.get('s_category') or product['s_category']
        sku = product['sku']
        if 'sku' in data:
            sku = (data['sku'] or '').strip() or None
        unit = data.get('unit') or product['unit']
        min_stock = _int(data.get('min_stock', product['min_stock']), 'Minimum stock', minimum=0)
        supplier_id = _optional_supplier(data['supplier_id']) if 'supplier_id' in data else product['supplier_id']

        if float(product['s_price'] or 0) != price:
            execute(
                "INSERT INTO price_change (s_name, s_id, newprice, up_date) VALUES (%s, %s, %s, %s)",
                (name, s_id, price, date.today().isoformat()), commit=False,
            )
        execute(
            "UPDATE stock SET s_name = %s, s_price = %s, s_category = %s, sku = %s, unit = %s, "
            "min_stock = %s, supplier_id = %s WHERE s_id = %s",
            (name, price, category, sku, unit, min_stock, supplier_id, s_id), commit=False,
        )

        # quantity typed in directly (old Express site): record it as an adjustment
        if 'instock' in data:
            new_qty = _int(data['instock'], 'On hand', minimum=0)
            delta = new_qty - int(product['instock'] or 0)
            if delta:
                product['s_name'] = name
                record_stock_change(product, new_qty, 'adjust', delta, unit_cost=last_cost(s_id, price),
                                    reason='Quantity edited')
    return jsonify(query(PRODUCT_SELECT + " WHERE s.s_id = %s", (s_id,), one=True))


@bp.route('/api/stock', methods=['DELETE'])
@admin_required
def delete_product():
    data = request.get_json(silent=True) or {}
    s_id = _int(data.get('s_id'), 'Product id')
    with transaction():
        execute("DELETE FROM stock_lot WHERE s_id = %s", (s_id,), commit=False)
        execute("DELETE FROM stock WHERE s_id = %s", (s_id,), commit=False)
    # movements keep the product name, so past sales still show in reports
    return jsonify({'ok': True})


# ---------- stock actions ----------

@bp.route('/api/stock/<int:s_id>/receive', methods=['POST'])
@login_required
def receive_stock(s_id):
    data = request.get_json(silent=True) or {}
    qty = _int(data.get('qty'), 'Quantity', minimum=1)
    unit_cost = _money(data.get('unit_cost'), 'Unit cost')
    supplier_id = _optional_supplier(data.get('supplier_id'))
    with transaction():
        product = get_product(s_id, lock=True)
        if not product:
            return _error('Product not found', 404)
        note = (data.get('note') or '').strip() or 'Received'
        record_stock_change(product, int(product['instock'] or 0) + qty, 'receive', qty,
                            unit_cost=unit_cost, reason=note, supplier_id=supplier_id or product['supplier_id'])
    return jsonify(query(PRODUCT_SELECT + " WHERE s.s_id = %s", (s_id,), one=True))


@bp.route('/api/stock/<int:s_id>/sell', methods=['POST'])
@login_required
def sell_stock(s_id):
    data = request.get_json(silent=True) or {}
    qty = _int(data.get('qty'), 'Quantity', minimum=1)
    with transaction():
        product = get_product(s_id, lock=True)
        if not product:
            return _error('Product not found', 404)
        on_hand = int(product['instock'] or 0)
        if qty > on_hand:
            return _error(f'Only {on_hand} {product["s_name"]} in stock')
        price = data.get('unit_price')
        price = _money(price, 'Sale price') if price not in (None, '') else float(product['s_price'] or 0)
        record_stock_change(product, on_hand - qty, 'sale', -qty, unit_price=price, reason='Sale')
    return jsonify(query(PRODUCT_SELECT + " WHERE s.s_id = %s", (s_id,), one=True))


@bp.route('/api/stock/<int:s_id>/adjust', methods=['POST'])
@login_required
def adjust_stock(s_id):
    data = request.get_json(silent=True) or {}
    delta = _int(data.get('qty'), 'Quantity')
    reason = (data.get('reason') or '').strip()
    if delta == 0:
        return _error('Adjustment cannot be 0')
    if not reason:
        return _error('Please give a reason (for example: damaged, expired, count correction)')
    with transaction():
        product = get_product(s_id, lock=True)
        if not product:
            return _error('Product not found', 404)
        new_qty = int(product['instock'] or 0) + delta
        if new_qty < 0:
            return _error(f'That would leave {new_qty} in stock')
        record_stock_change(product, new_qty, 'adjust', delta,
                            unit_cost=last_cost(s_id, product['s_price']), reason=reason)
    return jsonify(query(PRODUCT_SELECT + " WHERE s.s_id = %s", (s_id,), one=True))


# ---------- reports data ----------

def valuation_rows():
    products = query(PRODUCT_SELECT + " ORDER BY s.s_name", raw=True)
    lots = query("SELECT s_id, qty_received, unit_cost FROM stock_lot ORDER BY received_at, lot_id", raw=True)
    sales = query(
        "SELECT s_id, SUM(-qty) AS units, SUM(-qty * unit_price) AS revenue "
        "FROM stock_movement WHERE m_type = 'sale' GROUP BY s_id", raw=True,
    )
    lots_by_product = {}
    for lot in lots:
        lots_by_product.setdefault(lot['s_id'], []).append((int(lot['qty_received']), float(lot['unit_cost'])))
    sales_by_product = {s['s_id']: s for s in sales}

    rows = []
    for p in products:
        v = value_product(p['instock'], lots_by_product.get(p['s_id'], []))
        sale = sales_by_product.get(p['s_id'], {})
        revenue = round(float(sale.get('revenue') or 0), 2)
        v.update({
            's_id': p['s_id'], 's_name': p['s_name'], 's_category': p['s_category'], 'sku': p['sku'],
            's_price': float(p['s_price'] or 0), 'min_stock': p['min_stock'],
            'supplier_id': p['supplier_id'], 'supplier_name': p['supplier_name'],
            'units_sold': int(sale.get('units') or 0), 'revenue': revenue,
            'gross_profit_fifo': round(revenue - v['cogs_fifo'], 2),
            'gross_profit_lifo': round(revenue - v['cogs_lifo'], 2),
        })
        rows.append(v)
    return rows


@bp.route('/api/valuation', methods=['GET'])
@login_required
def valuation():
    rows = valuation_rows()
    keys = ['on_hand', 'fifo_value', 'lifo_value', 'cogs_fifo', 'cogs_lifo', 'purchases_cost',
            'revenue', 'units_sold', 'gross_profit_fifo', 'gross_profit_lifo']
    totals = {k: round(sum(r[k] for r in rows), 2) for k in keys}
    return jsonify({'products': rows, 'totals': totals})


@bp.route('/api/movements', methods=['GET'])
@login_required
def movements():
    where, params = [], []
    if request.args.get('start'):
        where.append("m.created_at >= %s")
        params.append(request.args['start'])
    if request.args.get('end'):
        where.append("m.created_at < DATE_ADD(%s, INTERVAL 1 DAY)")
        params.append(request.args['end'])
    if request.args.get('type'):
        where.append("m.m_type = %s")
        params.append(request.args['type'])
    if request.args.get('s_id'):
        where.append("m.s_id = %s")
        params.append(_int(request.args['s_id'], 'Product'))
    limit = min(_int(request.args.get('limit', 2000), 'limit', minimum=1), 10000)
    sql = (
        "SELECT m.*, u.full_name AS user_name FROM stock_movement m "
        "LEFT JOIN app_user u ON u.user_id = m.user_id "
        + ("WHERE " + " AND ".join(where) if where else "")
        + " ORDER BY m.created_at DESC, m.m_id DESC LIMIT %s"
    )
    return jsonify(query(sql, tuple(params) + (limit,)))


# ---------- original history endpoints (old Express site) ----------

@bp.route('/api/stock_change', methods=['GET'])
@login_required
def all_stock_change():
    return jsonify(query("SELECT * FROM stock_change ORDER BY up_date, up_id"))


@bp.route('/api/price_change', methods=['GET'])
@login_required
def all_price_change():
    return jsonify(query("SELECT * FROM price_change ORDER BY up_date, p_id"))
