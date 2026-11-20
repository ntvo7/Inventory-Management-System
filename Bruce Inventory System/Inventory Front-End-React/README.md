# Stop Mini Mart: Bruce Inventory System

Inventory system for Bruce's convenience store: products, receiving, sales, FIFO/LIFO valuation,
suppliers and purchase orders, forecasting, reports, and user accounts. React front end with a
Flask + MySQL backend. Light and dark mode.

## Run it

Double-click `run_app.command` (Mac) or `run_app.bat` (Windows) in the `Bruce Inventory System` folder.
It starts MySQL (Mac), Flask on port 5000 and this app on port 5173, then opens http://127.0.0.1:5173.

First login: `admin` / `brucestore` (the owner account). Change the password from the sidebar.

On first start the backend creates any missing tables by itself (`Inventory Back-End/schema.py`).

### Demo data (optional)

To fill the charts with 60 days of example sales, deliveries and five fictional suppliers:

```bash
cd "Bruce Inventory System/Inventory Back-End"
../venv/bin/python seed_demo_data.py            # add
../venv/bin/python seed_demo_data.py --remove   # take it out again
```

Everything it adds is labelled "Demo", and current on-hand quantities are left unchanged.

## Pages

| Page | Who | What it does |
|---|---|---|
| **Home** | everyone | Inventory value, low stock alerts, stock status donut, sales forecast line chart, stock levels bar chart |
| **Operation** | everyone | Product list and filters; **Receive**, **Sell**, **Adjust** (damaged, expired, count correction…) and **Edit**; FIFO / LIFO switch |
| **Suppliers** | everyone | Supplier cards; purchase orders (draft → ordered → received / cancelled); reorder suggestions that become an order in one click |
| **Reports** | everyone | Stock summary, Movements (every stock change, with a stock level chart per product), Sales, Forecast (sales + supplies), Supplier performance. Print or export CSV |
| **Users** | owner only | Add employees, set roles, reset passwords, deactivate accounts |

The sidebar ("Dashboard") shows who is logged in and their role.

### Roles

- **Owner (admin)**: everything, plus managing users and deleting products or suppliers.
- **Employee**: everything else.

## How the numbers work

- **Stock status**: out = 0 on hand; low = below the product's minimum stock; otherwise healthy.
- **FIFO / LIFO**: every delivery is a cost "lot". FIFO counts the oldest lots as sold first (stock left is valued at
  the newest costs); LIFO counts the newest first (stock left is valued at the oldest costs). See `Inventory Back-End/valuation.py`.
- **Sales forecast**: a straight trend line fitted to the last 28 complete days of sales.
- **Reorder suggestions**: reorder when on hand + on order falls to (average daily sales × supplier lead time) + minimum stock;
  order enough for the lead time plus 7 days.
- Products that existed before this upgrade got an "opening balance" lot valued at 70% of the selling price, since
  their real cost was never recorded.

## Code map

Backend (`Inventory Back-End/`):

- `Back-End.py`: starts Flask and registers the modules below
- `auth.py`: login, roles, user management
- `inventory.py`: products, receive / sell / adjust, movements, valuation
- `suppliers.py`: suppliers and purchase orders
- `forecast.py`: sales forecast, reorder suggestions, sales report
- `schema.py`: creates and upgrades tables; `db.py`: database helpers

Front end (`Inventory Front-End-React/src/`):

- `App.jsx`: page routes; `auth.jsx`: login state; `theme.jsx`: light / dark mode
- `api.js`: every call to Flask; `format.js`: money, dates, stock status
- `pages/`: one file per page; `components/`: sidebar, modals, shared UI
- `app.css`: the design system (colors for both themes are at the top)

The old EJS site in `Inventory Front-End/` still works against the same API (it signs in with Basic Auth), but is no longer launched.
