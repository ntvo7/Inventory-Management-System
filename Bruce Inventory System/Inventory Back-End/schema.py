"""Creates and upgrades the database tables when the backend starts.

Safe to run every time: it only adds what is missing. A teammate with an older
brucestore database gets the new tables and columns automatically.
"""

from db import connect, ensure_database

TABLES = [
    # --- original tables (created only if the database is brand new) ---
    """CREATE TABLE IF NOT EXISTS stock (
        s_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        s_name VARCHAR(255) NOT NULL,
        s_price FLOAT DEFAULT NULL,
        instock INT DEFAULT NULL,
        s_category VARCHAR(255) DEFAULT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS stock_change (
        up_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        newstock INT DEFAULT NULL,
        up_date DATE DEFAULT NULL,
        s_name VARCHAR(255) NOT NULL,
        s_id INT DEFAULT NULL
    )""",
    """CREATE TABLE IF NOT EXISTS price_change (
        p_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        newprice FLOAT DEFAULT NULL,
        up_date DATE DEFAULT NULL,
        s_name VARCHAR(255) NOT NULL,
        s_id INT DEFAULT NULL
    )""",
    # --- people who can log in ---
    """CREATE TABLE IF NOT EXISTS app_user (
        user_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(64) NOT NULL UNIQUE,
        full_name VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin', 'employee', 'viewer') NOT NULL DEFAULT 'employee',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME NULL
    )""",
    # --- suppliers and what we order from them ---
    """CREATE TABLE IF NOT EXISTS supplier (
        supplier_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NULL,
        phone VARCHAR(64) NULL,
        email VARCHAR(255) NULL,
        address VARCHAR(255) NULL,
        lead_time_days INT NOT NULL DEFAULT 3,
        notes TEXT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""",
    """CREATE TABLE IF NOT EXISTS purchase_order (
        po_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        supplier_id INT NOT NULL,
        status ENUM('draft', 'ordered', 'received', 'cancelled') NOT NULL DEFAULT 'draft',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by INT NULL,
        ordered_at DATETIME NULL,
        expected_date DATE NULL,
        received_at DATETIME NULL,
        notes TEXT NULL,
        INDEX (supplier_id), INDEX (status)
    )""",
    """CREATE TABLE IF NOT EXISTS po_item (
        po_item_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        po_id INT NOT NULL,
        s_id INT NOT NULL,
        qty INT NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        INDEX (po_id)
    )""",
    # --- every batch of stock received, with what it cost (used for FIFO / LIFO) ---
    """CREATE TABLE IF NOT EXISTS stock_lot (
        lot_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        s_id INT NOT NULL,
        supplier_id INT NULL,
        po_id INT NULL,
        qty_received INT NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        note VARCHAR(255) NULL,
        INDEX (s_id, received_at)
    )""",
    # --- every change to stock: in (receive, opening, +adjust) and out (sale, -adjust) ---
    """CREATE TABLE IF NOT EXISTS stock_movement (
        m_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        s_id INT NOT NULL,
        s_name VARCHAR(255) NOT NULL,
        m_type ENUM('opening', 'receive', 'sale', 'adjust') NOT NULL,
        qty INT NOT NULL,
        unit_price DECIMAL(10, 2) NULL,
        unit_cost DECIMAL(10, 2) NULL,
        reason VARCHAR(255) NULL,
        user_id INT NULL,
        po_id INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX (s_id, created_at), INDEX (m_type, created_at)
    )""",
]

# columns added to the original stock table
STOCK_COLUMNS = {
    'sku': "VARCHAR(64) NULL",
    'unit': "VARCHAR(32) NOT NULL DEFAULT 'each'",
    'min_stock': "INT NOT NULL DEFAULT 10",
    'supplier_id': "INT NULL",
}

# When a product already has stock but no cost history, its opening stock is
# valued at this share of the selling price. Labelled clearly in the data.
OPENING_COST_RATIO = 0.70


def ensure_schema(default_admin_password='brucestore'):
    ensure_database()
    con = connect()
    cur = con.cursor()
    try:
        for ddl in TABLES:
            cur.execute(ddl)

        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'stock'"
        )
        existing = {row[0].lower() for row in cur.fetchall()}
        for column, definition in STOCK_COLUMNS.items():
            if column not in existing:
                cur.execute(f"ALTER TABLE stock ADD COLUMN {column} {definition}")

        # older databases: allow the read-only 'viewer' role
        cur.execute(
            "SELECT column_type FROM information_schema.columns "
            "WHERE table_schema = DATABASE() AND table_name = 'app_user' AND column_name = 'role'"
        )
        role_type = cur.fetchone()
        if role_type and 'viewer' not in str(role_type[0]):
            cur.execute("ALTER TABLE app_user MODIFY role ENUM('admin', 'employee', 'viewer') NOT NULL DEFAULT 'employee'")

        # first run: create the owner account (same login as before)
        cur.execute("SELECT COUNT(*) FROM app_user")
        if cur.fetchone()[0] == 0:
            from auth import generate_password_hash  # imported here to avoid a circular import
            cur.execute(
                "INSERT INTO app_user (username, full_name, password_hash, role) VALUES (%s, %s, %s, 'admin')",
                ('admin', 'Store Owner', generate_password_hash(default_admin_password)),
            )

        # products with stock on hand but no cost history get an "opening balance" batch
        cur.execute(
            "SELECT s_id, s_name, s_price, instock FROM stock s "
            "WHERE COALESCE(instock, 0) > 0 AND NOT EXISTS (SELECT 1 FROM stock_lot l WHERE l.s_id = s.s_id)"
        )
        for s_id, s_name, s_price, instock in cur.fetchall():
            cost = round(float(s_price or 0) * OPENING_COST_RATIO, 2)
            note = f'Opening balance (estimated cost = {int(OPENING_COST_RATIO * 100)}% of price)'
            cur.execute(
                "INSERT INTO stock_lot (s_id, qty_received, unit_cost, note) VALUES (%s, %s, %s, %s)",
                (s_id, instock, cost, note),
            )
            cur.execute(
                "INSERT INTO stock_movement (s_id, s_name, m_type, qty, unit_cost, reason) "
                "VALUES (%s, %s, 'opening', %s, %s, %s)",
                (s_id, s_name, instock, cost, note),
            )
        con.commit()
    finally:
        cur.close()
        con.close()
