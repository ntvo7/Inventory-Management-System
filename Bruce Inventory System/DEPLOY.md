# Putting Stop Mini Mart online (free)

- **Aiven** hosts the MySQL database (free plan).
- **Render** runs the website from this GitHub repo (free plan) at `https://stopminimart.onrender.com`
  (or a similar name if that one is taken).

The free Render plan sleeps after 15 minutes with no visitors; the first visit after that takes
30–60 seconds to wake it up. Open the site a minute before a demo.

## 1. Database (Aiven)

1. Sign up at <https://aiven.io> (free, no card needed).
2. **Create service** → **MySQL** → **Free plan** → pick a region near you (for example US East) → **Create**.
3. Wait until the service shows **Running** (green), then copy the **Service URI** on its Overview page.
   It looks like `mysql://avnadmin:PASSWORD@xxxx.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED`.
   Keep it private: it contains the database password.

## 2. Copy your data (optional)

On your Mac, in Terminal:

```bash
cd ~/Documents/GitHub/CIS4375_Project-Team4/"Bruce Inventory System"/deploy && ./import_data.sh
```

Paste the Service URI when asked. It copies products, suppliers, orders and stock history
(**not** user accounts). Skip this to start with an empty store.

## 3. Website (Render)

1. Sign up at <https://render.com> with **GitHub**.
2. **New** → **Blueprint** → choose **ntvo7/Inventory-Management-System** → **Connect**.
   Render reads `render.yaml` from the repo and sets everything up.
3. It asks for two values:
   - **DATABASE_URL**: paste the Aiven Service URI.
   - **ADMIN_PASSWORD**: choose the owner password for the live site (not `brucestore`).
4. Click **Apply** / **Deploy**. The first build takes a few minutes.
5. Open the address Render shows and log in as **`admin`** with your ADMIN_PASSWORD.

## Updating the live site

Render redeploys automatically every time `main` is pushed to GitHub.
If you changed React code, run `npm run build` in `Inventory Front-End-React` first and commit the
result (`Inventory Back-End/web`), because that built copy is what the live site shows.

## If something goes wrong

Render → your service → **Logs**. A message like *"Set these environment variables before going live"*
means a value from step 3 is missing. Running on your own computer is unchanged
(`run_app.command` / `run_app.bat`).
