#!/usr/bin/env bash

# List all sessions with card counts and expiration dates
# Usage: ./scripts/list-sessions.sh [--remote]

set -e

DB_NAME="retrospective-db"

# Check for --remote flag
if [[ "$1" == "--remote" ]]; then
  LOCATION_FLAG="--remote"
  echo "Querying REMOTE database..."
else
  LOCATION_FLAG="--local"
  echo "Querying LOCAL database (use --remote for production)..."
fi

echo ""

npx wrangler d1 execute "$DB_NAME" "$LOCATION_FLAG" --command "
SELECT
  s.name,
  COUNT(c.id) as cards,
  CASE
    WHEN s.expires_at IS NULL THEN 'Never'
    WHEN datetime(s.expires_at) < datetime('now') THEN 'EXPIRED'
    ELSE CAST(ROUND(julianday(s.expires_at) - julianday('now')) AS INTEGER) || ' days'
  END as expires,
  s.created_at,
  s.id
FROM sessions s
LEFT JOIN cards c ON s.id = c.session_id
GROUP BY s.id
ORDER BY s.created_at DESC
"
