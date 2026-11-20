#!/bin/bash
# Copies your local products, suppliers, orders and stock history into the online
# (Aiven) database. User accounts are NOT copied: the live site makes its own owner
# account from ADMIN_PASSWORD.
#
#   ./import_data.sh            (it asks for the Aiven Service URI)
cd "$(dirname "$0")" || exit 1

echo "1/3 Exporting your local database..."
mysqldump -uroot -p'!r00tpwd' --no-tablespaces --single-transaction --skip-triggers --set-gtid-purged=OFF \
  --ignore-table=brucestore.app_user brucestore > brucestore-data.sql 2>/dev/null || { echo "Export failed. Is MySQL running?"; exit 1; }

echo
read -r -s -p "2/3 Paste the Aiven Service URI (it won't show on screen) and press Enter: " URI
echo
# mysql://USER:PASSWORD@HOST:PORT/DBNAME?ssl-mode=REQUIRED
re='^mysql://([^:]+):([^@]+)@([^:/]+):([0-9]+)/([^?]+)'
[[ $URI =~ $re ]] || { echo "That doesn't look like a Service URI (it starts with mysql://)."; exit 1; }
USER="${BASH_REMATCH[1]}"; PASS="${BASH_REMATCH[2]}"; HOST="${BASH_REMATCH[3]}"; PORT="${BASH_REMATCH[4]}"; DB="${BASH_REMATCH[5]}"

echo "3/3 Uploading to $HOST ..."
MYSQL_PWD="$PASS" mysql -h "$HOST" -P "$PORT" -u "$USER" --ssl-mode=REQUIRED "$DB" < brucestore-data.sql \
  && echo "Done. Your products and history are in the online database." \
  || echo "Upload failed. Check that the Aiven service is running (green) and the URI is complete."
