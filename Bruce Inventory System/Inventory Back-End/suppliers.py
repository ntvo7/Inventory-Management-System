"""Suppliers and purchase orders.

How it works (the usual flow in store inventory systems):
  1. Add suppliers with contact details and lead time (days from order to delivery).
  2. Create a purchase order (PO) for a supplier: products, quantities, unit costs. Starts as "draft".
  3. Mark it "ordered" when sent to the supplier. The expected date = today + lead time.
  4. When the delivery arrives, "receive" the PO: stock goes up and each line becomes a
     cost lot (so FIFO / LIFO stay accurate). Or "cancel" it.
"""
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from auth import admin_required, current_user_id, login_required
from db import execute, query, transaction
from inventory import _int, _money, get_product, record_stock_change

bp = Blueprint('suppliers', __name__)

SUPPLIER_FIELDS = ['name', 'contact_name', 'phone', 'email', 'address', 'lead_time_days', 'notes', 'active']


def _error(message, status=400):
    return jsonify({'error': message}), status


def _supplier_payload(data, existing=None):
    existing = existing or {}
    values = {}
    for field in SUPPLIER_FIELDS:
        value = data.get(field, existing.get(field))
        if isinstance(value, str):
            value = value.strip() or None
        values[field] = value
    if not values['name']:
        raise ValueError('Supplier name is required')
    values['lead_time_days'] = _int(values['lead_time_days'] if values['lead_time_days'] is not None else 3,
                                    'Lead time', minimum=0)
    values['active'] = 1 if values['active'] in (None, True, 1, '1') else 0
    return values


@bp.route('/api/suppliers', methods=['GET'])
@login_required
def list_suppliers():
    return jsonify(query("""
        SELECT s.*,
          (SELECT COUNT(*) FROM stock p WHERE p.supplier_id = s.supplier_id) AS product_count,
          (SELECT COUNT(*) FROM purchase_order o WHERE o.supplier_id = s.supplier_id
              AND o.status IN ('draft', 'ordered')) AS open_orders,
          (SELECT COALESCE(SUM(l.qty_received * l.unit_cost), 0) FROM stock_lot l
              WHERE l.supplier_id = s.supplier_id) AS total_spend,
          (SELECT MAX(o.ordered_at) FROM purchase_order o WHERE o.supplier_id = s.supplier_id) AS last_order
        FROM supplier s ORDER BY s.active DESC, s.name
    """))


@bp.route('/api/suppliers', methods=['POST'])
@login_required
def create_supplier():
    v = _supplier_payload(request.get_json(silent=True) or {})
    supplier_id = execute(
        "INSERT INTO supplier (name, contact_name, phone, email, address, lead_time_days, notes, active) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
        tuple(v[f] for f in SUPPLIER_FIELDS),
    )
    return jsonify(query("SELECT * FROM supplier WHERE supplier_id = %s", (supplier_id,), one=True)), 201


@bp.route('/api/suppliers/<int:supplier_id>', methods=['PUT'])
@login_required
def update_supplier(supplier_id):
    existing = query("SELECT * FROM supplier WHERE supplier_id = %s", (supplier_id,), one=True)
    if not existing:
        return _error('Supplier not found', 404)
    v = _supplier_payload(request.get_json(silent=True) or {}, existing)
    execute(
        "UPDATE supplier SET name=%s, contact_name=%s, phone=%s, email=%s, address=%s, "
        "lead_time_days=%s, notes=%s, active=%s WHERE supplier_id=%s",
        tuple(v[f] for f in SUPPLIER_FIELDS) + (supplier_id,),
    )
    return jsonify(query("SELECT * FROM supplier WHERE supplier_id = %s", (supplier_id,), one=True))


@bp.route('/api/suppliers/<int:supplier_id>', methods=['DELETE'])
@admin_required
def delete_supplier(supplier_id):
    used = query(
        "SELECT (SELECT COUNT(*) FROM purchase_order WHERE supplier_id = %s) + "
        "(SELECT COUNT(*) FROM stock_lot WHERE supplier_id = %s) AS n",
        (supplier_id, supplier_id), one=True,
    )['n']
    with transaction():
        execute("UPDATE stock SET supplier_id = NULL WHERE supplier_id = %s", (supplier_id,), commit=False)
        if used:
            # keep the history: hide the supplier instead of deleting it
            execute("UPDATE supplier SET active = 0 WHERE supplier_id = %s", (supplier_id,), commit=False)
        else:
            execute("DELETE FROM supplier WHERE supplier_id = %s", (supplier_id,), commit=False)
    return jsonify({'ok': True, 'deactivated': bool(used)})


# ---------- purchase orders ----------

PO_SELECT = """
    SELECT o.*, s.name AS supplier_name, s.lead_time_days, u.full_name AS created_by_name,
      (SELECT COUNT(*) FROM po_item i WHERE i.po_id = o.po_id) AS item_count,
      (SELECT COALESCE(SUM(i.qty), 0) FROM po_item i WHERE i.po_id = o.po_id) AS total_units,
      (SELECT COALESCE(SUM(i.qty * i.unit_cost), 0) FROM po_item i WHERE i.po_id = o.po_id) AS total_cost
    FROM purchase_order o
    JOIN supplier s ON s.supplier_id = o.supplier_id
    LEFT JOIN app_user u ON u.user_id = o.created_by
"""


