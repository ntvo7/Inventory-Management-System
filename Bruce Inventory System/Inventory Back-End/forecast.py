"""Sales forecast, reorder (supplies) forecast and the sales report.

Sales forecast: take daily units sold over the last 28 complete days (up to yesterday;
today is only partly over), fit a straight trend line (least squares), and extend it
forward starting today. Never below zero.

Reorder forecast, per product:
  average daily sales  = units sold in the last 28 days / 28
  reorder point        = average daily sales x supplier lead time + minimum stock
  order when           on hand + already on order <= reorder point
  suggested quantity   = enough for lead time + 7 more days, plus minimum stock,
                         minus what is on hand and already on order
"""
import math
from datetime import date, timedelta

from flask import Blueprint, jsonify, request

from auth import login_required
from db import query
from schema import OPENING_COST_RATIO

bp = Blueprint('forecast', __name__)

HISTORY_DAYS = 28
COVER_DAYS = 7         # order enough to last this long after the delivery arrives
DEFAULT_LEAD_TIME = 3  # products with no supplier


def _daily_series(rows, start, days, key):
    by_day = {r['day'].isoformat() if hasattr(r['day'], 'isoformat') else str(r['day']): float(r[key] or 0)
              for r in rows}
    return [by_day.get((start + timedelta(days=i)).isoformat(), 0.0) for i in range(days)]


def _trend(values, ahead):
    """Least-squares straight line through values, extended `ahead` days."""
    n = len(values)
    if n == 0:
        return [0.0] * ahead
    mean_x = (n - 1) / 2
    mean_y = sum(values) / n
    denom = sum((x - mean_x) ** 2 for x in range(n)) or 1
    slope = sum((x - mean_x) * (y - mean_y) for x, y in enumerate(values)) / denom
    intercept = mean_y - slope * mean_x
    return [max(round(intercept + slope * (n + i), 2), 0.0) for i in range(ahead)]


