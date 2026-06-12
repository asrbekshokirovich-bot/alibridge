"""WAREHOUSE_UZ/TR/ORDERER holding holder_id -> 0 (sentinel)

Revision ID: 0010_fix_wh_holder
Revises: 0009_split_custody
Create Date: 2026-06-12

0009 backfill xodim-egasiz bosqichlar (ombor/orderer) uchun custody_holder_id
ni (eski receive to_holder_id=user.id qoldig'i) holding'ga ko'chirib yuborgan.
Yangi kod bu bosqichlarda DOIM holder_id=0 ishlatadi. Mavjud yozuvlarni
0 ga normallashtiramiz — bir variantda bir nechta bo'lsa miqdorni birlashtiramiz.

Sof SQL (Supabase transaction pooler-mos, DO blok yo'q).
"""
from collections.abc import Sequence

from alembic import op

revision: str = "0010_fix_wh_holder"
down_revision: str | None = "0009_split_custody"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_STAGES = "('warehouse_uz', 'warehouse_tr', 'orderer')"


def upgrade() -> None:
    # 1) Konflikt bo'ladiganlarni (allaqachon holder_id=0 satri bor) birlashtiramiz:
    #    eski (holder_id<>0) miqdorni 0-satrga qo'shamiz.
    op.execute(
        f"""
        UPDATE custody_holdings z
        SET quantity = z.quantity + src.qty
        FROM (
            SELECT variant_id, holder_type, SUM(quantity) AS qty
            FROM custody_holdings
            WHERE holder_type IN {_STAGES} AND holder_id <> 0
            GROUP BY variant_id, holder_type
        ) src
        WHERE z.variant_id = src.variant_id
          AND z.holder_type = src.holder_type
          AND z.holder_id = 0
        """
    )
    # 2) Birlashtirilgan eski satrlarni o'chiramiz (0-satri mavjud bo'lganlar)
    op.execute(
        f"""
        DELETE FROM custody_holdings a
        WHERE a.holder_type IN {_STAGES} AND a.holder_id <> 0
          AND EXISTS (
            SELECT 1 FROM custody_holdings b
            WHERE b.variant_id = a.variant_id
              AND b.holder_type = a.holder_type
              AND b.holder_id = 0
          )
        """
    )
    # 3) Qolgan eski satrlar (0-satri yo'q) — to'g'ridan-to'g'ri 0 ga ko'chiramiz
    op.execute(
        f"""
        UPDATE custody_holdings
        SET holder_id = 0
        WHERE holder_type IN {_STAGES} AND holder_id <> 0
        """
    )


def downgrade() -> None:
    # Qaytarib bo'lmaydi (qaysi xodim id ekani yo'qolgan) — no-op
    pass
