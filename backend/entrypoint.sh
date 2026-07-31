#!/bin/sh
set -e

BROKER_URL="${CELERY_BROKER_URL:-redis://redis:6379/0}"

until python -c "import redis, os, sys; redis.from_url(sys.argv[1]).ping()" "$BROKER_URL" 2>/dev/null; do
  echo "Waiting for redis at $BROKER_URL..."
  sleep 1
done

# Only one service should migrate — several containers share the same SQLite
# file, and concurrent `migrate` runs contend for its write lock. compose sets
# RUN_MIGRATIONS=1 on `backend` alone; the worker and flower just wait.
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
fi

exec "$@"
