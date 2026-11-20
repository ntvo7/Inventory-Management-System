"""Import a batch of products from a CSV file through the app's own API.

Each row goes through POST /api/stock, the same request the "Add product" form sends,
so the backend validates it and records the opening stock as a cost lot + movement
(used for FIFO / LIFO). The backend must be running.

    python3 import_products.py                       # imports sample_products.csv
    python3 import_products.py my_products.csv       # any CSV with the same columns
    python3 import_products.py --remove              # delete the products listed in the CSV
                                                     # (and their stock history)

CSV columns: sku,name,category,unit,price,unit_cost,opening_qty,min_stock,supplier
"supplier" is the supplier's name; rows for an unknown supplier are imported without one.
Rows whose SKU or name already exists are skipped, so running it twice is safe.
"""
import csv
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))  # so we can import db.py for --remove

API = os.environ.get('API_URL', 'http://127.0.0.1:5000')
USER = os.environ.get('APP_USER', 'admin')
PASSWORD = os.environ.get('APP_PASSWORD', 'brucestore')

opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method,
                                 headers={'Content-Type': 'application/json'} if data else {})
    try:
        with opener.open(req, timeout=15) as res:
            return res.status, json.loads(res.read() or b'null')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except ValueError:
            return e.code, {'error': e.reason}


def read_csv(path):
    with open(path, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def import_rows(rows):
    status, me = call('POST', '/api/login', {'username': USER, 'password': PASSWORD})
    if status != 200:
        sys.exit(f'Login failed ({status}): {me.get("error")}. Is the backend running at {API}?')

    _, suppliers = call('GET', '/api/suppliers')
    supplier_ids = {s['name'].strip().lower(): s['supplier_id'] for s in suppliers if s['active']}
    _, products = call('GET', '/api/stock')
    existing_skus = {(p['sku'] or '').lower() for p in products if p['sku']}
    existing_names = {p['s_name'].strip().lower() for p in products}

    created, skipped, failed, no_supplier = [], [], [], []
    started = time.perf_counter()
    for line, row in enumerate(rows, start=2):  # line 1 is the header
        sku, name = row['sku'].strip(), row['name'].strip()
        if sku.lower() in existing_skus or name.lower() in existing_names:
            skipped.append(f'line {line}: {name} (already exists)')
            continue
        supplier_id = supplier_ids.get(row.get('supplier', '').strip().lower())
        if row.get('supplier') and not supplier_id:
            no_supplier.append(f'{name} -> "{row["supplier"]}"')
        body = {
            'sku': sku, 's_name': name, 's_category': row['category'], 'unit': row['unit'] or 'each',
            's_price': row['price'], 'unit_cost': row['unit_cost'], 'instock': row['opening_qty'] or 0,
            'min_stock': row['min_stock'] or 10, 'supplier_id': supplier_id,
        }
        status, result = call('POST', '/api/stock', body)
        if status == 201:
            created.append(result)
            existing_skus.add(sku.lower())
            existing_names.add(name.lower())
        else:
            failed.append(f'line {line}: {name}: {result.get("error")}')
    elapsed = time.perf_counter() - started

    units = sum(int(p['instock']) for p in created)
    value = sum(float(r['unit_cost']) * int(r['opening_qty'] or 0) for r in rows
                if r['sku'].strip().lower() in {(p['sku'] or '').lower() for p in created})
    print(f'Imported {len(created)} products in {elapsed:.2f}s ({elapsed / max(len(created), 1) * 1000:.0f} ms each)')
    print(f'  opening stock: {units} units, cost value ${value:,.2f}')
    print(f'  skipped: {len(skipped)}   failed: {len(failed)}   without supplier: {len(no_supplier)}')
    for msg in skipped + failed:
        print('   -', msg)
    for msg in no_supplier:
        print('   - no supplier named', msg)


def remove_rows(rows):
    from db import connect  # direct database access: also clears the batch's stock history
    skus = [r['sku'].strip() for r in rows if r['sku'].strip()]
    con = connect()
    cur = con.cursor()
    try:
        marks = ','.join(['%s'] * len(skus))
        cur.execute(f"SELECT s_id FROM stock WHERE sku IN ({marks})", skus)
        ids = [r[0] for r in cur.fetchall()]
        if not ids:
            print('None of these products are in the database.')
            return
        id_marks = ','.join(['%s'] * len(ids))
        cur.execute(f"SELECT DISTINCT po_id FROM po_item WHERE s_id IN ({id_marks})", ids)
        touched_orders = [r[0] for r in cur.fetchall()]
        for table in ('stock_movement', 'stock_lot', 'stock_change', 'price_change', 'po_item'):
            cur.execute(f"DELETE FROM {table} WHERE s_id IN ({id_marks})", ids)
        # orders that only contained these products are now empty: remove them too
        for po_id in touched_orders:
            cur.execute("DELETE FROM purchase_order WHERE po_id = %s "
                        "AND NOT EXISTS (SELECT 1 FROM po_item WHERE po_id = %s)", (po_id, po_id))
        cur.execute(f"DELETE FROM stock WHERE s_id IN ({id_marks})", ids)
        con.commit()
        print(f'Removed {len(ids)} products and their stock history.')
    finally:
        cur.close()
        con.close()


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    path = args[0] if args else os.path.join(HERE, 'sample_products.csv')
    rows = read_csv(path)
    if '--remove' in sys.argv:
        remove_rows(rows)
    else:
        import_rows(rows)
