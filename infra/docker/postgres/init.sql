-- PostgreSQL DB roles va ruxsatlar sozlamasi.
-- DEV_PLAN §4 — Invariant: custody_events faqat INSERT + SELECT (UPDATE/DELETE taqiqlangan).

-- ─── App user ─────────────────────────────────────────────────────────────────

-- Backend asosiy foydalanuvchi (docker-compose.yml da APP_USER)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'ali_bridge_app') THEN
        CREATE USER ali_bridge_app WITH PASSWORD 'CHANGE_IN_PRODUCTION';
    END IF;
END $$;

-- ─── Database ruxsatlar ───────────────────────────────────────────────────────

GRANT CONNECT ON DATABASE ali_bridge TO ali_bridge_app;
GRANT USAGE ON SCHEMA public TO ali_bridge_app;

-- Barcha mavjud va kelajakdagi jadvallar uchun asosiy ruxsatlar
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ali_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ali_bridge_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ali_bridge_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ali_bridge_app;

-- ─── Custody events — APPEND ONLY ────────────────────────────────────────────
-- Invariant 1: custody_events jadvalida UPDATE va DELETE taqiqlangan.
-- Bu PostgreSQL darajasida amalga oshiriladi.

-- custody_events yaratilgandan keyin qo'llash uchun trigger function
CREATE OR REPLACE FUNCTION prevent_custody_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'custody_events table is append-only: UPDATE is not allowed';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'custody_events table is append-only: DELETE is not allowed';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger (custody_events jadvali yaratilgandan keyin ishlatiladi)
-- Bu trigger Alembic migration'dan keyin qo'lda yoki skript orqali qo'llaniladi:
-- CREATE TRIGGER enforce_append_only
--   BEFORE UPDATE OR DELETE ON custody_events
--   FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();

-- ─── Read-only user (monitoring, reporting) ───────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'ali_bridge_readonly') THEN
        CREATE USER ali_bridge_readonly WITH PASSWORD 'CHANGE_IN_PRODUCTION_RO';
    END IF;
END $$;

GRANT CONNECT ON DATABASE ali_bridge TO ali_bridge_readonly;
GRANT USAGE ON SCHEMA public TO ali_bridge_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ali_bridge_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO ali_bridge_readonly;

-- ─── Audit log — APPEND ONLY ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'audit_log table is append-only: UPDATE is not allowed';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_log table is append-only: DELETE is not allowed';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger qo'llash (migration'dan keyin):
-- CREATE TRIGGER enforce_audit_append_only
--   BEFORE UPDATE OR DELETE ON audit_log
--   FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();

-- ─── Versiya ──────────────────────────────────────────────────────────────────

COMMENT ON DATABASE ali_bridge IS 'ALI BRIDGE — Cargo relay system DB. Version 1.0';
