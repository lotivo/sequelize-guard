#!/usr/bin/env bash
set -euo pipefail

runtime=${CONTAINER_RUNTIME:-docker}
image=${GUARD_POSTGRES_IMAGE:-docker.io/library/postgres:17-alpine}
prefix="guard-replication-$$-${RANDOM}"
writer="${prefix}-writer"
standby="${prefix}-standby"
network="${prefix}-net"

cleanup() {
  "$runtime" rm -fv "$standby" "$writer" >/dev/null 2>&1 || true
  "$runtime" network rm "$network" >/dev/null 2>&1 || true
}
wait_for_postgres() {
  local container=$1
  for ((attempt = 0; attempt < 60; attempt++)); do
    if "$runtime" exec "$container" pg_isready -h 127.0.0.1 -U postgres -q; then
      return
    fi
    sleep 1
  done
  "$runtime" logs "$container"
  return 1
}

"$runtime" network create "$network" >/dev/null
trap cleanup EXIT
"$runtime" run -d --name "$writer" --network "$network" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD=guard-test -e POSTGRES_DB=guard_test "$image" \
  -c wal_level=replica -c max_wal_senders=4 >/dev/null
wait_for_postgres "$writer"
"$runtime" exec "$writer" sh -ec 'printf "\nhost replication postgres all scram-sha-256\n" >> "$PGDATA/pg_hba.conf"'
"$runtime" exec "$writer" psql -v ON_ERROR_STOP=1 -U postgres -d guard_test \
  -c 'SELECT pg_reload_conf()' \
  -c "SELECT pg_create_physical_replication_slot('guard_standby')" >/dev/null

"$runtime" run -d --name "$standby" --network "$network" -p 127.0.0.1::5432 \
  -e PGPASSWORD=guard-test -e "GUARD_WRITER=$writer" "$image" sh -ec '
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"
    gosu postgres pg_basebackup -h "$GUARD_WRITER" -U postgres -D "$PGDATA" -R -X stream -S guard_standby
    exec gosu postgres postgres -c hot_standby=on
  ' >/dev/null
wait_for_postgres "$standby"

writer_address=$("$runtime" port "$writer" 5432/tcp)
standby_address=$("$runtime" port "$standby" 5432/tcp)
export SEQUELIZE_GUARD_TEST_DATABASE_URL="postgresql://postgres:guard-test@${writer_address}/guard_test"
export SEQUELIZE_GUARD_TEST_REPLICA_URL="postgresql://postgres:guard-test@${standby_address}/guard_test"

cd "$(dirname "$0")/.."
./node_modules/.bin/vitest run --config packages/sequelize-guard/vitest.dialects.config.mts replication.integration.ts
