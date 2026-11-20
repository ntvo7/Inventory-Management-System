#!/bin/bash
# Copies your local products, suppliers, orders and stock history into the online
# database (TiDB Cloud). User accounts are NOT copied: the live site makes its own
# owner account from ADMIN_PASSWORD.
#
#   ./import_data.sh            (it asks for the connection string)
cd "$(dirname "$0")" || exit 1

echo "1/3 Exporting your local database..."
mysqldump -uroot -p'!r00tpwd' --no-tablespaces --single-transaction --skip-triggers --set-gtid-purged=OFF \
  --ignore-table=brucestore.app_user brucestore > brucestore-data.sql 2>/dev/null || { echo "Export failed. Is MySQL running?"; exit 1; }

echo
# uses the app's own Python database driver (the MySQL 9 command-line tool can't log in to TiDB Cloud)
../venv/bin/python upload_data.py brucestore-data.sql
