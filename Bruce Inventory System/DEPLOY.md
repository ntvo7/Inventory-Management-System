# Putting Stop Mini Mart online (PythonAnywhere)

The live site runs entirely on PythonAnywhere's free plan: Flask serves both the API and the
built React site, and PythonAnywhere provides the MySQL database. When you're done, the site is at
**`https://YOURNAME.pythonanywhere.com`**.

Throughout this guide, replace **`YOURNAME`** with your PythonAnywhere username.

---

## 1. Create the account

1. Sign up at <https://www.pythonanywhere.com> → **Pricing & signup** → **Create a Beginner account** (free).
2. Your username becomes the web address, so pick one you're happy with (for example `stopminimart`).

## 2. Create the database

1. Open the **Databases** tab.
2. Under **MySQL password**, set a database password and write it down. This is the `DB_PASSWORD` below.
3. Under **Create a database**, type `brucestore` and click **Create**.
   Its full name is **`YOURNAME$brucestore`**, and the host shown at the top is
   **`YOURNAME.mysql.pythonanywhere-services.com`**.

## 3. Get the code

Open **Consoles** → **Bash** and run:

```bash
git clone https://github.com/ntvo7/Inventory-Management-System.git
python3.10 -m venv ~/.venvs/ims
source ~/.venvs/ims/bin/activate
pip install -r "Inventory-Management-System/Bruce Inventory System/requirements.txt"
```

Then make two secrets and keep the console open:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"   # this is SECRET_KEY
```

Also choose the **owner (admin) password** for the live site (`ADMIN_PASSWORD`). Use a new one,
not `brucestore`: that one is public in this repository.

## 4. (Optional) Copy your products and history

On your own computer, the file `Bruce Inventory System/deploy/brucestore-data.sql` holds the
products, suppliers, orders and stock history (but **no user accounts**). Recreate it any time with:

```bash
mysqldump -uroot -p --no-tablespaces --single-transaction --skip-triggers --set-gtid-purged=OFF \
  --ignore-table=brucestore.app_user brucestore > "Bruce Inventory System/deploy/brucestore-data.sql"
```

1. **Files** tab → **Upload a file** → choose `brucestore-data.sql` (it lands in `/home/YOURNAME/`).
2. In the Bash console:

   ```bash
   mysql -u YOURNAME -h YOURNAME.mysql.pythonanywhere-services.com -p 'YOURNAME$brucestore' < ~/brucestore-data.sql
   ```

   It asks for the database password from step 2.

Skip this step to start with an empty store. The tables are created automatically on first start.

## 5. Create the web app

1. **Web** tab → **Add a new web app** → **Next** → **Manual configuration** → **Python 3.10** → **Next**.
2. In the page that opens, fill in:

   | Setting | Value |
   |---|---|
   | **Source code** | `/home/YOURNAME/Inventory-Management-System/Bruce Inventory System/Inventory Back-End` |
   | **Virtualenv** | `/home/YOURNAME/.venvs/ims` |
   | **Force HTTPS** (Security section) | **Enabled** |

3. Under **Static files**, add one row (optional, makes pages load faster):

   | URL | Directory |
   |---|---|
   | `/assets/` | `/home/YOURNAME/Inventory-Management-System/Bruce Inventory System/Inventory Back-End/web/assets` |

4. Click the **WSGI configuration file** link (`/var/www/YOURNAME_pythonanywhere_com_wsgi.py`),
   **delete everything in it**, paste this, and fill in the four secrets:

   ```python
   import os
   import sys

   # --- secrets: these live only here, never in GitHub ---
   os.environ['DB_HOST'] = 'YOURNAME.mysql.pythonanywhere-services.com'
   os.environ['DB_USER'] = 'YOURNAME'
   os.environ['DB_NAME'] = 'YOURNAME$brucestore'
   os.environ['DB_PASSWORD'] = 'the database password from step 2'
   os.environ['SECRET_KEY'] = 'the long random string from step 3'
   os.environ['ADMIN_PASSWORD'] = 'the owner password you chose'

   path = '/home/YOURNAME/Inventory-Management-System/Bruce Inventory System/Inventory Back-End'
   if path not in sys.path:
       sys.path.insert(0, path)

   from wsgi import application  # noqa: E402
   ```

5. Click **Save**, go back to the **Web** tab, and press the big green **Reload** button.

## 6. Open the site

Go to **`https://YOURNAME.pythonanywhere.com`** and log in as **`admin`** with your `ADMIN_PASSWORD`.
Then open **Users** to add employees.

`ADMIN_PASSWORD` is only used to create the owner account the first time. To change it later,
use **Change password** in the sidebar.

---

## Updating the live site

After pushing changes to GitHub:

1. On your computer, **if the React code changed**, rebuild it first and commit the result:
   ```bash
   cd "Bruce Inventory System/Inventory Front-End-React" && npm run build
   ```
   (This writes the site into `Inventory Back-End/web`, which is what the live server shows.)
2. On PythonAnywhere, in a Bash console:
   ```bash
   cd ~/Inventory-Management-System && git pull
   ```
3. **Web** tab → **Reload**.

## Good to know

- **Free plan limits:** low traffic only, and you must log in to PythonAnywhere and click
  **"Run until 3 months from today"** on the Web tab at least every 3 months, or the site is paused.
- **Something broken?** The **Web** tab has an **error log** link. Most first-time problems are a
  typo in the WSGI file. A message like *"Set these environment variables before going live"* means
  one of the secrets is missing.
- **What the live mode does differently** (`PRODUCTION=1`, set by `wsgi.py`): debug tools are off,
  it refuses to start without the secrets, login cookies only travel over HTTPS, and database error
  details are hidden from visitors.
- Running on your own computer is unchanged: `run_app.command` / `run_app.bat`.
