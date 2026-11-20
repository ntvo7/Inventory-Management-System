# React prototype: Dashboard page

A React version of the **Dashboard** page, built to compare against the current EJS site before deciding on a framework.
It reads and writes the same MySQL data through the same Flask backend. Nothing in the backend was changed.

## Run it

1. Start the current app as usual (`run_app.command` on Mac, `run_app.bat` on Windows). This prototype needs the Flask backend on port 5000.
2. In this folder:

   ```bash
   npm install   # first time only
   npm run dev
   ```

3. Open http://localhost:5173

## What's in it

- Product table, name and category filters that update as you type (no page reload)
- Add / Update / Delete through one shared modal
- Home, Reports, History and Log off in the sidebar still link to the old site on port 9000

Not included yet: login (the prototype skips it), and the other pages.

## Where the code is

- `src/App.jsx, components/*.jsx`: the page, split into Sidebar, FilterBar, ProductTable and ProductModal components
- `src/api.js`: calls to Flask (`/api/stock`), shared filter logic
- `vite.config.js`: forwards `/api` to Flask on port 5000, so Flask needs no CORS changes
