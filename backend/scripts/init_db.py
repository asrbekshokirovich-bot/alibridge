"""
DB initialization script — role'lar va ruxsatlar sozlamasi.
Alembic migration'dan KEYIN ishga tushiriladi.

Ishlatish:
    cd backend
    poetry run python scripts/init_db.py
    # yoki
    docker-compose exec backend python scripts/init_db.py
"""
import asyncio
import sys
import os

# Backend app'ni path'ga qo'shish
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.core.config import settings


CREATE_TRIGGERS_SQL = """
-- custody_events — APPEND ONLY trigger
CREATE OR REPLACE FUNCTION prevent_custody_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'INVARIANT VIOLATION: custody_events is append-only. UPDATE forbidden.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'INVARIANT VIOLATION: custody_events is append-only. DELETE forbidden.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events;
CREATE TRIGGER enforce_custody_append_only
    BEFORE UPDATE OR DELETE ON custody_events
    FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();

-- audit_log — APPEND ONLY trigger
CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'INVARIANT VIOLATION: audit_log is append-only. UPDATE forbidden.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'INVARIANT VIOLATION: audit_log is append-only. DELETE forbidden.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_audit_append_only ON audit_log;
CREATE TRIGGER enforce_audit_append_only
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
"""

CREATE_READONLY_USER_SQL = """
-- Read-only foydalanuvchi (monitoring va reporting uchun)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'ali_bridge_readonly') THEN
        CREATE USER ali_bridge_readonly WITH PASSWORD 'CHANGE_THIS_PASSWORD';
        RAISE NOTICE 'Created read-only user ali_bridge_readonly';
    ELSE
        RAISE NOTICE 'User ali_bridge_readonly already exists';
    END IF;
END $$;

GRANT CONNECT ON DATABASE ali_bridge TO ali_bridge_readonly;
GRANT USAGE ON SCHEMA public TO ali_bridge_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ali_bridge_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ali_bridge_readonly;
"""

CHECK_TRIGGERS_SQL = """
SELECT
    trigger_name,
    event_object_table,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
"""


async def main():
    """DB permission'larini sozlash."""
    import asyncpg

    # asyncpg to'g'ridan-to'g'ri ishlatiladi (SQLAlchemy ORM emas)
    db_url = settings.db_url.replace("postgresql+asyncpg://", "postgresql://")

    print(f"🔗 Connecting to DB: {db_url[:50]}...")

    conn = await asyncpg.connect(db_url)

    try:
        print("📋 Creating append-only triggers...")
        await conn.execute(CREATE_TRIGGERS_SQL)
        print("✅ Triggers created: custody_events, audit_log")

        print("👤 Setting up read-only user...")
        try:
            await conn.execute(CREATE_READONLY_USER_SQL)
            print("✅ Read-only user configured")
        except Exception as e:
            print(f"⚠️  Read-only user setup (may need superuser): {e}")

        print("\n📊 Checking triggers:")
        rows = await conn.fetch(CHECK_TRIGGERS_SQL)
        for row in rows:
            print(f"   ✓ {row['event_object_table']}.{row['trigger_name']} [{row['event_manipulation']}]")

        print("\n✅ DB initialization complete!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