@bp.route('/api/forecast', methods=['GET'])
@login_required
def forecast():
    horizon = min(max(int(request.args.get('days', 14)), 1), 60)
    today = date.today()
    start = today - timedelta(days=HISTORY_DAYS)  # 28 complete days: start .. yesterday

    daily = query(
        "SELECT DATE(created_at) AS day, SUM(-qty) AS units, SUM(-qty * unit_price) AS revenue "
        "FROM stock_movement WHERE m_type = 'sale' AND created_at >= %s AND created_at < %s "
        "GROUP BY DATE(created_at)",
        (start.isoformat(), today.isoformat()), raw=True,
    )
    units = _daily_series(daily, start, HISTORY_DAYS, 'units')
    revenue = _daily_series(daily, start, HISTORY_DAYS, 'revenue')
    units_ahead = _trend(units, horizon)
    revenue_ahead = _trend(revenue, horizon)

    history = [{'date': (start + timedelta(days=i)).isoformat(), 'units': units[i], 'revenue': round(revenue[i], 2)}
               for i in range(HISTORY_DAYS)]
    ahead = [{'date': (today + timedelta(days=i)).isoformat(), 'units': units_ahead[i],
              'revenue': revenue_ahead[i]} for i in range(horizon)]

    # ----- per product: how long stock lasts and what to reorder -----
    sold = {r['s_id']: float(r['units'] or 0) for r in query(
        "SELECT s_id, SUM(-qty) AS units FROM stock_movement "
        "WHERE m_type = 'sale' AND created_at >= %s AND created_at < %s GROUP BY s_id",
        (start.isoformat(), today.isoformat()), raw=True)}
    on_order = {r['s_id']: int(r['qty'] or 0) for r in query(
        "SELECT i.s_id, SUM(i.qty) AS qty FROM po_item i JOIN purchase_order o ON o.po_id = i.po_id "
        "WHERE o.status IN ('draft', 'ordered') GROUP BY i.s_id", raw=True)}
    products = query(
        "SELECT p.s_id, p.s_name, p.s_category, p.s_price, p.instock, p.min_stock, p.supplier_id, "
        "s.name AS supplier_name, s.lead_time_days FROM stock p "
        "LEFT JOIN supplier s ON s.supplier_id = p.supplier_id AND s.active = 1 ORDER BY p.s_name", raw=True,
    )
    # latest unit cost of every product in ONE query (one query per product is slow online)
    latest_cost = {}
    for lot in query("SELECT s_id, unit_cost FROM stock_lot ORDER BY received_at, lot_id", raw=True):
        latest_cost[lot['s_id']] = float(lot['unit_cost'])

    rows = []
    for p in products:
        avg = sold.get(p['s_id'], 0.0) / HISTORY_DAYS
        on_hand = int(p['instock'] or 0)
        lead = int(p['lead_time_days'] if p['lead_time_days'] is not None else DEFAULT_LEAD_TIME)
        minimum = int(p['min_stock'] or 0)
        incoming = on_order.get(p['s_id'], 0)
        reorder_point = math.ceil(avg * lead) + minimum
        target = math.ceil(avg * (lead + COVER_DAYS)) + minimum
        suggest_qty = max(target - on_hand - incoming, 0)
        needs_order = on_hand + incoming <= reorder_point and suggest_qty > 0
        cost = latest_cost.get(p['s_id'], round(float(p['s_price'] or 0) * OPENING_COST_RATIO, 2))
        rows.append({
            's_id': p['s_id'], 's_name': p['s_name'], 's_category': p['s_category'],
            'supplier_id': p['supplier_id'] if p['supplier_name'] else None,
            'supplier_name': p['supplier_name'], 'lead_time_days': lead,
            'on_hand': on_hand, 'min_stock': minimum, 'on_order': incoming,
            'avg_daily_sales': round(avg, 2),
            'days_left': round(on_hand / avg, 1) if avg > 0 else None,
            'forecast_units': round(avg * horizon, 1),
            'reorder_point': reorder_point,
            'needs_order': needs_order,
            'suggested_qty': suggest_qty if needs_order else 0,
            'unit_cost': cost,
            'suggested_cost': round((suggest_qty if needs_order else 0) * cost, 2),
        })

    return jsonify({
        'history': history,
        'forecast': ahead,
        'horizon_days': horizon,
        'history_days': HISTORY_DAYS,
        'products': rows,
        'totals': {
            'forecast_units': round(sum(units_ahead), 1),
            'forecast_revenue': round(sum(revenue_ahead), 2),
            'last_period_units': round(sum(units), 1),
            'last_period_revenue': round(sum(revenue), 2),
            'reorder_count': sum(1 for r in rows if r['needs_order']),
            'reorder_cost': round(sum(r['suggested_cost'] for r in rows), 2),
        },
        'method': (f'Trend line fitted to daily sales over the last {HISTORY_DAYS} complete days. '
                   f'Reorder when on hand + on order falls to (average daily sales x lead time) + minimum stock; '
                   f'order enough for the lead time plus {COVER_DAYS} days.'),
    })


@bp.route('/api/reports/sales', methods=['GET'])
@login_required
def sales_report():
    end = request.args.get('end') or date.today().isoformat()
    start = request.args.get('start') or (date.fromisoformat(end) - timedelta(days=29)).isoformat()
    params = (start, end)
    daily = query(
        "SELECT DATE(created_at) AS day, SUM(-qty) AS units, SUM(-qty * unit_price) AS revenue "
        "FROM stock_movement WHERE m_type = 'sale' AND created_at >= %s "
        "AND created_at < DATE_ADD(%s, INTERVAL 1 DAY) GROUP BY DATE(created_at) ORDER BY day", params,
    )
    products = query(
        "SELECT m.s_id, m.s_name, p.s_category, SUM(-m.qty) AS units, SUM(-m.qty * m.unit_price) AS revenue "
        "FROM stock_movement m LEFT JOIN stock p ON p.s_id = m.s_id WHERE m.m_type = 'sale' "
        "AND m.created_at >= %s AND m.created_at < DATE_ADD(%s, INTERVAL 1 DAY) "
        "GROUP BY m.s_id, m.s_name, p.s_category ORDER BY revenue DESC", params,
    )
    return jsonify({
        'start': start, 'end': end, 'daily': daily, 'products': products,
        'totals': {
            'units': sum(r['units'] or 0 for r in products),
            'revenue': round(sum(r['revenue'] or 0 for r in products), 2),
            'transactions_days': len(daily),
        },
    })
