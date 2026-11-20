"""Optional demo data: 60 days of sales, deliveries and suppliers, so the charts,
forecast and FIFO/LIFO reports have something to show.

    python3 seed_demo_data.py           add demo data
    python3 seed_demo_data.py --remove  take it all out again

Everything added is labelled "Demo" (movement reasons, lot notes, PO notes, supplier notes).
Current on-hand quantities are left exactly as they were: a final "count reconciliation"
adjustment brings each product back to its real quantity. Supplier costs rise about 6%
over the 60 days, so FIFO and LIFO give different values.
"""
import math
import random
import sys
from datetime import datetime, timedelta

from db import connect
from schema import OPENING_COST_RATIO, ensure_schema

DAYS = 60
TAG = 'Demo data'

# Fictional suppliers (example.com / 555 numbers are reserved for examples)
SUPPLIERS = [
    ('Metro Beverage Distributors', 'Beverage', 'Dana Lee', '(713) 555-0141', 'orders@metrobev.example.com', 2),
    ('Sunrise Snack Wholesale', 'Snack', 'Luis Ortega', '(713) 555-0172', 'sales@sunrisesnack.example.com', 3),
    ('Gulf Coast Tobacco Supply', 'Cigarette', 'Pat Nguyen', '(713) 555-0118', 'reorders@gulfcoast.example.com', 4),
    ('Bayou Spirits & Beer', 'Alcohol', 'Morgan Price', '(713) 555-0190', 'desk@bayouspirits.example.com', 3),
    ('City General Merchandise', 'Other', 'Sam Patel', '(713) 555-0156', 'hello@citygeneral.example.com', 5),
]
# average units sold per day by category
DAILY_DEMAND = {'beverage': 3.0, 'snack': 2.2, 'cigarette': 1.6, 'alcohol': 1.2, 'other': 0.6}


def poisson(rng, mean):
    """Small Poisson sample (number of sales in a day)."""
    limit, k, p = math.exp(-mean), 0, 1.0
    while True:
        p *= rng.random()
        if p <= limit:
            return k
        k += 1


def remove(cur):
    cur.execute("SELECT supplier_id FROM supplier WHERE notes = %s", (TAG,))
    supplier_ids = [r[0] for r in cur.fetchall()]
    cur.execute("DELETE i FROM po_item i JOIN purchase_order o ON o.po_id = i.po_id WHERE o.notes = %s", (TAG,))
    cur.execute("DELETE FROM purchase_order WHERE notes = %s", (TAG,))
    cur.execute("DELETE FROM stock_movement WHERE reason LIKE 'Demo%%'")
    cur.execute("DELETE FROM stock_lot WHERE note LIKE 'Demo%%'")
    if supplier_ids:
        marks = ','.join(['%s'] * len(supplier_ids))
        cur.execute(f"UPDATE stock SET supplier_id = NULL WHERE supplier_id IN ({marks})", supplier_ids)
        cur.execute(f"DELETE FROM supplier WHERE supplier_id IN ({marks})", supplier_ids)
    print('Demo data removed.')


