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

# Eslatma: Supabase transaction pooler (port 6543) anonim `DO $$` PL/pgSQL
# bloklarini ishonchli uzatmaydi — shu sababli bu yerda DO bloklar ISHLATILMAYDI.
# FK nomlari 0001/0005 dan aniq ma'lum, shuning uchun to'g'ridan-to'g'ri
# DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT ishlatamiz (sof DDL, pooler-mos).


def upgrade() -> None:
    # 1) Trigger: DELETE'ga ruxsat, UPDATE taqiqlanadi.
    #    MUHIM: funksiyani O'ZGARTIRMAYMIZ (CREATE FUNCTION pooler'da muammoli).
    #    Trigger endi faqat BEFORE UPDATE'da ishlaydi — DELETE paytida funksiya
    #    umuman chaqirilmaydi, shuning uchun uning eski tanasi (DELETE bloklash)
    #    ahamiyatsiz. Eski triggerni o'chirib, UPDATE-only qilib qayta yaratamiz.
    op.execute("DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events")
    op.execute(
        "CREATE TRIGGER enforce_custody_append_only "
        "BEFORE UPDATE ON custody_events "
        "FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete()"
    )

    # 2) custody_events.product_id FK -> ON DELETE CASCADE (nom 0001 dan ma'lum)
    op.execute(
        "ALTER TABLE custody_events DROP CONSTRAINT IF EXISTS custody_events_product_id_fkey"
    )
    op.execute(
        "ALTER TABLE custody_events ADD CONSTRAINT custody_events_product_id_fkey "
        "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
    )

    # 3) disputes.product_id FK -> ON DELETE CASCADE (nom 0001 dan ma'lum)
    op.execute(
        "ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_product_id_fkey"
    )
    op.execute(
        "ALTER TABLE disputes ADD CONSTRAINT disputes_product_id_fkey "
        "FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE"
    )


def downgrade() -> None:
    # FK'larni CASCADE'siz holatga qaytaramiz
    op.execute("ALTER TABLE disputes DROP CONSTRAINT IF EXISTS disputes_product_id_fkey")
    op.execute(
        "ALTER TABLE disputes ADD CONSTRAINT disputes_product_id_fkey "
        "FOREIGN KEY (product_id) REFERENCES products(id)"
    )
    op.execute(
        "ALTER TABLE custody_events DROP CONSTRAINT IF EXISTS custody_events_product_id_fkey"
    )
    op.execute(
        "ALTER TABLE custody_events ADD CONSTRAINT custody_events_product_id_fkey "
        "FOREIGN KEY (product_id) REFERENCES products(id)"
    )

    # Triggerni DELETE'ni ham taqiqlaydigan eski holatga qaytaramiz.
    # Funksiya tanasi 0001 dan beri DELETE'ni ham bloklaydi — uni o'zgartirish
    # shart emas, faqat triggerni BEFORE UPDATE OR DELETE qilib qayta yaratamiz.
    op.execute("DROP TRIGGER IF EXISTS enforce_custody_append_only ON custody_events")
    op.execute(
        "CREATE TRIGGER enforce_custody_append_only "
        "BEFORE UPDATE OR DELETE ON custody_events "
        "FOR EACH ROW EXECUTE FUNCTION prevent_custody_update_delete()"
    )
