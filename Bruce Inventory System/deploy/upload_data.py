"""Upload brucestore-data.sql into the online database (used by import_data.sh).

Uses the same Python driver as the app, which can log in to TiDB Cloud
(the MySQL 9 command-line tool can't).

    python upload_data.py brucestore-data.sql     (asks for the connection string)
"""
import getpass
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'Inventory Back-End'))


def statements(sql_text):
    """Split a mysqldump file into statements (each ends with ';' at the end of a line)."""
    current = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not current and (not stripped or stripped.startswith('--')):
            continue
        current.append(line)
        if stripped.endswith(';'):
            yield '\n'.join(current)
            current = []


def main():
    dump = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'brucestore-data.sql')
    url = os.environ.get('DATABASE_URL') or getpass.getpass(
        "2/3 Paste the database connection string (it won't show on screen) and press Enter: ").strip()
    if not url.startswith('mysql://'):
        sys.exit("That doesn't look like a connection string (it starts with mysql://).")
    os.environ['DATABASE_URL'] = url

    import db  # reads DATABASE_URL
    import mysql.connector

    print(f"3/3 Uploading to {db.DB_CONFIG['host']} ...")
    try:
        con = db.connect()
    except mysql.connector.Error as e:
        sys.exit(f'Could not connect: {e.msg}\nCheck that the database is running and the string is complete.')
    cur = con.cursor()
    inserts = 0
    with open(dump, encoding='utf-8') as f:
        for stmt in statements(f.read()):
            cur.execute(stmt)
            if cur.with_rows:
                cur.fetchall()
            if stmt.lstrip().upper().startswith('INSERT'):
                inserts += 1
    con.commit()
    cur.execute("SELECT COUNT(*) FROM stock")
    products = cur.fetchone()[0]
    cur.close()
    con.close()
    print(f'Done. {products} products and their history are in the online database ({inserts} insert batches).')


if __name__ == '__main__':
    main()