def seed(cur):
    cur.execute("SELECT COUNT(*) FROM supplier WHERE notes = %s", (TAG,))
    if cur.fetchone()[0]:
        print('Demo data is already loaded. Run with --remove first to reload it.')
        return

    rng = random.Random(4375)
    now = datetime.now().replace(microsecond=0)
    start = (now - timedelta(days=DAYS)).replace(hour=7, minute=0, second=0)
    cur.execute("SELECT user_id FROM app_user WHERE role = 'admin' ORDER BY user_id LIMIT 1")
    admin_id = cur.fetchone()[0]

    # suppliers, one per category
    by_category = {}
    for name, category, contact, phone, email, lead in SUPPLIERS:
        cur.execute(
            "INSERT INTO supplier (name, contact_name, phone, email, address, lead_time_days, notes) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s)",
            (name, contact, phone, email, 'Houston, TX', lead, TAG),
        )
        by_category[category.lower()] = (cur.lastrowid, lead)
    cur.execute("SELECT s_id, s_name, s_price, instock, s_category, min_stock, supplier_id FROM stock")
    products = cur.fetchall()

    for s_id, name, price, real_qty, category, min_stock, supplier_id in products:
        price = float(price or 0)
        real_qty = int(real_qty or 0)
        min_stock = int(min_stock or 10)
        sup_id, lead = by_category.get((category or 'other').lower(), by_category['other'])
        if supplier_id is None:
            cur.execute("UPDATE stock SET supplier_id = %s WHERE s_id = %s", (sup_id, s_id))
            supplier_id = sup_id

        # the story starts 60 days ago with the real opening-balance batch already on the shelf
        cur.execute("SELECT unit_cost FROM stock_lot WHERE s_id = %s ORDER BY received_at, lot_id LIMIT 1", (s_id,))
        row = cur.fetchone()
        base_cost = float(row[0]) if row else round(price * OPENING_COST_RATIO, 2)
        cur.execute("UPDATE stock_lot SET received_at = %s WHERE s_id = %s AND note LIKE 'Opening balance%%'",
                    (start - timedelta(days=1), s_id))
        cur.execute("UPDATE stock_movement SET created_at = %s WHERE s_id = %s AND m_type = 'opening'",
                    (start - timedelta(days=1), s_id))
        level = real_qty

        demand = DAILY_DEMAND.get((category or 'other').lower(), 0.6) * rng.uniform(0.7, 1.3)
        pending = None  # (arrival_day, qty, cost, po_id)
        for day in range(DAYS):
            today = start + timedelta(days=day)
            # deliveries arrive in the morning
            if pending and pending[0] == day:
                _, qty, cost, po_id = pending
                when = today.replace(hour=8, minute=rng.randint(0, 50))
                cur.execute(
                    "INSERT INTO stock_lot (s_id, supplier_id, po_id, qty_received, unit_cost, received_at, note) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s)", (s_id, supplier_id, po_id, qty, cost, when, f'{TAG}: PO #{po_id}'))
                cur.execute(
                    "INSERT INTO stock_movement (s_id, s_name, m_type, qty, unit_cost, reason, user_id, po_id, created_at) "
                    "VALUES (%s, %s, 'receive', %s, %s, %s, %s, %s, %s)",
                    (s_id, name, qty, cost, f'{TAG}: PO #{po_id}', admin_id, po_id, when))
                cur.execute("UPDATE purchase_order SET status = 'received', received_at = %s WHERE po_id = %s", (when, po_id))
                level += qty
                pending = None

            # sales: busier on Fri-Sun, slowly growing over the 60 days
            weekend = 1.35 if today.weekday() >= 4 else 1.0
            growth = 1 + 0.25 * day / DAYS
            sold = min(poisson(rng, demand * weekend * growth), level)
            for _ in range(sold):
                when = today.replace(hour=rng.randint(7, 21), minute=rng.randint(0, 59), second=rng.randint(0, 59))
                cur.execute(
                    "INSERT INTO stock_movement (s_id, s_name, m_type, qty, unit_price, reason, user_id, created_at) "
                    "VALUES (%s, %s, 'sale', -1, %s, %s, %s, %s)", (s_id, name, price, f'{TAG}: sale', admin_id, when))
            level -= sold

            # reorder when stock gets low (costs creep up ~0.4% a week, plus noise)
            if pending is None and level <= min_stock + demand * lead:
                qty = max(int(demand * 18), min_stock)
                cost = round(base_cost * (1 + 0.06 * day / DAYS) * rng.uniform(0.98, 1.04), 2)
                ordered = today.replace(hour=18, minute=rng.randint(0, 59))
                cur.execute(
                    "INSERT INTO purchase_order (supplier_id, status, created_at, created_by, ordered_at, expected_date, notes) "
                    "VALUES (%s, 'ordered', %s, %s, %s, %s, %s)",
                    (supplier_id, ordered, admin_id, ordered, (today + timedelta(days=lead)).date(), TAG))
                po_id = cur.lastrowid
                cur.execute("INSERT INTO po_item (po_id, s_id, qty, unit_cost) VALUES (%s, %s, %s, %s)", (po_id, s_id, qty, cost))
                if day + lead < DAYS:
                    pending = (day + lead, qty, cost, po_id)
                # otherwise the order is still on its way (stays "ordered")

        # bring the count back to the real quantity so nothing on the shelf changes
        diff = real_qty - level
        if diff:
            cur.execute("SELECT unit_cost FROM stock_lot WHERE s_id = %s ORDER BY received_at DESC, lot_id DESC LIMIT 1", (s_id,))
            cost = float(cur.fetchone()[0])
            when = now - timedelta(minutes=5)
            reason = f'{TAG}: count reconciliation'
            cur.execute(
                "INSERT INTO stock_movement (s_id, s_name, m_type, qty, unit_cost, reason, user_id, created_at) "
                "VALUES (%s, %s, 'adjust', %s, %s, %s, %s, %s)", (s_id, name, diff, cost, reason, admin_id, when))
            if diff > 0:
                cur.execute(
                    "INSERT INTO stock_lot (s_id, supplier_id, qty_received, unit_cost, received_at, note) "
                    "VALUES (%s, %s, %s, %s, %s, %s)", (s_id, supplier_id, diff, cost, when, reason))
    print(f'Demo data added: {len(SUPPLIERS)} suppliers, {DAYS} days of sales and deliveries for {len(products)} products.')


if __name__ == '__main__':
    ensure_schema()
    con = connect()
    cur = con.cursor()
    try:
        if '--remove' in sys.argv:
            remove(cur)
        else:
            seed(cur)
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        cur.close()
        con.close()
