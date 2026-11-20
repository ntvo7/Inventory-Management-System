"""FIFO and LIFO inventory valuation.

Every batch of stock received is a "lot" with a quantity and a unit cost. We know how
many units are on hand now, so the units that left the store (sold or written off) are
everything received minus what is on hand. FIFO and LIFO differ only in WHICH lots we
assume those units came from:

  FIFO (first in, first out): the OLDEST lots left first,
        so what is left on the shelf is valued at the NEWEST costs.
  LIFO (last in, first out):  the NEWEST lots left first,
        so what is left on the shelf is valued at the OLDEST costs.

This is the "periodic" method taught in accounting classes: it looks at all lots to date.
When costs are rising, FIFO gives a higher inventory value and lower cost of goods sold
(COGS); LIFO gives the opposite.
"""


def _take(lots, units):
    """Cost of `units` taken from `lots` in the given order. Returns (cost, units_not_covered)."""
    cost = 0.0
    remaining = units
    for qty, unit_cost in lots:
        if remaining <= 0:
            break
        used = min(qty, remaining)
        cost += used * unit_cost
        remaining -= used
    return cost, remaining


def value_product(on_hand, lots):
    """lots: list of (qty, unit_cost) ordered oldest -> newest."""
    on_hand = max(int(on_hand or 0), 0)
    received = sum(q for q, _ in lots)
    purchases = sum(q * c for q, c in lots)
    consumed = max(received - on_hand, 0)  # units sold or written off
    last_cost = lots[-1][1] if lots else 0.0

    # value on hand
    fifo_value, fifo_gap = _take(list(reversed(lots)), on_hand)  # newest lots remain
    lifo_value, lifo_gap = _take(lots, on_hand)                   # oldest lots remain
    # more on hand than was ever received (old data): value the extra at the latest cost
    fifo_value += fifo_gap * last_cost
    lifo_value += lifo_gap * last_cost

    # cost of the units that left
    cogs_fifo, _ = _take(lots, consumed)                   # oldest left first
    cogs_lifo, _ = _take(list(reversed(lots)), consumed)  # newest left first

    return {
        'on_hand': on_hand,
        'units_received': received,
        'units_out': consumed,
        'purchases_cost': round(purchases, 2),
        'last_cost': round(last_cost, 2),
        'avg_cost': round(purchases / received, 2) if received else 0.0,
        'fifo_value': round(fifo_value, 2),
        'lifo_value': round(lifo_value, 2),
        'cogs_fifo': round(cogs_fifo, 2),
        'cogs_lifo': round(cogs_lifo, 2),
        'missing_cost_units': fifo_gap,
    }
