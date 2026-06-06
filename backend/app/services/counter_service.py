from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Counter


async def next_value(db: AsyncSession, name: str) -> int:
    """Atomik ravishda hisoblagichni 1 ga oshiradi va yangi qiymatni qaytaradi.

    Qator yo'q bo'lsa — yaratadi (1 dan boshlanadi). INSERT ... ON CONFLICT
    qatorni atomik qulflaydi: bir vaqtda ikki so'rov bir xil raqam olmaydi.
    """
    stmt = (
        insert(Counter)
        .values(name=name, value=1)
        .on_conflict_do_update(
            index_elements=[Counter.name],
            set_={"value": Counter.value + 1},
        )
        .returning(Counter.value)
    )
    result = await db.execute(stmt)
    value = result.scalar_one()
    await db.flush()
    return value
