"""mahsulot o'chirilganda custody/dispute ham o'chsin

Revision ID: 0007_delete_cascade
Revises: 0006_web_login
Create Date: 2026-06-11

Mahsulotni butunlay o'chirish (sklad xodimi) uchun:
- custody_events append-only trigger UPDATE'ni baribir taqiqlaydi (tarix o'zgarmasin),
  lekin DELETE'ga ruxsat beriladi — mahsulot o'chirilganda tarixi ham o'chadi.
- custody_events.product_id va disputes.product_id FK'lariga ON DELETE CASCADE —
  shunda db.delete(product) bog'liq yozuvlarni avtomatik o'chiradi.
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0007_delete_cascade"
down_revision: str | None = "0006_web_login"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _drop_product_fk(table: str) -> None:
    """{table}.product_id ustunidagi FK'ni nomidan qat'i nazar topib o'chiradi."""
    op.execute(
        f"""
        DO $$
        DECLARE fk_name text;
        BEGIN
            SELECT con.conname INTO fk_name
            FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_attribute att ON att.attrelid = con.conrelid
                AND att.attnum = ANY(con.conkey)
            WHERE rel.relname = '{table}'
              AND con.contype = 'f'
              AND att.attname = 'product_id'
            LIMIT 1;
            IF fk_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE {table} DROP CONSTRAINT %I', fk_name);
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    # 1) Trigger funksiyasi: UPDATE taqiqlanadi, DELETE ruxsat (CASCADE uchun)
    op.execute(
        """
        CREATE OR REPLACE FUNCTION prevent_custody_update_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            IF TG_OP = 'UPDATE' THEN
                RAISE EXCEPTION 'custody_events table is append-only: UPDATE is not allowed';
            END IF;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    # Triggerni faqat UPDATE'da ishlaydigan qilib qayta yaratamiz
    op.execute("DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events")
    op.execute(
        """
        CREATE TRIGGER enforce_custody_append_only
            BEFORE UPDATE ON custody_events
            FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();
        """
    )

    # 2) custody_events.product_id FK -> ON DELETE CASCADE
    _drop_product_fk("custody_events")
    op.create_foreign_key(
        "custody_events_product_id_fkey",
        "custody_events",
        "products",
        ["product_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 3) disputes.product_id FK -> ON DELETE CASCADE
    _drop_product_fk("disputes")
    op.create_foreign_key(
        "disputes_product_id_fkey",
        "disputes",
        "products",
        ["product_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    # FK'larni CASCADE'siz holatga qaytaramiz
    _drop_product_fk("disputes")
    op.create_foreign_key(
        "disputes_product_id_fkey", "disputes", "products", ["product_id"], ["id"]
    )
    _drop_product_fk("custody_events")
    op.create_foreign_key(
        "custody_events_product_id_fkey",
        "custody_events",
        "products",
        ["product_id"],
        ["id"],
    )

    # Triggerni DELETE'ni ham taqiqlaydigan eski holatga qaytaramiz
    op.execute(
        """
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
        """
    )
    op.execute("DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events")
    op.execute(
        """
        CREATE TRIGGER enforce_custody_append_only
            BEFORE UPDATE OR DELETE ON custody_events
            FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete();
        """
    )
