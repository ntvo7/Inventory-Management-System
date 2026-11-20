# Bruce Inventory System: React front end

The React version of the site. It replaces the old EJS site in `Inventory Front-End/` and talks to the same
Flask backend (`Inventory Back-End/Back-End.py`) and MySQL database.

## Run it

Easiest: double-click `run_app.command` (Mac) or `run_app.bat` (Windows) in the `Bruce Inventory System` folder.
It starts MySQL (Mac), Flask on port 5000 and this app on port 5173, then opens http://127.0.0.1:5173.

By hand:

```bash
cd "Inventory Back-End" && python3 Back-End.py     # terminal 1
cd "Inventory Front-End-React" && npm install && npm run dev   # terminal 2
```

Log in with `admin` / `brucestore`.

## Pages

| Page | URL | What it does |
|---|---|---|
| Login | `/login` | Logs in through Flask (`/api/login`), which sets a session cookie |
| Home | `/` | Bar chart of products with fewer than 10 on hand |
| Dashboard | `/dashboard` | Product table, live filters, add / update / delete |
| Reports | `/reports` | Low stock (1 to 9) and out of stock (0) tables, filters, print |
| History | `/history` | Stock changes by product and date range; pick a product to see its trend chart |

## Where the code is

- `src/App.jsx`: page routes; pages other than Login require a logged-in user
- `src/auth.jsx`: login state (asks Flask `/api/me` on load)
- `src/api.js`: every call to Flask, plus shared filter and date helpers
- `src/pages/`: one file per page
- `src/components/`: Sidebar, FilterBar, ProductTable, ProductModal
- `vite.config.js`: forwards `/api` to Flask on port 5000, so the login cookie works without CORS

## Login and the API

Every `/api/stock*` and `/api/*_change` route in Flask needs either the session cookie (this app) or HTTP Basic Auth
(the old Express site sends it from `config.js`). Without either, Flask answers 401 and this app sends you to the login page.