def _po_with_items(po_id):
    po = query(PO_SELECT + " WHERE o.po_id = %s", (po_id,), one=True)
    if po:
        po['items'] = query(
            "SELECT i.*, COALESCE(p.s_name, CONCAT('Deleted product #', i.s_id)) AS s_name, p.instock "
            "FROM po_item i LEFT JOIN stock p ON p.s_id = i.s_id WHERE i.po_id = %s ORDER BY i.po_item_id",
            (po_id,),
        )
    return po


@bp.route('/api/purchase_orders', methods=['GET'])
@login_required
def list_purchase_orders():
    status = request.args.get('status')
    if status:
        return jsonify(query(PO_SELECT + " WHERE o.status = %s ORDER BY o.created_at DESC", (status,)))
    return jsonify(query(PO_SELECT + " ORDER BY o.created_at DESC"))


@bp.route('/api/purchase_orders/<int:po_id>', methods=['GET'])
@login_required
def get_purchase_order(po_id):
    po = _po_with_items(po_id)
    return jsonify(po) if po else _error('Purchase order not found', 404)


@bp.route('/api/purchase_orders', methods=['POST'])
@login_required
def create_purchase_order():
    data = request.get_json(silent=True) or {}
    supplier_id = _int(data.get('supplier_id'), 'Supplier')
    supplier = query("SELECT * FROM supplier WHERE supplier_id = %s AND active = 1", (supplier_id,), one=True)
    if not supplier:
        return _error('Supplier not found')
    items = data.get('items') or []
    lines = []
    for item in items:
        s_id = _int(item.get('s_id'), 'Product')
        if not get_product(s_id):
            return _error(f'Product {s_id} not found')
        lines.append((s_id, _int(item.get('qty'), 'Quantity', minimum=1), _money(item.get('unit_cost'), 'Unit cost')))
    if not lines:
        return _error('Add at least one product to the order')

    submit = bool(data.get('submit'))  # true = mark as ordered right away
    expected = data.get('expected_date') or (date.today() + timedelta(days=supplier['lead_time_days'])).isoformat()
    with transaction():
        po_id = execute(
            "INSERT INTO purchase_order (supplier_id, status, created_by, ordered_at, expected_date, notes) "
            "VALUES (%s, %s, %s, IF(%s, NOW(), NULL), %s, %s)",
            (supplier_id, 'ordered' if submit else 'draft', current_user_id(), submit, expected,
             (data.get('notes') or '').strip() or None), commit=False,
        )
        for s_id, qty, cost in lines:
            execute("INSERT INTO po_item (po_id, s_id, qty, unit_cost) VALUES (%s, %s, %s, %s)",
                    (po_id, s_id, qty, cost), commit=False)
    return jsonify(_po_with_items(po_id)), 201


@bp.route('/api/purchase_orders/<int:po_id>/status', methods=['POST'])
@login_required
def set_po_status(po_id):
    new_status = (request.get_json(silent=True) or {}).get('status')
    po = query("SELECT * FROM purchase_order WHERE po_id = %s", (po_id,), one=True)
    if not po:
        return _error('Purchase order not found', 404)
    allowed = {'draft': ['ordered', 'cancelled'], 'ordered': ['cancelled']}
    if new_status not in allowed.get(po['status'], []):
        return _error(f'A {po["status"]} order cannot be changed to {new_status}')
    if new_status == 'ordered':
        execute("UPDATE purchase_order SET status = 'ordered', ordered_at = NOW() WHERE po_id = %s", (po_id,))
    else:
        execute("UPDATE purchase_order SET status = %s WHERE po_id = %s", (new_status, po_id))
    return jsonify(_po_with_items(po_id))


@bp.route('/api/purchase_orders/<int:po_id>/receive', methods=['POST'])
@login_required
def receive_purchase_order(po_id):
    with transaction():
        po = query("SELECT * FROM purchase_order WHERE po_id = %s FOR UPDATE", (po_id,), one=True)
        if not po:
            return _error('Purchase order not found', 404)
        if po['status'] not in ('draft', 'ordered'):
            return _error(f'This order is already {po["status"]}')
        items = query("SELECT * FROM po_item WHERE po_id = %s", (po_id,))
        for item in items:
            product = get_product(item['s_id'], lock=True)
            if not product:
                continue  # product was deleted after ordering
            record_stock_change(
                product, int(product['instock'] or 0) + item['qty'], 'receive', item['qty'],
                unit_cost=item['unit_cost'], reason=f'PO #{po_id}', po_id=po_id, supplier_id=po['supplier_id'],
            )
            if product['supplier_id'] is None:
                execute("UPDATE stock SET supplier_id = %s WHERE s_id = %s",
                        (po['supplier_id'], product['s_id']), commit=False)
        execute(
            "UPDATE purchase_order SET status = 'received', received_at = NOW(), "
            "ordered_at = COALESCE(ordered_at, NOW()) WHERE po_id = %s",
            (po_id,), commit=False,
        )
    return jsonify(_po_with_items(po_id))
